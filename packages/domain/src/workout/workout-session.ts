import { DomainError } from '../shared/domain-error';
import { DomainId } from '../shared/domain-id';
import { err, ok, type Result } from '../shared/result';
import type { ExerciseLoggingMode } from './exercise-definition';
import {
  isPlannedPrescription,
  type PlannedPrescription,
} from './planned-prescription';
import { Weekday } from './weekday';
import { isWorkoutResult, type WorkoutResult } from './workout-result';

export const workoutSessionPolicy = Object.freeze({
  maximumExercises: 100,
  maximumNameLength: 80,
  maximumSetsPerExercise: 100,
});

export type WorkoutSessionStatus = 'active' | 'completed';

export class WorkoutSet {
  private constructor(
    readonly id: DomainId,
    readonly position: number,
    readonly result: WorkoutResult,
  ) {
    Object.freeze(this);
  }

  static create(
    input: Readonly<{ id: unknown; position: unknown; result: unknown }>,
  ) {
    if (!(input.id instanceof DomainId)) return invalidId('id');
    if (!isPosition(input.position))
      return invalid('position', 'Set position is invalid.');
    if (!isWorkoutResult(input.result))
      return invalid('result', 'Workout result is invalid.');
    return ok(new WorkoutSet(input.id, input.position, input.result));
  }
}

export class WorkoutSessionExercise {
  private constructor(
    readonly id: DomainId,
    readonly sourceExerciseDefinitionId: DomainId,
    readonly sourcePlannedExerciseId: DomainId | null,
    readonly position: number,
    readonly exerciseNameSnapshot: string,
    readonly loggingModeSnapshot: ExerciseLoggingMode,
    readonly plannedPrescriptionSnapshot: PlannedPrescription | null,
    readonly sets: readonly WorkoutSet[],
  ) {
    Object.freeze(this);
  }

  static create(
    input: Readonly<{
      exerciseNameSnapshot: unknown;
      id: unknown;
      loggingModeSnapshot: ExerciseLoggingMode;
      plannedPrescriptionSnapshot: unknown;
      position: unknown;
      sets: unknown;
      sourceExerciseDefinitionId: unknown;
      sourcePlannedExerciseId: unknown;
    }>,
  ): Result<WorkoutSessionExercise, DomainError> {
    if (!(input.id instanceof DomainId)) return invalidId('id');
    if (!(input.sourceExerciseDefinitionId instanceof DomainId))
      return invalidId('sourceExerciseDefinitionId');
    if (
      input.sourcePlannedExerciseId !== null &&
      !(input.sourcePlannedExerciseId instanceof DomainId)
    )
      return invalidId('sourcePlannedExerciseId');
    if (!isPosition(input.position))
      return invalid('position', 'Exercise position is invalid.');
    if (typeof input.exerciseNameSnapshot !== 'string')
      return invalid('exerciseNameSnapshot', 'Exercise snapshot is invalid.');
    const name = input.exerciseNameSnapshot.trim();
    if (name === '' || name.length > workoutSessionPolicy.maximumNameLength)
      return invalid('exerciseNameSnapshot', 'Exercise snapshot is invalid.');
    if (
      input.plannedPrescriptionSnapshot !== null &&
      !isPlannedPrescription(input.plannedPrescriptionSnapshot)
    )
      return invalid(
        'plannedPrescriptionSnapshot',
        'Planned target snapshot is invalid.',
      );
    if (
      !Array.isArray(input.sets) ||
      input.sets.length > workoutSessionPolicy.maximumSetsPerExercise
    )
      return invalidSets();
    const sets = input.sets as readonly unknown[];
    if (
      !sets.every((set) => set instanceof WorkoutSet) ||
      sets.some((set, index) => set.position !== index) ||
      new Set(sets.map((set) => set.id.value)).size !== sets.length ||
      sets.some(
        (set) =>
          !isResultCompatible(input.loggingModeSnapshot, set.result.kind),
      )
    )
      return invalidSets();
    return ok(
      new WorkoutSessionExercise(
        input.id,
        input.sourceExerciseDefinitionId,
        input.sourcePlannedExerciseId,
        input.position,
        name,
        input.loggingModeSnapshot,
        input.plannedPrescriptionSnapshot,
        Object.freeze([...sets]),
      ),
    );
  }
}

export class WorkoutSession {
  private constructor(
    readonly id: DomainId,
    readonly name: string,
    readonly status: WorkoutSessionStatus,
    readonly startedAtEpochMilliseconds: number,
    readonly startedLocalCalendarDate: string,
    readonly startedUtcOffsetMinutes: number,
    readonly completedAtEpochMilliseconds: number | null,
    readonly sourcePlannedWorkoutId: DomainId | null,
    readonly sourceWeekday: Weekday | null,
    readonly exercises: readonly WorkoutSessionExercise[],
  ) {
    Object.freeze(this);
  }

