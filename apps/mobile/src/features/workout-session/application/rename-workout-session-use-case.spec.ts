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
  WorkoutSessionLifecycle,
  WorkoutSessionRepository,
} from './workout-session-repository';
import {
  RenameWorkoutSessionUseCase,
  workoutSessionLifecycle,
  type WorkoutSessionRenameContext,
  type WorkoutSessionRenameOutcome,
} from './rename-workout-session-use-case';

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
      name: 'Workout',
      sourcePlannedWorkoutId: null,
      sourceWeekday: null,
      startedAtEpochMilliseconds: startedAt,
      startedLocalCalendarDate: '2023-11-14',
      startedUtcOffsetMinutes: -480,
      status,
    }),
  );
}

type Write = Readonly<{ expected: WorkoutSessionLifecycle; name: string }>;

class Sessions implements WorkoutSessionRepository {
  failOnRename = false;
  matchesLifecycle = true;
  writes: Write[] = [];
  constructor(public stored: WorkoutSession | null) {}
  complete(value: WorkoutSession) {
    return Promise.resolve(value);
  }
  correctCompleted() {
    return Promise.reject(new Error('correction is not a rename'));
  }
  deleteCompleted() {
    return Promise.reject(new Error('deletion is not a rename'));
  }
  discard() {
    return Promise.reject(new Error('discard is not a rename'));
  }
  getActive() {
    return Promise.resolve(null);
  }
  getById() {
    return Promise.resolve(this.stored);
  }
  insert() {
    return Promise.reject(new Error('insertion is not a rename'));
  }
  rename(_id: DomainId, name: string, expected: WorkoutSessionLifecycle) {
    if (this.failOnRename) return Promise.reject(new Error('write failed'));
    if (!this.matchesLifecycle) return Promise.resolve(false);
    this.writes.push({ expected, name });
    return Promise.resolve(true);
  }
  replace() {
    return Promise.reject(new Error('replacement is not a rename'));
  }
}

function fixture(stored: WorkoutSession | null = session()) {
  const sessions = new Sessions(stored);
  const runner: TransactionRunner<WorkoutSessionRenameContext> = {
    run: (operation) => operation({ sessions }),
  };
  return { sessions, useCase: new RenameWorkoutSessionUseCase(runner) };
}

function refusal(outcome: WorkoutSessionRenameOutcome) {
  if (outcome.status !== 'refused')
    throw new Error('Expected the rename to be refused');
  return outcome.reason;
}

function renamed(outcome: WorkoutSessionRenameOutcome) {
  if (outcome.status !== 'renamed')
    throw new Error('Expected the rename to be applied');
  return outcome.session;
}

const completedExpectation: WorkoutSessionLifecycle = {
  completedAtEpochMilliseconds: completedAt,
  startedAtEpochMilliseconds: startedAt,
  status: 'completed',
};

const activeExpectation: WorkoutSessionLifecycle = {
  completedAtEpochMilliseconds: null,
  startedAtEpochMilliseconds: startedAt,
  status: 'active',
};

