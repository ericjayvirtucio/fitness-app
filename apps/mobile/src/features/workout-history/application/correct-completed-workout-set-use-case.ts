import {
  DomainId,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  workoutSessionPolicy,
  type WorkoutResult,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type { WorkoutSessionRepository } from '../../workout-session/application/workout-session-repository';

export type CompletedWorkoutCorrectionContext = Readonly<{
  sessions: WorkoutSessionRepository;
}>;

/**
 * Why a correction was refused. Every reason maps to one fixed sentence in
 * presentation, so no message can carry a name, a value, a date, or an
 * identifier.
 */
export type CompletedSetCorrectionRefusal =
  | 'changed'
  | 'exercise-full'
  | 'exercise-not-found'
  | 'invalid-result'
  | 'not-completed'
  | 'not-found'
  | 'set-not-found'
  | 'would-empty-workout';

export type CompletedSetCorrectionOutcome =
  | Readonly<{ session: WorkoutSession; status: 'corrected' }>
  | Readonly<{ reason: CompletedSetCorrectionRefusal; status: 'refused' }>;

/**
 * The canonical numbers a screen loaded for the set it is correcting.
 *
 * Comparing them inside the transaction stops a screen left open through
 * another correction, a restore, or a replacement from silently overwriting a
 * newer recorded fact. It needs no stored timestamp, revision, or version.
 */
export type RecordedSetFingerprint = Readonly<{
  distanceMillimeters: number | null;
  durationSeconds: number | null;
  kind: WorkoutResult['kind'];
  repetitions: number | null;
  repsInReserve: number | null;
  resistanceGrams: number | null;
}>;

/**
 * Reps in reserve is part of what a set records now, so a screen holding a
 * stale fingerprint must not silently overwrite a value someone else changed,
 * exactly as it already could not for the mechanical result.
 */
export function fingerprintRecordedSet(
  set: WorkoutSet,
): RecordedSetFingerprint {
  const { result } = set;
  return Object.freeze({
    distanceMillimeters:
      'distance' in result ? result.distance.millimeters : null,
    durationSeconds: 'duration' in result ? result.duration.seconds : null,
    kind: result.kind,
    repetitions: 'repetitions' in result ? result.repetitions : null,
    repsInReserve: set.repsInReserve,
    resistanceGrams: 'resistance' in result ? result.resistance.grams : null,
  });
}

export type EditRecordedSetInput = Readonly<{
  exerciseId: unknown;
  expected: RecordedSetFingerprint;
  repsInReserve: number | null;
  result: WorkoutResult;
  sessionId: unknown;
  setId: unknown;
}>;

export type AddMissingSetInput = Readonly<{
  exerciseId: unknown;
  repsInReserve: number | null;
  result: WorkoutResult;
  sessionId: unknown;
}>;

export type DeleteRecordedSetInput = Readonly<{
  exerciseId: unknown;
  expected: RecordedSetFingerprint;
  sessionId: unknown;
  setId: unknown;
}>;

type CorrectedSets =
  | Readonly<{ sets: readonly WorkoutSet[]; status: 'changed' }>
  | Readonly<{ reason: CompletedSetCorrectionRefusal; status: 'refused' }>;

/**
 * The only way a completed workout's recorded results may change.
 *
 * Workout History owns this workflow because the correction starts from
 * completed history, while Workout Session keeps ownership of writes to its own
 * aggregate through `correctCompleted`. The corrected aggregate is always built
 * by spreading the loaded one, so no lifecycle field and no captured snapshot
 * has a path to change.
 */
export class CorrectCompletedWorkoutSetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<CompletedWorkoutCorrectionContext>,
    private readonly generateId: () => string,
  ) {}

  editSet(input: EditRecordedSetInput): Promise<CompletedSetCorrectionOutcome> {
    return this.correct(input.sessionId, input.exerciseId, (exercise) =>
      withTargetSet(exercise, input.setId, input.expected, (target) => {
        const corrected = WorkoutSet.create({
          id: target.id,
          position: target.position,
          repsInReserve: input.repsInReserve,
          result: input.result,
        });
        if (!corrected.isSuccess) return refused('invalid-result');
        return changed(
          exercise.sets.map((set) =>
            set.id.equals(target.id) ? corrected.value : set,
          ),
        );
      }),
    );
  }

  addSet(input: AddMissingSetInput): Promise<CompletedSetCorrectionOutcome> {
    return this.correct(input.sessionId, input.exerciseId, (exercise) => {
      if (exercise.sets.length >= workoutSessionPolicy.maximumSetsPerExercise)
        return refused('exercise-full');
      const added = WorkoutSet.create({
        id: requiredId(this.generateId()),
        position: exercise.sets.length,
        repsInReserve: input.repsInReserve,
        result: input.result,
      });
      return added.isSuccess
        ? changed([...exercise.sets, added.value])
        : refused('invalid-result');
    });
  }

  deleteSet(
    input: DeleteRecordedSetInput,
  ): Promise<CompletedSetCorrectionOutcome> {
    return this.correct(input.sessionId, input.exerciseId, (exercise) =>
      withTargetSet(exercise, input.setId, input.expected, (target) =>
        renumber(exercise.sets.filter((set) => !set.id.equals(target.id))),
      ),
    );
  }

  private correct(
    sessionId: unknown,
    exerciseId: unknown,
    change: (exercise: WorkoutSessionExercise) => CorrectedSets,
  ): Promise<CompletedSetCorrectionOutcome> {
    const session = DomainId.create(sessionId);
    if (!session.isSuccess) return Promise.resolve(refused('not-found'));
    const exercise = DomainId.create(exerciseId);
    if (!exercise.isSuccess)
      return Promise.resolve(refused('exercise-not-found'));
    return this.transactionRunner.run(async ({ sessions }) => {
      const stored = await sessions.getById(session.value);
      if (stored === null) return refused('not-found');
      if (stored.status !== 'completed') return refused('not-completed');
      const index = stored.exercises.findIndex((candidate) =>
        candidate.id.equals(exercise.value),
      );
      const target = stored.exercises[index];
      if (target === undefined) return refused('exercise-not-found');
      const corrected = change(target);
      if (corrected.status === 'refused') return corrected;
      if (performedSetCount(stored, index, corrected.sets) === 0)
        return refused('would-empty-workout');
      const rebuiltExercise = WorkoutSessionExercise.create({
        ...target,
        sets: corrected.sets,
      });
      if (!rebuiltExercise.isSuccess) return refused('invalid-result');
      const exercises = [...stored.exercises];
      exercises[index] = rebuiltExercise.value;
      const rebuilt = WorkoutSession.create({ ...stored, exercises });
      if (!rebuilt.isSuccess) return refused('invalid-result');
      await sessions.correctCompleted(rebuilt.value);
      return Object.freeze({
        session: rebuilt.value,
        status: 'corrected' as const,
      });
    });
  }
}