  static create(
    input: Readonly<{
      completedAtEpochMilliseconds: unknown;
      exercises: unknown;
      id: unknown;
      name: unknown;
      sourcePlannedWorkoutId: unknown;
      sourceWeekday: unknown;
      startedAtEpochMilliseconds: unknown;
      startedLocalCalendarDate: unknown;
      startedUtcOffsetMinutes: unknown;
      status: unknown;
    }>,
  ): Result<WorkoutSession, DomainError> {
    if (!(input.id instanceof DomainId)) return invalidId('id');
    if (typeof input.name !== 'string')
      return invalid('name', 'Workout name is required.');
    const name = input.name.trim();
    if (name === '' || name.length > workoutSessionPolicy.maximumNameLength)
      return invalid('name', 'Workout name is invalid.');
    if (input.status !== 'active' && input.status !== 'completed')
      return invalid('status', 'Workout status is invalid.');
    if (!isEpoch(input.startedAtEpochMilliseconds))
      return invalid(
        'startedAtEpochMilliseconds',
        'Workout start time is invalid.',
      );
    if (!isLocalDate(input.startedLocalCalendarDate))
      return invalid(
        'startedLocalCalendarDate',
        'Workout local date is invalid.',
      );
    if (
      !Number.isInteger(input.startedUtcOffsetMinutes) ||
      (input.startedUtcOffsetMinutes as number) < -840 ||
      (input.startedUtcOffsetMinutes as number) > 840
    )
      return invalid(
        'startedUtcOffsetMinutes',
        'Workout time zone offset is invalid.',
      );
    if (
      input.sourcePlannedWorkoutId !== null &&
      !(input.sourcePlannedWorkoutId instanceof DomainId)
    )
      return invalidId('sourcePlannedWorkoutId');
    if (
      input.sourceWeekday !== null &&
      !(input.sourceWeekday instanceof Weekday)
    )
      return invalid('sourceWeekday', 'Workout source day is invalid.');
    if (
      (input.sourcePlannedWorkoutId === null) !==
      (input.sourceWeekday === null)
    )
      return invalid(
        'sourcePlannedWorkoutId',
        'Workout plan source is invalid.',
      );
    if (
      !Array.isArray(input.exercises) ||
      input.exercises.length > workoutSessionPolicy.maximumExercises
    )
      return invalidExercises();
    const exercises = input.exercises as readonly unknown[];
    if (
      !exercises.every(
        (exercise) => exercise instanceof WorkoutSessionExercise,
      ) ||
      exercises.some((exercise, index) => exercise.position !== index) ||
      new Set(exercises.map((exercise) => exercise.id.value)).size !==
        exercises.length
    )
      return invalidExercises();
    const completedAt = input.completedAtEpochMilliseconds;
    const actualSetCount = exercises.reduce(
      (count, exercise) => count + exercise.sets.length,
      0,
    );
    if (
      (input.status === 'active' && completedAt !== null) ||
      (input.status === 'completed' &&
        (!isEpoch(completedAt) ||
          completedAt < input.startedAtEpochMilliseconds ||
          actualSetCount === 0))
    )
      return invalid(
        'completedAtEpochMilliseconds',
        'Workout completion is invalid.',
      );
    return ok(
      new WorkoutSession(
        input.id,
        name,
        input.status,
        input.startedAtEpochMilliseconds,
        input.startedLocalCalendarDate,
        input.startedUtcOffsetMinutes as number,
        completedAt as number | null,
        input.sourcePlannedWorkoutId,
        input.sourceWeekday,
        Object.freeze([...exercises]),
      ),
    );
  }
}

function isResultCompatible(
  mode: ExerciseLoggingMode,
  kind: WorkoutResult['kind'],
) {
  if (mode === 'repetitions' || mode === 'bodyweight-and-repetitions')
    return kind === 'repetitions';
  if (
    mode === 'external-load-and-repetitions' ||
    mode === 'bodyweight-plus-load-and-repetitions' ||
    mode === 'assistance-and-repetitions'
  )
    return kind === 'resistance-and-repetitions';
  return mode === kind;
}

function isPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isEpoch(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}

function invalidId(field: string): Result<never, DomainError> {
  return err(
    DomainError.create('invalid-identifier', 'Identifier is invalid.', field),
  );
}

function invalid(field: string, message: string): Result<never, DomainError> {
  return err(DomainError.create('unsupported-option', message, field));
}

function invalidSets(): Result<never, DomainError> {
  return invalid('sets', 'Workout sets are invalid.');
}

function invalidExercises(): Result<never, DomainError> {
  return invalid('exercises', 'Workout exercises are invalid.');
}
