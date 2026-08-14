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
  RemoveCompletedWorkoutExerciseUseCase,
  type CompletedExerciseRemovalContext,
  type CompletedExerciseRemovalOutcome,
} from './remove-completed-workout-exercise-use-case';

const sessionId = '550e8400-e29b-41d4-a716-446655440000';
const firstExerciseId = '550e8400-e29b-41d4-a716-446655440001';
const secondExerciseId = '550e8400-e29b-41d4-a716-446655440002';
const emptyExerciseId = '550e8400-e29b-41d4-a716-446655440003';
const startedAt = 1_700_000_000_000;
const completedAt = startedAt + 3_600_000;

function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function id(value: string) {
  return unwrap(DomainId.create(value));
}

function recordedSet(value: string, repetitions: number) {
  return unwrap(
    WorkoutSet.create({
      id: id(value),
      position: 0,
      result: RepetitionResult.valid(repetitions),
    }),
  );
}

function exercise(
  value: string,
  position: number,
  name: string,
  sets: readonly WorkoutSet[],
) {
  return unwrap(
    WorkoutSessionExercise.create({
      exerciseNameSnapshot: name,
      id: id(value),
      loggingModeSnapshot: 'repetitions',
      plannedPrescriptionSnapshot: null,
      position,
      sets,
      sourceExerciseDefinitionId: id('550e8400-e29b-41d4-a716-4466554400a0'),
      sourcePlannedExerciseId: null,
    }),
  );
}