function withTargetSet(
  exercise: WorkoutSessionExercise,
  setId: unknown,
  expected: RecordedSetFingerprint,
  change: (target: WorkoutSet) => CorrectedSets,
): CorrectedSets {
  const id = DomainId.create(setId);
  if (!id.isSuccess) return refused('set-not-found');
  const target = exercise.sets.find((set) => set.id.equals(id.value));
  if (target === undefined) return refused('set-not-found');
  return matchesFingerprint(target, expected)
    ? change(target)
    : refused('changed');
}

function matchesFingerprint(
  set: WorkoutSet,
  expected: RecordedSetFingerprint,
): boolean {
  const actual = fingerprintRecordedSet(set);
  return (
    actual.kind === expected.kind &&
    actual.repetitions === expected.repetitions &&
    actual.resistanceGrams === expected.resistanceGrams &&
    actual.durationSeconds === expected.durationSeconds &&
    actual.distanceMillimeters === expected.distanceMillimeters &&
    actual.repsInReserve === expected.repsInReserve
  );
}

/**
 * Survivors keep their identifiers and take contiguous positions, because the
 * aggregate refuses a gap and stored history must never depend on row order.
 */
function renumber(sets: readonly WorkoutSet[]): CorrectedSets {
  const renumbered: WorkoutSet[] = [];
  for (const [position, set] of sets.entries()) {
    const rebuilt = WorkoutSet.create({
      id: set.id,
      position,
      repsInReserve: set.repsInReserve,
      result: set.result,
    });
    if (!rebuilt.isSuccess) return refused('invalid-result');
    renumbered.push(rebuilt.value);
  }
  return changed(renumbered);
}

function performedSetCount(
  session: WorkoutSession,
  correctedIndex: number,
  correctedSets: readonly WorkoutSet[],
): number {
  return session.exercises.reduce(
    (count, exercise, index) =>
      count +
      (index === correctedIndex ? correctedSets.length : exercise.sets.length),
    0,
  );
}

function requiredId(value: string): DomainId {
  const id = DomainId.create(value);
  if (!id.isSuccess)
    throw new Error('Identifier generator returned an invalid UUID.');
  return id.value;
}

function changed(sets: readonly WorkoutSet[]): CorrectedSets {
  return Object.freeze({ sets, status: 'changed' as const });
}

function refused(
  reason: CompletedSetCorrectionRefusal,
): Readonly<{ reason: CompletedSetCorrectionRefusal; status: 'refused' }> {
  return Object.freeze({ reason, status: 'refused' as const });
}
