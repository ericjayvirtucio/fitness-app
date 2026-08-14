import {
  createWorkoutResult,
  DomainId,
  Mass,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  workoutSessionPolicy,
  type Result,
  type WorkoutResult,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type { WorkoutSessionRepository } from '../../workout-session/application/workout-session-repository';
import {
  CorrectCompletedWorkoutSetUseCase,
  fingerprintRecordedSet,
  type CompletedSetCorrectionOutcome,
  type CompletedWorkoutCorrectionContext,
} from './correct-completed-workout-set-use-case';

const sessionId = '550e8400-e29b-41d4-a716-446655440000';
const exerciseId = '550e8400-e29b-41d4-a716-446655440001';
const firstSetId = '550e8400-e29b-41d4-a716-446655440002';
const secondSetId = '550e8400-e29b-41d4-a716-446655440003';
const generatedSetId = '550e8400-e29b-41d4-a716-446655440009';
const startedAt = 1_700_000_000_000;
const completedAt = startedAt + 3_600_000;

function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function id(value: string) {
  return unwrap(DomainId.create(value));
}

function set(value: string, position: number, result: WorkoutResult) {
  return unwrap(WorkoutSet.create({ id: id(value), position, result }));
}

function completedSession(
  sets: readonly WorkoutSet[] = [
    set(firstSetId, 0, RepetitionResult.valid(8)),
    set(secondSetId, 1, RepetitionResult.valid(6)),
  ],
  extraExercises: readonly WorkoutSessionExercise[] = [],
) {
  const exercise = unwrap(
    WorkoutSessionExercise.create({
      exerciseNameSnapshot: 'Bench press',
      id: id(exerciseId),
      loggingModeSnapshot: 'repetitions',
      plannedPrescriptionSnapshot: null,
      position: 0,
      sets,
      sourceExerciseDefinitionId: id('550e8400-e29b-41d4-a716-446655440004'),
      sourcePlannedExerciseId: null,
    }),
  );
  return unwrap(
    WorkoutSession.create({
      completedAtEpochMilliseconds: completedAt,
      exercises: [exercise, ...extraExercises],
      id: id(sessionId),
      name: 'Push day',
      sourcePlannedWorkoutId: null,
      sourceWeekday: null,
      startedAtEpochMilliseconds: startedAt,
      startedLocalCalendarDate: '2023-11-14',
      startedUtcOffsetMinutes: -480,
      status: 'completed',
    }),
  );
}

class Sessions implements WorkoutSessionRepository {
  corrections: WorkoutSession[] = [];
  failOnCorrect = false;
  constructor(public stored: WorkoutSession | null) {}
  complete(session: WorkoutSession) {
    return Promise.resolve(session);
  }
  correctCompleted(session: WorkoutSession) {
    if (this.failOnCorrect) return Promise.reject(new Error('write failed'));
    this.corrections.push(session);
    this.stored = session;
    return Promise.resolve();
  }
  deleteCompleted() {
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
  replace() {
    return Promise.resolve();
  }
}

function fixture(stored: WorkoutSession | null = completedSession()) {
  const sessions = new Sessions(stored);
  const runner: TransactionRunner<CompletedWorkoutCorrectionContext> = {
    run: (operation) => operation({ sessions }),
  };
  let generated = 0;
  return {
    sessions,
    useCase: new CorrectCompletedWorkoutSetUseCase(runner, () => {
      generated += 1;
      return generated === 1
        ? generatedSetId
        : `550e8400-e29b-41d4-a716-${String(generated).padStart(12, '0')}`;
    }),
  };
}

function repetitions(value: number) {
  return unwrap(
    createWorkoutResult({ loggingMode: 'repetitions', repetitions: value }),
  );
}

function currentFingerprint(session: WorkoutSession, index: number) {
  const target = session.exercises[0]?.sets[index];
  if (!target) throw new Error('Invalid fixture');
  return fingerprintRecordedSet(target.result);
}

function corrected(outcome: CompletedSetCorrectionOutcome) {
  if (outcome.status !== 'corrected')
    throw new Error(`Expected a correction, got ${outcome.reason}`);
  return outcome.session;
}

function refusal(outcome: CompletedSetCorrectionOutcome) {
  if (outcome.status !== 'refused')
    throw new Error('Expected the correction to be refused');
  return outcome.reason;
}

describe('CorrectCompletedWorkoutSetUseCase', () => {
  describe('editing a recorded set', () => {
    it('corrects the result while preserving identity, position, and lifecycle', async () => {
      const { sessions, useCase } = fixture();
      const stored = completedSession();

      const session = corrected(
        await useCase.editSet({
          exerciseId,
          expected: currentFingerprint(stored, 0),
          result: repetitions(5),
          sessionId,
          setId: firstSetId,
        }),
      );

      const sets = session.exercises[0]?.sets ?? [];
      expect(sets.map((entry) => entry.id.value)).toEqual([
        firstSetId,
        secondSetId,
      ]);
      expect(sets.map((entry) => entry.position)).toEqual([0, 1]);
      expect(sets[0]?.result).toMatchObject({ repetitions: 5 });
      expect(session.status).toBe('completed');
      expect(session.completedAtEpochMilliseconds).toBe(completedAt);
      expect(session.startedAtEpochMilliseconds).toBe(startedAt);
      expect(session.startedLocalCalendarDate).toBe('2023-11-14');
      expect(session.startedUtcOffsetMinutes).toBe(-480);
      expect(session.name).toBe('Push day');
      expect(session.exercises[0]?.exerciseNameSnapshot).toBe('Bench press');
      expect(session.exercises[0]?.loggingModeSnapshot).toBe('repetitions');
      expect(sessions.corrections).toHaveLength(1);
    });

    it('refuses a result that does not match the captured logging mode', async () => {
      const { sessions, useCase } = fixture();
      const stored = completedSession();
      const loaded = unwrap(
        createWorkoutResult({
          loggingMode: 'external-load-and-repetitions',
          repetitions: 5,
          resistance: unwrap(Mass.create(60, 'kilogram')),
        }),
      );

      const outcome = await useCase.editSet({
        exerciseId,
        expected: currentFingerprint(stored, 0),
        result: loaded,
        sessionId,
        setId: firstSetId,
      });

      expect(refusal(outcome)).toBe('invalid-result');
      expect(sessions.corrections).toHaveLength(0);
    });

    it('refuses when the stored set no longer holds the loaded values', async () => {
      const { sessions, useCase } = fixture();

      const outcome = await useCase.editSet({
        exerciseId,
        expected: fingerprintRecordedSet(RepetitionResult.valid(99)),
        result: repetitions(5),
        sessionId,
        setId: firstSetId,
      });

      expect(refusal(outcome)).toBe('changed');
      expect(sessions.corrections).toHaveLength(0);
    });

    it('refuses a second submission of the same correction', async () => {
      const { useCase } = fixture();
      const stored = completedSession();
      const expected = currentFingerprint(stored, 0);

      const first = await useCase.editSet({
        exerciseId,
        expected,
        result: repetitions(5),
        sessionId,
        setId: firstSetId,
      });
      const second = await useCase.editSet({
        exerciseId,
        expected,
        result: repetitions(5),
        sessionId,
        setId: firstSetId,
      });

      expect(first.status).toBe('corrected');
      expect(refusal(second)).toBe('changed');
    });

    it('leaves the stored history in place when persistence fails', async () => {
      const { sessions, useCase } = fixture();
      sessions.failOnCorrect = true;
      const stored = completedSession();

      await expect(
        useCase.editSet({
          exerciseId,
          expected: currentFingerprint(stored, 0),
          result: repetitions(5),
          sessionId,
          setId: firstSetId,
        }),
      ).rejects.toThrow();
      expect(sessions.stored?.exercises[0]?.sets[0]?.result).toMatchObject({
        repetitions: 8,
      });
    });
  });

  describe('adding a missing set', () => {
    it('appends the injected identifier at the next position', async () => {
      const { useCase } = fixture();

      const session = corrected(
        await useCase.addSet({ exerciseId, result: repetitions(4), sessionId }),
      );

      const sets = session.exercises[0]?.sets ?? [];
      expect(sets.map((entry) => entry.id.value)).toEqual([
        firstSetId,
        secondSetId,
        generatedSetId,
      ]);
      expect(sets.map((entry) => entry.position)).toEqual([0, 1, 2]);
      expect(sets[2]?.result).toMatchObject({ repetitions: 4 });
    });

    it('refuses to exceed the maximum number of recorded sets', async () => {
      const full = Array.from(
        { length: workoutSessionPolicy.maximumSetsPerExercise },
        (_, position) =>
          set(
            `550e8400-e29b-41d4-a716-${String(position + 100).padStart(12, '0')}`,
            position,
            RepetitionResult.valid(1),
          ),
      );
      const { sessions, useCase } = fixture(completedSession(full));

      const outcome = await useCase.addSet({
        exerciseId,
        result: repetitions(4),
        sessionId,
      });

      expect(refusal(outcome)).toBe('exercise-full');
      expect(sessions.corrections).toHaveLength(0);
    });
  });

  describe('deleting a recorded set', () => {
    it('removes the chosen set and renumbers the survivors', async () => {
      const { useCase } = fixture();
      const stored = completedSession();

      const session = corrected(
        await useCase.deleteSet({
          exerciseId,
          expected: currentFingerprint(stored, 0),
          sessionId,
          setId: firstSetId,
        }),
      );

      const sets = session.exercises[0]?.sets ?? [];
      expect(sets.map((entry) => entry.id.value)).toEqual([secondSetId]);
      expect(sets.map((entry) => entry.position)).toEqual([0]);
    });

    it('refuses to leave the completed workout with no recorded sets', async () => {
      const only = [set(firstSetId, 0, RepetitionResult.valid(8))];
      const { sessions, useCase } = fixture(completedSession(only));
      const stored = completedSession(only);

      const outcome = await useCase.deleteSet({
        exerciseId,
        expected: currentFingerprint(stored, 0),
        sessionId,
        setId: firstSetId,
      });

      expect(refusal(outcome)).toBe('would-empty-workout');
      expect(sessions.corrections).toHaveLength(0);
    });

    it('allows emptying one exercise while another still holds recorded work', async () => {
      const other = unwrap(
        WorkoutSessionExercise.create({
          exerciseNameSnapshot: 'Row',
          id: id('550e8400-e29b-41d4-a716-446655440007'),
          loggingModeSnapshot: 'repetitions',
          plannedPrescriptionSnapshot: null,
          position: 1,
          sets: [
            set(
              '550e8400-e29b-41d4-a716-446655440008',
              0,
              RepetitionResult.valid(10),
            ),
          ],
          sourceExerciseDefinitionId: id(
            '550e8400-e29b-41d4-a716-446655440005',
          ),
          sourcePlannedExerciseId: null,
        }),
      );
      const only = [set(firstSetId, 0, RepetitionResult.valid(8))];
      const { useCase } = fixture(completedSession(only, [other]));
      const stored = completedSession(only, [other]);

      const session = corrected(
        await useCase.deleteSet({
          exerciseId,
          expected: currentFingerprint(stored, 0),
          sessionId,
          setId: firstSetId,
        }),
      );

      expect(session.exercises).toHaveLength(2);
      expect(session.exercises[0]?.sets).toHaveLength(0);
      expect(session.exercises[1]?.sets).toHaveLength(1);
    });
  });

  describe('refusals that protect history', () => {
    it('refuses a workout that no longer exists', async () => {
      const { useCase } = fixture(null);
      expect(
        refusal(
          await useCase.addSet({
            exerciseId,
            result: repetitions(4),
            sessionId,
          }),
        ),
      ).toBe('not-found');
    });

    it('refuses a workout that is not completed', async () => {
      const active = unwrap(
        WorkoutSession.create({
          ...completedSession(),
          completedAtEpochMilliseconds: null,
          status: 'active',
        }),
      );
      const { useCase } = fixture(active);
      expect(
        refusal(
          await useCase.addSet({
            exerciseId,
            result: repetitions(4),
            sessionId,
          }),
        ),
      ).toBe('not-completed');
    });

    it('refuses an unknown workout identifier without opening a transaction', async () => {
      const { sessions, useCase } = fixture();
      expect(
        refusal(
          await useCase.addSet({
            exerciseId,
            result: repetitions(4),
            sessionId: 'not-a-uuid',
          }),
        ),
      ).toBe('not-found');
      expect(sessions.corrections).toHaveLength(0);
    });

    it('refuses an exercise that is not part of the completed workout', async () => {
      const { useCase } = fixture();
      expect(
        refusal(
          await useCase.addSet({
            exerciseId: '550e8400-e29b-41d4-a716-446655440099',
            result: repetitions(4),
            sessionId,
          }),
        ),
      ).toBe('exercise-not-found');
    });

    it('refuses a set that is no longer recorded', async () => {
      const { useCase } = fixture();
      const stored = completedSession();
      expect(
        refusal(
          await useCase.editSet({
            exerciseId,
            expected: currentFingerprint(stored, 0),
            result: repetitions(5),
            sessionId,
            setId: '550e8400-e29b-41d4-a716-446655440098',
          }),
        ),
      ).toBe('set-not-found');
    });
  });
});
