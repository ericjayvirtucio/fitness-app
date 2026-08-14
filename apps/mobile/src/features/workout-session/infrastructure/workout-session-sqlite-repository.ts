import type {
  DomainId,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import type {
  CompletedWorkoutLifecycle,
  WorkoutSessionRepository,
} from '../application/workout-session-repository';
import {
  mapSession,
  type ExerciseRow,
  type SessionRow,
  type SetRow,
} from './workout-session-row-mapping';

type LifecycleRow = Readonly<{
  completed_at_epoch_ms: number | null;
  started_at_epoch_ms: number;
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

  async complete(session: WorkoutSession): Promise<WorkoutSession> {
    try {
      if (
        session.status !== 'completed' ||
        session.completedAtEpochMilliseconds === null
      )
        throw new PersistenceError('operation-failed');
      await this.database.run(
        `UPDATE workout_session SET status = ?, completed_at_epoch_ms = ?
         WHERE id = ? AND status = ?`,
        [
          session.status,
          session.completedAtEpochMilliseconds,
          session.id.value,
          'active',
        ],
      );
      const persisted = await this.getById(session.id);
      if (
        persisted === null ||
        persisted.status !== 'completed' ||
        persisted.completedAtEpochMilliseconds !==
          session.completedAtEpochMilliseconds
      )
        throw new PersistenceError('operation-failed');
      return persisted;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async correctCompleted(session: WorkoutSession): Promise<void> {
    try {
      if (
        session.status !== 'completed' ||
        session.completedAtEpochMilliseconds === null
      )
        throw new PersistenceError('operation-failed');
      const stored = await this.database.getFirst<LifecycleRow>(
        `SELECT started_at_epoch_ms, completed_at_epoch_ms
         FROM workout_session WHERE id = ? AND status = ?`,
        [session.id.value, 'completed'],
      );
      if (
        stored === null ||
        stored.started_at_epoch_ms !== session.startedAtEpochMilliseconds ||
        stored.completed_at_epoch_ms !== session.completedAtEpochMilliseconds
      )
        throw new PersistenceError('operation-failed');
      await this.deleteChildren(session.id.value);
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
      await this.deleteChildren(session.id.value);
      await this.insertChildren(session);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async deleteCompleted(
    id: DomainId,
    expected: CompletedWorkoutLifecycle,
  ): Promise<void> {
    try {
      const stored = await this.database.getFirst<LifecycleRow>(
        `SELECT started_at_epoch_ms, completed_at_epoch_ms
         FROM workout_session WHERE id = ? AND status = ?`,
        [id.value, 'completed'],
      );
      if (
        stored === null ||
        stored.started_at_epoch_ms !== expected.startedAtEpochMilliseconds ||
        stored.completed_at_epoch_ms !== expected.completedAtEpochMilliseconds
      )
        throw new PersistenceError('operation-failed');
      // Held before the children go, because once the parent is deleted an
      // orphaned set can no longer be found by joining back to the session.
      const owned = await this.database.getAll<{ id: string }>(
        'SELECT id FROM workout_session_exercise WHERE workout_session_id = ?',
        [id.value],
      );
      await this.deleteChildren(id.value);
      await this.database.run(
        'DELETE FROM workout_session WHERE id = ? AND status = ?',
        [id.value, 'completed'],
      );
      await this.assertDeleted(
        id.value,
        owned.map((row) => row.id),
      );
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
      await this.deleteChildren(id.value);
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

  /**
   * Removes a session's owned rows child-first. Expo opens an exclusive
   * transaction on a connection of its own, where `PRAGMA foreign_keys` is off
   * and cannot be turned on once the transaction has begun, so
   * `ON DELETE CASCADE` would leave orphan `workout_set` and
   * `workout_session_exercise` rows that no read path can see.
   */
  private async deleteChildren(sessionId: string): Promise<void> {
    await this.database.run(
      `DELETE FROM workout_set WHERE workout_session_exercise_id IN (
         SELECT id FROM workout_session_exercise WHERE workout_session_id = ?
       )`,
      [sessionId],
    );
    await this.database.run(
      'DELETE FROM workout_session_exercise WHERE workout_session_id = ?',
      [sessionId],
    );
  }

  /**
   * Refuses to report a deletion the database did not actually perform, so a
   * surviving parent or an orphaned child aborts the caller's transaction
   * instead of leaving rows no read path can see.
   */
  private async assertDeleted(
    sessionId: string,
    exerciseIds: readonly string[],
  ): Promise<void> {
    const parent = await this.database.getFirst<{ id: string }>(
      'SELECT id FROM workout_session WHERE id = ?',
      [sessionId],
    );
    if (parent !== null) throw new PersistenceError('operation-failed');
    const remainingExercises = await this.database.getFirst<{ count: number }>(
      `SELECT COUNT(*) AS count FROM workout_session_exercise
       WHERE workout_session_id = ?`,
      [sessionId],
    );
    if (remainingExercises === null || remainingExercises.count !== 0)
      throw new PersistenceError('operation-failed');
    if (exerciseIds.length === 0) return;
    const remainingSets = await this.database.getFirst<{ count: number }>(
      `SELECT COUNT(*) AS count FROM workout_set
       WHERE workout_session_exercise_id IN (${exerciseIds.map(() => '?').join(', ')})`,
      exerciseIds,
    );
    if (remainingSets === null || remainingSets.count !== 0)
      throw new PersistenceError('operation-failed');
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
