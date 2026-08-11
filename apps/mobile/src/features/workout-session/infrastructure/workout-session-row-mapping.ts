import {
  DomainId,
  Duration,
  Length,
  Mass,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  Weekday,
  createPlannedPrescription,
  createWorkoutResult,
  type ExerciseLoggingMode,
  type PlannedPrescription,
  type WorkoutResult,
} from '@fitness/domain';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';

export type SessionRow = Readonly<{
  completed_at_epoch_ms: number | null;
  display_name: string;
  id: string;
  source_planned_workout_id: string | null;
  source_weekday: number | null;
  started_at_epoch_ms: number;
  started_local_calendar_date: string;
  started_utc_offset_minutes: number;
  status: string;
}>;

export type ExerciseRow = Readonly<{
  exercise_name_snapshot: string;
  id: string;
  logging_mode_snapshot: ExerciseLoggingMode;
  planned_distance_millimeters: number | null;
  planned_duration_seconds: number | null;
  planned_kind: PlannedPrescription['kind'] | null;
  planned_repetitions: number | null;
  planned_resistance_grams: number | null;
  planned_sets: number | null;
  position: number;
  source_exercise_definition_id: string;
  source_planned_exercise_id: string | null;
  workout_session_id: string;
}>;

export type SetRow = Readonly<{
  distance_millimeters: number | null;
  duration_seconds: number | null;
  id: string;
  position: number;
  repetitions: number | null;
  resistance_grams: number | null;
  result_kind: WorkoutResult['kind'];
  workout_session_exercise_id: string;
}>;

export function mapSession(
  row: SessionRow,
  exerciseRows: readonly ExerciseRow[],
  setRows: readonly SetRow[],
): WorkoutSession {
  const sourceWeekday =
    row.source_weekday === null ? null : Weekday.create(row.source_weekday);
  if (sourceWeekday !== null && !sourceWeekday.isSuccess) return corrupt();
  const session = WorkoutSession.create({
    completedAtEpochMilliseconds: row.completed_at_epoch_ms,
    exercises: exerciseRows.map((exercise) =>
      mapExercise(
        exercise,
        setRows.filter(
          (set) => set.workout_session_exercise_id === exercise.id,
        ),
      ),
    ),
    id: requiredId(row.id),
    name: row.display_name,
    sourcePlannedWorkoutId:
      row.source_planned_workout_id === null
        ? null
        : requiredId(row.source_planned_workout_id),
    sourceWeekday: sourceWeekday?.value ?? null,
    startedAtEpochMilliseconds: row.started_at_epoch_ms,
    startedLocalCalendarDate: row.started_local_calendar_date,
    startedUtcOffsetMinutes: row.started_utc_offset_minutes,
    status: row.status,
  });
  return session.isSuccess ? session.value : corrupt();
}

function mapExercise(
  row: ExerciseRow,
  rows: readonly SetRow[],
): WorkoutSessionExercise {
  const planned = mapPlanned(row);
  const exercise = WorkoutSessionExercise.create({
    exerciseNameSnapshot: row.exercise_name_snapshot,
    id: requiredId(row.id),
    loggingModeSnapshot: row.logging_mode_snapshot,
    plannedPrescriptionSnapshot: planned,
    position: row.position,
    sets: rows.map((set) => mapSet(set, row.logging_mode_snapshot)),
    sourceExerciseDefinitionId: requiredId(row.source_exercise_definition_id),
    sourcePlannedExerciseId:
      row.source_planned_exercise_id === null
        ? null
        : requiredId(row.source_planned_exercise_id),
  });
  return exercise.isSuccess ? exercise.value : corrupt();
}

function mapSet(row: SetRow, loggingMode: ExerciseLoggingMode): WorkoutSet {
  const resistance = measurement(
    (value, unit) => Mass.create(value, unit),
    row.resistance_grams,
    'gram',
  );
  const duration = measurement(
    (value, unit) => Duration.create(value, unit),
    row.duration_seconds,
    'second',
  );
  const distance = measurement(
    (value, unit) => Length.create(value, unit),
    row.distance_millimeters,
    'millimeter',
  );
  const result = createWorkoutResult({
    ...(distance ? { distance } : {}),
    ...(duration ? { duration } : {}),
    loggingMode,
    repetitions: row.repetitions,
    ...(resistance ? { resistance } : {}),
  });
  if (!result.isSuccess || result.value.kind !== row.result_kind)
    return corrupt();
  const set = WorkoutSet.create({
    id: requiredId(row.id),
    position: row.position,
    result: result.value,
  });
  return set.isSuccess ? set.value : corrupt();
}

function mapPlanned(row: ExerciseRow): PlannedPrescription | null {
  if (row.planned_kind === null) return null;
  const result = createPlannedPrescription({
    ...(row.planned_distance_millimeters === null
      ? {}
      : {
          distance: measurement(
            (value, unit) => Length.create(value, unit),
            row.planned_distance_millimeters,
            'millimeter',
          ),
        }),
    ...(row.planned_duration_seconds === null
      ? {}
      : {
          duration: measurement(
            (value, unit) => Duration.create(value, unit),
            row.planned_duration_seconds,
            'second',
          ),
        }),
    loggingMode: row.logging_mode_snapshot,
    repetitions: row.planned_repetitions,
    ...(row.planned_resistance_grams === null
      ? {}
      : {
          resistance: measurement(
            (value, unit) => Mass.create(value, unit),
            row.planned_resistance_grams,
            'gram',
          ),
        }),
    sets: row.planned_sets,
  });
  return result.isSuccess && result.value.kind === row.planned_kind
    ? result.value
    : corrupt();
}

function measurement<TValue, TUnit>(
  create: (
    value: unknown,
    unit: unknown,
  ) =>
    | Readonly<{ isSuccess: true; value: TValue }>
    | Readonly<{ isSuccess: false }>,
  value: number | null,
  unit: TUnit,
): TValue | null {
  if (value === null) return null;
  const result = create(value, unit);
  return result.isSuccess ? result.value : corrupt();
}

function requiredId(value: string): DomainId {
  const result = DomainId.create(value);
  return result.isSuccess ? result.value : corrupt();
}

function corrupt(): never {
  throw new PersistenceError('operation-failed');
}