function session(
  exercises: readonly WorkoutSessionExercise[],
  status: 'active' | 'completed' = 'completed',
  completed: number | null = completedAt,
) {
  return unwrap(
    WorkoutSession.create({
      completedAtEpochMilliseconds: completed,
      exercises,
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

const performed = () => [
  exercise(firstExerciseId, 0, 'Bench press', [
    recordedSet('550e8400-e29b-41d4-a716-4466554400b0', 8),
  ]),
  exercise(secondExerciseId, 1, 'Overhead press', [
    recordedSet('550e8400-e29b-41d4-a716-4466554400b1', 5),
  ]),
  exercise(emptyExerciseId, 2, 'Triceps extension', []),
];

class Sessions implements WorkoutSessionRepository {
  corrections: WorkoutSession[] = [];
  failOnCorrect = false;
  constructor(public stored: WorkoutSession | null) {}
  complete(value: WorkoutSession) {
    return Promise.resolve(value);
  }
  correctCompleted(value: WorkoutSession) {
    if (this.failOnCorrect) return Promise.reject(new Error('write failed'));
    this.corrections.push(value);
    this.stored = value;
    return Promise.resolve();
  }
  deleteCompleted() {
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
  replace() {
    return Promise.resolve();
  }
}

function fixture(stored: WorkoutSession | null = session(performed())) {
  const sessions = new Sessions(stored);
  const runner: TransactionRunner<CompletedExerciseRemovalContext> = {
    run: (operation) => operation({ sessions }),
  };
  return {
    sessions,
    useCase: new RemoveCompletedWorkoutExerciseUseCase(runner),
  };
}

const expected: CompletedWorkoutLifecycle = {
  completedAtEpochMilliseconds: completedAt,
  startedAtEpochMilliseconds: startedAt,
};

function refusal(outcome: CompletedExerciseRemovalOutcome) {
  if (outcome.status !== 'refused')
    throw new Error('Expected the removal to be refused');
  return outcome.reason;
}

function written(sessions: Sessions) {
  const last = sessions.corrections.at(-1);
  if (last === undefined) throw new Error('Expected a written aggregate');
  return last;
}

describe('RemoveCompletedWorkoutExerciseUseCase', () => {
  it('removes one exercise and renumbers the survivors from zero', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      exerciseId: firstExerciseId,
      expected,
      sessionId,
    });

    expect(outcome.status).toBe('removed');
    const stored = written(sessions);
    expect(stored.exercises.map((entry) => entry.id.value)).toEqual([
      secondExerciseId,
      emptyExerciseId,
    ]);
    expect(stored.exercises.map((entry) => entry.position)).toEqual([0, 1]);
  });

  it('preserves surviving snapshots and recorded sets', async () => {
    const { sessions, useCase } = fixture();

    await useCase.execute({
      exerciseId: firstExerciseId,
      expected,
      sessionId,
    });

    const survivor = written(sessions).exercises[0];
    expect(survivor?.exerciseNameSnapshot).toBe('Overhead press');
    expect(survivor?.loggingModeSnapshot).toBe('repetitions');
    expect(survivor?.sets.map((entry) => entry.id.value)).toEqual([
      '550e8400-e29b-41d4-a716-4466554400b1',
    ]);
  });

  it('leaves the parent lifecycle untouched', async () => {
    const { sessions, useCase } = fixture();

    await useCase.execute({
      exerciseId: firstExerciseId,
      expected,
      sessionId,
    });

    const stored = written(sessions);
    expect(stored.status).toBe('completed');
    expect(stored.name).toBe('Push day');
    expect(stored.startedAtEpochMilliseconds).toBe(startedAt);
    expect(stored.completedAtEpochMilliseconds).toBe(completedAt);
    expect(stored.startedLocalCalendarDate).toBe('2023-11-14');
  });

  it('removes an exercise that recorded nothing without touching recorded work', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      exerciseId: emptyExerciseId,
      expected,
      sessionId,
    });

    expect(outcome.status).toBe('removed');
    const stored = written(sessions);
    expect(stored.exercises).toHaveLength(2);
    expect(
      stored.exercises.reduce((count, entry) => count + entry.sets.length, 0),
    ).toBe(2);
  });

  it('refuses to remove the only exercise', async () => {
    const only = exercise(firstExerciseId, 0, 'Bench press', [
      recordedSet('550e8400-e29b-41d4-a716-4466554400b0', 8),
    ]);
    const { sessions, useCase } = fixture(session([only]));

    const outcome = await useCase.execute({
      exerciseId: firstExerciseId,
      expected,
      sessionId,
    });

    expect(refusal(outcome)).toBe('would-empty-workout');
    expect(sessions.corrections).toEqual([]);
  });

  it('refuses a removal that would leave no recorded set', async () => {
    const { sessions, useCase } = fixture(
      session([
        exercise(firstExerciseId, 0, 'Bench press', [
          recordedSet('550e8400-e29b-41d4-a716-4466554400b0', 8),
        ]),
        exercise(emptyExerciseId, 1, 'Triceps extension', []),
      ]),
    );

    const outcome = await useCase.execute({
      exerciseId: firstExerciseId,
      expected,
      sessionId,
    });

    expect(refusal(outcome)).toBe('would-empty-workout');
    expect(sessions.corrections).toEqual([]);
  });

  it('reports a missing workout as no longer available', async () => {
    const { sessions, useCase } = fixture(null);

    const outcome = await useCase.execute({
      exerciseId: firstExerciseId,
      expected,
      sessionId,
    });

    expect(refusal(outcome)).toBe('not-found');
    expect(sessions.corrections).toEqual([]);
  });

  it('refuses an active session so removal cannot reach a live workout', async () => {
    const { sessions, useCase } = fixture(session(performed(), 'active', null));

    const outcome = await useCase.execute({
      exerciseId: firstExerciseId,
      expected,
      sessionId,
    });

    expect(refusal(outcome)).toBe('not-completed');
    expect(sessions.corrections).toEqual([]);
  });

  it('reports an exercise that is no longer part of the workout', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      exerciseId: '550e8400-e29b-41d4-a716-4466554400ff',
      expected,
      sessionId,
    });

    expect(refusal(outcome)).toBe('exercise-not-found');
    expect(sessions.corrections).toEqual([]);
  });

  it('refuses an invalid workout identifier without reaching storage', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      exerciseId: firstExerciseId,
      expected,
      sessionId: 'not-a-uuid',
    });

    expect(refusal(outcome)).toBe('not-found');
    expect(sessions.corrections).toEqual([]);
  });

  it('refuses an invalid exercise identifier without reaching storage', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      exerciseId: 'not-a-uuid',
      expected,
      sessionId,
    });

    expect(refusal(outcome)).toBe('exercise-not-found');
    expect(sessions.corrections).toEqual([]);
  });

  it('refuses when the stored completion instant differs from the loaded one', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      exerciseId: firstExerciseId,
      expected: {
        completedAtEpochMilliseconds: completedAt + 1,
        startedAtEpochMilliseconds: startedAt,
      },
      sessionId,
    });

    expect(refusal(outcome)).toBe('changed');
    expect(sessions.corrections).toEqual([]);
  });

  it('refuses when the stored start instant differs from the loaded one', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute({
      exerciseId: firstExerciseId,
      expected: {
        completedAtEpochMilliseconds: completedAt,
        startedAtEpochMilliseconds: startedAt - 1,
      },
      sessionId,
    });

    expect(refusal(outcome)).toBe('changed');
    expect(sessions.corrections).toEqual([]);
  });

  it('reports a repeated removal of the same exercise as no longer part of the workout', async () => {
    const { sessions, useCase } = fixture();

    const first = await useCase.execute({
      exerciseId: firstExerciseId,
      expected,
      sessionId,
    });
    const second = await useCase.execute({
      exerciseId: firstExerciseId,
      expected,
      sessionId,
    });

    expect(first.status).toBe('removed');
    expect(refusal(second)).toBe('exercise-not-found');
    expect(sessions.corrections).toHaveLength(1);
  });

  it('preserves the stored workout when the write fails', async () => {
    const { sessions, useCase } = fixture();
    sessions.failOnCorrect = true;

    await expect(
      useCase.execute({ exerciseId: firstExerciseId, expected, sessionId }),
    ).rejects.toThrow();

    expect(sessions.stored?.exercises).toHaveLength(3);
    expect(sessions.corrections).toEqual([]);
  });
});
