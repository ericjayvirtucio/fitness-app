import {
  DomainId,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  type Result,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type {
  CompletedWorkoutLifecycle,
  WorkoutSessionRepository,
} from '../../workout-session/application/workout-session-repository';
import {
  completedWorkoutLifecycle,
  DeleteCompletedWorkoutUseCase,
  type CompletedWorkoutDeletionContext,
  type CompletedWorkoutDeletionOutcome,
} from './delete-completed-workout-use-case';

const sessionId = '550e8400-e29b-41d4-a716-446655440000';
const exerciseId = '550e8400-e29b-41d4-a716-446655440001';
const setId = '550e8400-e29b-41d4-a716-446655440002';
const startedAt = 1_700_000_000_000;
const completedAt = startedAt + 3_600_000;

function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function id(value: string) {
  return unwrap(DomainId.create(value));
}

function session(
  status: 'active' | 'completed' = 'completed',
  completed: number | null = completedAt,
) {
  const exercise = unwrap(
    WorkoutSessionExercise.create({
      exerciseNameSnapshot: 'Bench press',
      id: id(exerciseId),
      loggingModeSnapshot: 'repetitions',
      plannedPrescriptionSnapshot: null,
      position: 0,
      sets: [
        unwrap(
          WorkoutSet.create({
            id: id(setId),
            position: 0,
            repsInReserve: null,
            result: RepetitionResult.valid(8),
          }),
        ),
      ],
      sourceExerciseDefinitionId: id('550e8400-e29b-41d4-a716-446655440004'),
      sourcePlannedExerciseId: null,
    }),
  );
  return unwrap(
    WorkoutSession.create({
      completedAtEpochMilliseconds: completed,
      exercises: [exercise],
      id: id(sessionId),
      name: 'Push day',
      sourcePlannedWorkoutId: null,
      sourceWeekday: null,
      startedAtEpochMilliseconds: startedAt,
      startedLocalCalendarDate: '2023-11-14',
      startedUtcOffsetMinutes: -480,
      status,
    }),
  );
}

class Sessions implements WorkoutSessionRepository {
  deletions: CompletedWorkoutLifecycle[] = [];
  failOnDelete = false;
  constructor(public stored: WorkoutSession | null) {}
  complete(value: WorkoutSession) {
    return Promise.resolve(value);
  }
  correctCompleted() {
    return Promise.resolve();
  }
  deleteCompleted(_id: DomainId, expected: CompletedWorkoutLifecycle) {
    if (this.failOnDelete) return Promise.reject(new Error('write failed'));
    this.deletions.push(expected);
    this.stored = null;
    return Promise.resolve();
  }
  discard() {
    return Promise.resolve(true);
  }
  getActive() {
    return Promise.resolve(null);
  }
  getById() {
    return Promise.resolve(this.stored);
  }
  insert() {
    return Promise.resolve();
  }
  rename() {
    return Promise.resolve(true);
  }
  replace() {
    return Promise.resolve();
  }
}

function fixture(stored: WorkoutSession | null = session()) {
  const sessions = new Sessions(stored);
  const runner: TransactionRunner<CompletedWorkoutDeletionContext> = {
    run: (operation) => operation({ sessions }),
  };
  return { sessions, useCase: new DeleteCompletedWorkoutUseCase(runner) };
}

const expected: CompletedWorkoutLifecycle = {
  completedAtEpochMilliseconds: completedAt,
  startedAtEpochMilliseconds: startedAt,
};

function refusal(outcome: CompletedWorkoutDeletionOutcome) {
  if (outcome.status !== 'refused')
    throw new Error('Expected the deletion to be refused');
  return outcome.reason;
}

describe('DeleteCompletedWorkoutUseCase', () => {
  it('deletes a completed workout through the session repository', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({ expected, sessionId });

    expect(outcome.status).toBe('deleted');
    expect(sessions.deletions).toEqual([expected]);
    expect(sessions.stored).toBeNull();
  });

  it('refuses an active session so completed deletion cannot abandon a workout', async () => {
    const { sessions, useCase } = fixture(session('active', null));

    const outcome = await useCase.execute({ expected, sessionId });

    expect(refusal(outcome)).toBe('not-completed');
    expect(sessions.deletions).toEqual([]);
    expect(sessions.stored).not.toBeNull();
  });

  it('reports a missing workout as no longer available', async () => {
    const { sessions, useCase } = fixture(null);

    const outcome = await useCase.execute({ expected, sessionId });

    expect(refusal(outcome)).toBe('not-found');
    expect(sessions.deletions).toEqual([]);
  });

  it('reports an already deleted workout as no longer available', async () => {
    const { sessions, useCase } = fixture();

    const first = await useCase.execute({ expected, sessionId });
    const second = await useCase.execute({ expected, sessionId });

    expect(first.status).toBe('deleted');
    expect(refusal(second)).toBe('not-found');
    expect(sessions.deletions).toHaveLength(1);
  });

  it('refuses an invalid identifier without reaching storage', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      expected,
      sessionId: 'not-a-uuid',
    });

    expect(refusal(outcome)).toBe('not-found');
    expect(sessions.deletions).toEqual([]);
    expect(sessions.stored).not.toBeNull();
  });

  it('refuses when the stored completion instant differs from the loaded one', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      expected: {
        completedAtEpochMilliseconds: completedAt + 1,
        startedAtEpochMilliseconds: startedAt,
      },
      sessionId,
    });

    expect(refusal(outcome)).toBe('changed');
    expect(sessions.deletions).toEqual([]);
    expect(sessions.stored).not.toBeNull();
  });

  it('refuses when the stored start instant differs from the loaded one', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      expected: {
        completedAtEpochMilliseconds: completedAt,
        startedAtEpochMilliseconds: startedAt - 1,
      },
      sessionId,
    });

    expect(refusal(outcome)).toBe('changed');
    expect(sessions.deletions).toEqual([]);
  });

  it('passes the stored lifecycle to the repository rather than the submitted one', async () => {
    const { sessions, useCase } = fixture();
    const stored = completedWorkoutLifecycle(session());
    if (stored === null) throw new Error('Invalid fixture');

    await useCase.execute({ expected, sessionId });

    expect(sessions.deletions).toEqual([stored]);
  });

  it('reads no lifecycle from a session that was never completed', () => {
    expect(completedWorkoutLifecycle(session('active', null))).toBeNull();
  });

  it('preserves the workout when the write fails', async () => {
    const { sessions, useCase } = fixture();
    sessions.failOnDelete = true;

    await expect(useCase.execute({ expected, sessionId })).rejects.toThrow();

    expect(sessions.stored).not.toBeNull();
    expect(sessions.deletions).toEqual([]);
  });
});
