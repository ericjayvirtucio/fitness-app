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
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import type { WorkoutSessionRepository } from '../application/workout-session-repository';

type SessionRow = Readonly<{
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

type ExerciseRow = Readonly<{
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

type SetRow = Readonly<{
  distance_millimeters: number | null;
  duration_seconds: number | null;
  id: string;
  position: number;
  repetitions: number | null;
  resistance_grams: number | null;
  result_kind: WorkoutResult['kind'];
  workout_session_exercise_id: string;
}>;

export class WorkoutSessionSqliteRepository implements WorkoutSessionRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getActive(): Promise<WorkoutSession | null> {
    return this.load('SELECT * FROM workout_session WHERE status = ? LIMIT 1', [
      'active',
    ]);
  }

  async getById(id: DomainId): Promise<WorkoutSession | null> {
    return this.load('SELECT * FROM workout_session WHERE id = ? LIMIT 1', [
      id.value,
    ]);
  }

  async insert(session: WorkoutSession): Promise<void> {
    try {
      await this.database.run(
        `INSERT INTO workout_session (
          id, display_name, status, started_at_epoch_ms,
          started_local_calendar_date, started_utc_offset_minutes,
          completed_at_epoch_ms, source_planned_workout_id, source_weekday
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sessionParameters(session),
      );
      await this.insertChildren(session);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async replace(session: WorkoutSession): Promise<void> {
    try {
      await this.database.run(
        `UPDATE workout_session SET display_name = ?, status = ?,
          completed_at_epoch_ms = ? WHERE id = ?`,
        [
          session.name,
          session.status,
          session.completedAtEpochMilliseconds,
          session.id.value,
        ],
      );
      await this.database.run(
        'DELETE FROM workout_session_exercise WHERE workout_session_id = ?',
        [session.id.value],
      );
      await this.insertChildren(session);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async discard(id: DomainId): Promise<boolean> {
    try {
      const existing = await this.database.getFirst<{ id: string }>(
        'SELECT id FROM workout_session WHERE id = ? AND status = ?',
        [id.value, 'active'],
      );
      if (existing === null) return false;
      await this.database.run('DELETE FROM workout_session WHERE id = ?', [
        id.value,
      ]);
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  private async load(statement: string, parameters: DatabaseParameters) {
    try {
      const row = await this.database.getFirst<SessionRow>(
        statement,
        parameters,
      );
      if (row === null) return null;
      const exercises = await this.database.getAll<ExerciseRow>(
        `SELECT * FROM workout_session_exercise
         WHERE workout_session_id = ? ORDER BY position ASC`,
        [row.id],
      );
      const sets = await this.database.getAll<SetRow>(
        `SELECT actual.* FROM workout_set actual
         JOIN workout_session_exercise exercise
           ON exercise.id = actual.workout_session_exercise_id
         WHERE exercise.workout_session_id = ?
         ORDER BY exercise.position ASC, actual.position ASC`,
        [row.id],
      );
      return mapSession(row, exercises, sets);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  private async insertChildren(session: WorkoutSession): Promise<void> {
    for (const exercise of session.exercises) {
      await this.database.run(
        `INSERT INTO workout_session_exercise (
          id, workout_session_id, source_exercise_definition_id,
          source_planned_exercise_id, position, exercise_name_snapshot,
          logging_mode_snapshot, planned_kind, planned_sets,
          planned_repetitions, planned_resistance_grams,
          planned_duration_seconds, planned_distance_millimeters
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        exerciseParameters(session.id, exercise),
      );
      for (const set of exercise.sets) {
        await this.database.run(
          `INSERT INTO workout_set (
            id, workout_session_exercise_id, position, result_kind,
            repetitions, resistance_grams, duration_seconds,
            distance_millimeters
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          setParameters(exercise.id, set),
        );
      }
    }
  }
}

function mapSession(
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

function sessionParameters(session: WorkoutSession): DatabaseParameters {
  return [
    session.id.value,
    session.name,
    session.status,
    session.startedAtEpochMilliseconds,
    session.startedLocalCalendarDate,
    session.startedUtcOffsetMinutes,
    session.completedAtEpochMilliseconds,
    session.sourcePlannedWorkoutId?.value ?? null,
    session.sourceWeekday?.value ?? null,
  ];
}

function exerciseParameters(
  sessionId: DomainId,
  exercise: WorkoutSessionExercise,
): DatabaseParameters {
  const planned = exercise.plannedPrescriptionSnapshot;
  return [
    exercise.id.value,
    sessionId.value,
    exercise.sourceExerciseDefinitionId.value,
    exercise.sourcePlannedExerciseId?.value ?? null,
    exercise.position,
    exercise.exerciseNameSnapshot,
    exercise.loggingModeSnapshot,
    planned?.kind ?? null,
    planned?.sets ?? null,
    planned && 'repetitions' in planned ? planned.repetitions : null,
    planned && 'resistance' in planned
      ? (planned.resistance?.grams ?? null)
      : null,
    planned && 'duration' in planned ? planned.duration.seconds : null,
    planned && 'distance' in planned ? planned.distance.millimeters : null,
  ];
}

function setParameters(exerciseId: DomainId, set: WorkoutSet) {
  const result = set.result;
  return [
    set.id.value,
    exerciseId.value,
    set.position,
    result.kind,
    'repetitions' in result ? result.repetitions : null,
    'resistance' in result ? result.resistance.grams : null,
    'duration' in result ? result.duration.seconds : null,
    'distance' in result ? result.distance.millimeters : null,
  ];
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
