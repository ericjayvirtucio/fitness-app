import {
  DomainId,
  RepetitionResult,
  type WorkoutSession,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type {
  WorkoutSessionRepository,
  WorkoutSessionTransactionContext,
} from './workout-session-repository';
import {
  DiscardWorkoutSessionUseCase,
  FinishWorkoutSessionUseCase,
  StartWorkoutSessionUseCase,
  WorkoutSessionMutationUseCases,
  type WorkoutSessionContext,
} from './workout-session-use-cases';

const ids = Array.from(
  { length: 8 },
  (_, index) =>
    `550e8400-e29b-41d4-a716-${String(index + 1).padStart(12, '0')}`,
);

class Sessions implements WorkoutSessionRepository {
  current: WorkoutSession | null = null;
  discardCalls = 0;
  /** Rejects the next write, so a persistence failure can be observed. */
  failNextDiscard = false;
  complete(session: WorkoutSession) {
    this.current = session;
    return Promise.resolve(session);
  }
  correctCompleted(session: WorkoutSession) {
    this.current = session;
    return Promise.resolve();
  }
  deleteCompleted() {
    this.current = null;
    return Promise.resolve();
  }
  discard(id: DomainId) {
    this.discardCalls += 1;
    if (this.failNextDiscard)
      return Promise.reject(new PersistenceError('operation-failed'));
    if (this.current?.status !== 'active' || !this.current.id.equals(id))
      return Promise.resolve(false);
    this.current = null;
    return Promise.resolve(true);
  }
  getActive() {
    return Promise.resolve(
      this.current?.status === 'active' ? this.current : null,
    );
  }
  getById() {
    return Promise.resolve(this.current);
  }
  insert(session: WorkoutSession) {
    this.current = session;
    return Promise.resolve();
  }
  rename() {
    return Promise.resolve(true);
  }
  replace(session: WorkoutSession) {
    this.current = session;
    return Promise.resolve();
  }
}

function fixture() {
  const sessions = new Sessions();
  const context = {
    catalog: {
      getById: () =>
        Promise.resolve({
          definition: {
            id: value(DomainId.create(ids[6])),
            loggingMode: 'bodyweight-and-repetitions',
            name: 'Push-up',
          },
        }),
    },
    planner: {},
    sessions,
  } as unknown as WorkoutSessionContext;
  const runner: TransactionRunner<WorkoutSessionContext> = {
    run: (operation) => operation(context),
  };
  let index = 0;
  const discards = { count: 0 };
  const discardRunner: TransactionRunner<WorkoutSessionTransactionContext> = {
    run: (operation) => {
      discards.count += 1;
      return operation({ sessions });
    },
  };
  return {
    context,
    discardRunner,
    discards,
    generateId: () => ids[index++]!,
    runner,
    sessions,
  };
}

function value<T>(
  result: { isSuccess: true; value: T } | { isSuccess: false },
): T {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('Workout Session use cases', () => {
  it('starts an independent empty session and surfaces it on a second start', async () => {
    const { generateId, runner } = fixture();
    const useCase = new StartWorkoutSessionUseCase(runner, generateId, () =>
      new Date(2026, 7, 6, 10).getTime(),
    );
    const first = await useCase.executeEmpty();
    expect(first).toMatchObject({
      session: { name: 'Workout' },
      status: 'started',
    });
    await expect(useCase.executeEmpty()).resolves.toMatchObject({
      status: 'active-exists',
    });
  });

  it('persists exercise and actual-set mutations immediately', async () => {
    const { generateId, runner, sessions } = fixture();
    const start = new StartWorkoutSessionUseCase(
      runner,
      generateId,
      () => 1_700_000_000_000,
    );
    const started = await start.executeEmpty();
    if (started.status !== 'started') throw new Error('Invalid fixture');
    const mutations = new WorkoutSessionMutationUseCases(runner, generateId);
    const added = await mutations.addExercise(started.session.id.value, ids[6]);
    expect(added.isSuccess).toBe(true);
    const exercise = sessions.current?.exercises[0];
    if (!exercise) throw new Error('Invalid fixture');
    const set = await mutations.addSet(
      started.session.id.value,
      exercise.id.value,
      RepetitionResult.valid(8),
      null,
    );
    expect(set.isSuccess).toBe(true);
    expect(sessions.current?.exercises[0]?.sets[0]?.result).toMatchObject({
      repetitions: 8,
    });
  });

  it('rejects empty completion and completes performed work', async () => {
    const { generateId, runner, sessions } = fixture();
    const start = new StartWorkoutSessionUseCase(
      runner,
      generateId,
      () => 1_700_000_000_000,
    );
    const started = await start.executeEmpty();
    if (started.status !== 'started') throw new Error('Invalid fixture');
    const finish = new FinishWorkoutSessionUseCase(
      runner,
      () => 1_700_000_001_000,
    );
    expect((await finish.execute(started.session.id.value)).isSuccess).toBe(
      false,
    );
    const mutations = new WorkoutSessionMutationUseCases(runner, generateId);
    await mutations.addExercise(started.session.id.value, ids[6]);
    const exercise = sessions.current?.exercises[0];
    if (!exercise) throw new Error('Invalid fixture');
    await mutations.addSet(
      started.session.id.value,
      exercise.id.value,
      RepetitionResult.valid(8),
      null,
    );
    expect((await finish.execute(started.session.id.value)).isSuccess).toBe(
      true,
    );
    expect(sessions.current?.status).toBe('completed');
  });
});

describe('Discarding an active workout', () => {
  function started() {
    const parts = fixture();
    const start = new StartWorkoutSessionUseCase(
      parts.runner,
      parts.generateId,
      () => 1_700_000_000_000,
    );
    return start.executeEmpty().then((outcome) => {
      if (outcome.status !== 'started') throw new Error('Invalid fixture');
      return { ...parts, session: outcome.session };
    });
  }

  it('discards an active session inside exactly one transaction', async () => {
    const { discardRunner, discards, session, sessions } = await started();
    const useCase = new DiscardWorkoutSessionUseCase(discardRunner);
    await expect(useCase.execute(session.id.value)).resolves.toBe(true);
    expect(sessions.current).toBeNull();
    expect(discards.count).toBe(1);
    expect(sessions.discardCalls).toBe(1);
  });

  it('reports a missing session without writing', async () => {
    const { discardRunner, sessions } = fixture();
    const useCase = new DiscardWorkoutSessionUseCase(discardRunner);
    await expect(useCase.execute(ids[0])).resolves.toBe(false);
    expect(sessions.current).toBeNull();
  });

  it('refuses a completed workout and leaves it stored', async () => {
    const { discardRunner, runner, session, sessions } = await started();
    const mutations = new WorkoutSessionMutationUseCases(runner, () => ids[5]!);
    await mutations.addExercise(session.id.value, ids[6]);
    const exercise = sessions.current?.exercises[0];
    if (!exercise) throw new Error('Invalid fixture');
    await mutations.addSet(
      session.id.value,
      exercise.id.value,
      RepetitionResult.valid(8),
      null,
    );
    await new FinishWorkoutSessionUseCase(
      runner,
      () => 1_700_000_001_000,
    ).execute(session.id.value);
    const useCase = new DiscardWorkoutSessionUseCase(discardRunner);
    await expect(useCase.execute(session.id.value)).resolves.toBe(false);
    expect(sessions.current?.status).toBe('completed');
  });

  it('refuses an invalid identifier without opening a transaction', async () => {
    const { discardRunner, discards, sessions } = await started();
    const useCase = new DiscardWorkoutSessionUseCase(discardRunner);
    await expect(useCase.execute('not-a-uuid')).resolves.toBe(false);
    expect(discards.count).toBe(0);
    expect(sessions.discardCalls).toBe(0);
    expect(sessions.current?.status).toBe('active');
  });

  it('propagates a write failure instead of reporting a discard', async () => {
    const { discardRunner, session, sessions } = await started();
    sessions.failNextDiscard = true;
    const useCase = new DiscardWorkoutSessionUseCase(discardRunner);
    await expect(useCase.execute(session.id.value)).rejects.toBeInstanceOf(
      PersistenceError,
    );
    expect(sessions.current?.status).toBe('active');
  });
});
