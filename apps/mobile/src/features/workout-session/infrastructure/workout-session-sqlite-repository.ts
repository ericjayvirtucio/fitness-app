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
import { queueOutboxEntry } from '../../../infrastructure/persistence/sync-outbox';
import type {
  CompletedWorkoutLifecycle,
  WorkoutSessionLifecycle,
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

const tableName = 'workout_session';

export class WorkoutSessionSqliteRepository implements WorkoutSessionRepository {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly deviceId: string,
    private readonly now: () => Date,
  ) {}

  async getActive(): Promise<WorkoutSession | null> {
    return this.load(
      'SELECT * FROM workout_session WHERE status = ? AND deleted_at_epoch_ms IS NULL LIMIT 1',
      ['active'],
    );
  }

  async getById(id: DomainId): Promise<WorkoutSession | null> {
    return this.load(
      'SELECT * FROM workout_session WHERE id = ? AND deleted_at_epoch_ms IS NULL LIMIT 1',
      [id.value],
    );
  }

  /**
   * A session is not history until it is completed (ADR 0008), so an active
   * session inserted here is never queued to the outbox: one discarded before
   * it ever completes must leave no dangling outbox reference to a row that
   * no longer exists. A session inserted already completed — restoring or
   * replacing a export, or a synthetic test fixture — is real history the
   * moment it is written, and is queued immediately.
   */
  async insert(session: WorkoutSession): Promise<void> {
    try {
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `INSERT INTO workout_session (
          id, display_name, status, started_at_epoch_ms,
          started_local_calendar_date, started_utc_offset_minutes,
          completed_at_epoch_ms, source_planned_workout_id, source_weekday,
          updated_at_epoch_ms, deleted_at_epoch_ms, revision,
          originating_device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)`,
        [...sessionParameters(session), nowEpochMs, this.deviceId],
      );
      await this.insertChildren(session);
      if (session.status === 'completed')
        await this.queueRevision(session.id.value, 'upsert', nowEpochMs);
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
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `UPDATE workout_session SET status = ?, completed_at_epoch_ms = ?,
          updated_at_epoch_ms = ?, revision = revision + 1
         WHERE id = ? AND status = ? AND deleted_at_epoch_ms IS NULL`,
        [
          session.status,
          session.completedAtEpochMilliseconds,
          nowEpochMs,
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
      // Completion is the first moment this aggregate is history, so it is
      // the first moment it is queued for a future sync to learn about.
      await this.queueRevision(session.id.value, 'upsert', nowEpochMs);
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
         FROM workout_session
         WHERE id = ? AND status = ? AND deleted_at_epoch_ms IS NULL`,
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
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `UPDATE workout_session SET updated_at_epoch_ms = ?, revision = revision + 1
         WHERE id = ? AND status = ? AND deleted_at_epoch_ms IS NULL`,
        [nowEpochMs, session.id.value, 'completed'],
      );
      await this.queueRevision(session.id.value, 'upsert', nowEpochMs);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async rename(
    id: DomainId,
    name: string,
    expected: WorkoutSessionLifecycle,
  ): Promise<boolean> {
    try {
      // `IS` rather than `=`, because a completed instant is null on an active
      // workout and `= NULL` matches nothing. One statement therefore guards
      // both statuses without branching the SQL on a caller's value.
      const predicate = `id = ? AND status = ? AND started_at_epoch_ms = ?
         AND completed_at_epoch_ms IS ? AND deleted_at_epoch_ms IS NULL`;
      const parameters = [
        id.value,
        expected.status,
        expected.startedAtEpochMilliseconds,
        expected.completedAtEpochMilliseconds,
      ];
      const stored = await this.database.getFirst<{ id: string }>(
        `SELECT id FROM workout_session WHERE ${predicate}`,
        parameters,
      );
      if (stored === null) return false;
      // The lifecycle predicate is repeated on the write rather than trusted
      // from the check above, so the guard holds at the statement that changes
      // the row instead of one statement earlier.
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `UPDATE workout_session SET display_name = ?, updated_at_epoch_ms = ?,
          revision = revision + 1 WHERE ${predicate}`,
        [name, nowEpochMs, ...parameters],
      );
      // Renaming an active session changes its row but not its sync-worthiness
      // (see `insert`); only a completed session's rename is queued.
      if (expected.status === 'completed')
        await this.queueRevision(id.value, 'upsert', nowEpochMs);
      return true;
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

  /**
   * A person deleting a completed workout is exactly the case a future device
   * must learn about, so the parent row is tombstoned rather than removed.
   * Children have no independent sync identity and are still hard-deleted,
   * same as every other lifecycle write on this aggregate.
   */
  async deleteCompleted(
    id: DomainId,
    expected: CompletedWorkoutLifecycle,
  ): Promise<void> {
    try {
      const stored = await this.database.getFirst<LifecycleRow>(
        `SELECT started_at_epoch_ms, completed_at_epoch_ms
         FROM workout_session
         WHERE id = ? AND status = ? AND deleted_at_epoch_ms IS NULL`,
        [id.value, 'completed'],
      );
      if (
        stored === null ||
        stored.started_at_epoch_ms !== expected.startedAtEpochMilliseconds ||
        stored.completed_at_epoch_ms !== expected.completedAtEpochMilliseconds
      )
        throw new PersistenceError('operation-failed');
      // Held before the children go, because once they are gone an orphaned
      // set can no longer be found by joining back to the session.
      const owned = await this.database.getAll<{ id: string }>(
        'SELECT id FROM workout_session_exercise WHERE workout_session_id = ?',
        [id.value],
      );
      await this.deleteChildren(id.value);
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `UPDATE workout_session SET deleted_at_epoch_ms = ?,
          updated_at_epoch_ms = ?, revision = revision + 1
         WHERE id = ? AND status = ? AND deleted_at_epoch_ms IS NULL`,
        [nowEpochMs, nowEpochMs, id.value, 'completed'],
      );
      await this.assertDeleted(
        id.value,
        owned.map((row) => row.id),
      );
      await this.queueRevision(id.value, 'delete', nowEpochMs);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  /**
   * Abandoning a never-completed session is application-owned scratch-state
   * discard, not person-initiated deletion of history (ADR 0008): the parent
   * row is hard-deleted, exactly as before, and never reaches the outbox
   * because it was never queued there in the first place (see `insert`).
   */
  async discard(id: DomainId): Promise<boolean> {
    try {
      const existing = await this.database.getFirst<{ id: string }>(
        'SELECT id FROM workout_session WHERE id = ? AND status = ? AND deleted_at_epoch_ms IS NULL',
        [id.value, 'active'],
      );
      if (existing === null) return false;
      await this.deleteChildren(id.value);
      // The status predicate is repeated on the delete rather than trusted from
      // the check above, so the guard holds at the statement that destroys the
      // row instead of three statements earlier.
      await this.database.run(
        'DELETE FROM workout_session WHERE id = ? AND status = ?',
        [id.value, 'active'],
      );
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
   * `workout_session_exercise` rows that no read path can see. Every caller
   * runs inside such a transaction, so the explicit order is what makes the
   * deletion complete rather than the declared cascade.
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
   * Refuses to report a deletion the database did not actually perform, so an
   * untombstoned parent or an orphaned child aborts the caller's transaction
   * instead of leaving rows no read path can see.
   */
  private async assertDeleted(
    sessionId: string,
    exerciseIds: readonly string[],
  ): Promise<void> {
    const parent = await this.database.getFirst<{
      deleted_at_epoch_ms: number | null;
    }>('SELECT deleted_at_epoch_ms FROM workout_session WHERE id = ?', [
      sessionId,
    ]);
    if (parent === null || parent.deleted_at_epoch_ms === null)
      throw new PersistenceError('operation-failed');
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

  private async queueRevision(
    id: string,
    operation: 'delete' | 'upsert',
    nowEpochMs: number,
  ): Promise<void> {
    const stored = await this.database.getFirst<{ revision: number }>(
      'SELECT revision FROM workout_session WHERE id = ?',
      [id],
    );
    await queueOutboxEntry(
      this.database,
      tableName,
      id,
      operation,
      stored?.revision ?? 1,
      nowEpochMs,
    );
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