describe('RenameWorkoutSessionUseCase', () => {
  it('renames a completed workout and writes the name alone', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      expected: completedExpectation,
      name: 'Leg Day',
      sessionId,
    });

    expect(renamed(outcome).name).toBe('Leg Day');
    expect(sessions.writes).toEqual([
      { expected: completedExpectation, name: 'Leg Day' },
    ]);
  });

  it('renames an active workout through the same workflow', async () => {
    const { sessions, useCase } = fixture(session('active', null));

    const outcome = await useCase.execute({
      expected: activeExpectation,
      name: 'Morning Session',
      sessionId,
    });

    expect(renamed(outcome).name).toBe('Morning Session');
    expect(sessions.writes).toEqual([
      { expected: activeExpectation, name: 'Morning Session' },
    ]);
  });

  it('changes the name and no other field of the aggregate', async () => {
    const { useCase } = fixture();
    const before = session();

    const after = renamed(
      await useCase.execute({
        expected: completedExpectation,
        name: 'Leg Day',
        sessionId,
      }),
    );

    expect(after.name).not.toBe(before.name);
    expect(after.id.value).toBe(before.id.value);
    expect(after.status).toBe(before.status);
    expect(after.startedAtEpochMilliseconds).toBe(
      before.startedAtEpochMilliseconds,
    );
    expect(after.completedAtEpochMilliseconds).toBe(
      before.completedAtEpochMilliseconds,
    );
    expect(after.startedLocalCalendarDate).toBe(
      before.startedLocalCalendarDate,
    );
    expect(after.startedUtcOffsetMinutes).toBe(before.startedUtcOffsetMinutes);
    expect(after.sourcePlannedWorkoutId).toBe(before.sourcePlannedWorkoutId);
    expect(after.sourceWeekday).toBe(before.sourceWeekday);
    expect(after.exercises).toHaveLength(before.exercises.length);
    expect(after.exercises[0]?.id.value).toBe(before.exercises[0]?.id.value);
    expect(after.exercises[0]?.position).toBe(before.exercises[0]?.position);
    expect(after.exercises[0]?.exerciseNameSnapshot).toBe(
      before.exercises[0]?.exerciseNameSnapshot,
    );
    expect(after.exercises[0]?.loggingModeSnapshot).toBe(
      before.exercises[0]?.loggingModeSnapshot,
    );
    expect(after.exercises[0]?.sets[0]?.id.value).toBe(
      before.exercises[0]?.sets[0]?.id.value,
    );
    expect(after.exercises[0]?.sets[0]?.result).toEqual(
      before.exercises[0]?.sets[0]?.result,
    );
  });

  it('stores the trimmed name the aggregate accepted', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      expected: completedExpectation,
      name: '   Leg Day   ',
      sessionId,
    });

    expect(renamed(outcome).name).toBe('Leg Day');
    expect(sessions.writes[0]?.name).toBe('Leg Day');
  });

  it('accepts a name at the maximum length and refuses one past it', async () => {
    const { sessions, useCase } = fixture();

    const longest = await useCase.execute({
      expected: completedExpectation,
      name: 'a'.repeat(80),
      sessionId,
    });
    const overLong = await useCase.execute({
      expected: completedExpectation,
      name: 'a'.repeat(81),
      sessionId,
    });

    expect(renamed(longest).name).toHaveLength(80);
    expect(refusal(overLong)).toBe('invalid-name');
    expect(sessions.writes).toHaveLength(1);
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['not a string', 42],
  ])('refuses a name that is %s and writes nothing', async (_label, name) => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      expected: completedExpectation,
      name,
      sessionId,
    });

    expect(refusal(outcome)).toBe('invalid-name');
    expect(sessions.writes).toHaveLength(0);
  });

  it('refuses a workout that no longer exists', async () => {
    const { sessions, useCase } = fixture(null);

    const outcome = await useCase.execute({
      expected: completedExpectation,
      name: 'Leg Day',
      sessionId,
    });

    expect(refusal(outcome)).toBe('not-found');
    expect(sessions.writes).toHaveLength(0);
  });

  it('refuses an identifier that is not a workout identifier', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      expected: completedExpectation,
      name: 'Leg Day',
      sessionId: 'not-an-identifier',
    });

    expect(refusal(outcome)).toBe('not-found');
    expect(sessions.writes).toHaveLength(0);
  });

  it('refuses a workout finished since the screen opened', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      expected: activeExpectation,
      name: 'Leg Day',
      sessionId,
    });

    expect(refusal(outcome)).toBe('changed');
    expect(sessions.writes).toHaveLength(0);
  });

  it('refuses a workout whose lifecycle instants moved', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      expected: {
        ...completedExpectation,
        completedAtEpochMilliseconds: completedAt + 1,
      },
      name: 'Leg Day',
      sessionId,
    });

    expect(refusal(outcome)).toBe('changed');
    expect(sessions.writes).toHaveLength(0);
  });

  it('refuses when the guarded write matches no row', async () => {
    const { sessions, useCase } = fixture();
    sessions.matchesLifecycle = false;

    const outcome = await useCase.execute({
      expected: completedExpectation,
      name: 'Leg Day',
      sessionId,
    });

    expect(refusal(outcome)).toBe('changed');
    expect(sessions.writes).toHaveLength(0);
  });

  it('leaves the stored workout untouched when the write fails', async () => {
    const { sessions, useCase } = fixture();
    sessions.failOnRename = true;
    const before = sessions.stored;

    await expect(
      useCase.execute({
        expected: completedExpectation,
        name: 'Leg Day',
        sessionId,
      }),
    ).rejects.toThrow('write failed');
    expect(sessions.stored).toBe(before);
    expect(sessions.stored?.name).toBe('Workout');
  });

  it('reports the lifecycle a loaded workout still holds', () => {
    expect(workoutSessionLifecycle(session())).toEqual(completedExpectation);
    expect(workoutSessionLifecycle(session('active', null))).toEqual(
      activeExpectation,
    );
  });
});
