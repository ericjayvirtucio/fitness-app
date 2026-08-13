import { DomainId, type ExerciseLoggingMode } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import { WorkoutSessionSqliteRepository } from '../../workout-session/infrastructure/workout-session-sqlite-repository';
import type {
  ExercisePerformanceItem,
  PerformedExerciseSummary,
  WorkoutHistoryCursor,
  WorkoutHistoryListItem,
  WorkoutHistoryPageQuery,
  WorkoutHistoryRange,
  WorkoutProgressSummary,
  WorkoutProgressDay,
} from '../application/workout-history-models';
import type { WorkoutHistoryRepository } from '../application/workout-history-repository';

type HistoryRow = Readonly<{
  actual_set_count: number;
  completed_at_epoch_ms: number;
  display_name: string;
  exercise_count: number;
  id: string;
  performed_exercise_count: number;
  started_at_epoch_ms: number;
  started_local_calendar_date: string;
  started_utc_offset_minutes: number;
}>;

type SummaryRow = Readonly<{
  actual_set_count: number;
  completed_workout_count: number;
  distance_millimeters: number | null;
  duration_seconds: number | null;
  elapsed_workout_ms: number;
  performed_exercise_count: number;
  recorded_load_volume: number | null;
  repetitions: number | null;
}>;

type ExercisePerformanceRow = Readonly<{
  actual_set_count: number;
  distance_millimeters: number | null;
  duration_seconds: number | null;
  exercise_name_snapshot: string;
  id: string;
  logging_mode_snapshot: ExerciseLoggingMode;
  maximum_resistance_grams: number | null;
  recorded_load_volume: number | null;
  repetitions: number | null;
  session_id: string;
  session_name_snapshot: string;
  started_at_epoch_ms: number;
  started_local_calendar_date: string;
}>;

type PerformedExerciseRow = Readonly<{
  exercise_name_snapshot: string;
  id: string;
  started_local_calendar_date: string;
}>;

type DailySummaryRow = Readonly<{
  actual_set_count: number;
  completed_workout_count: number;
  local_calendar_date: string;
  performed_exercise_count: number;
}>;

export class WorkoutHistorySqliteRepository implements WorkoutHistoryRepository {
  private readonly sessions: WorkoutSessionSqliteRepository;

  constructor(private readonly database: DatabaseConnection) {
    this.sessions = new WorkoutSessionSqliteRepository(database);
  }

  async getCompletedById(id: DomainId) {
    const session = await this.sessions.getById(id);
    return session?.status === 'completed' ? session : null;
  }

  async listCompletedPage(query: WorkoutHistoryPageQuery) {
    try {
      const limit = query.limit ?? 20;
      const parameters: (number | string)[] = ['completed'];
      const cursorClause = query.cursor
        ? `AND (
            session.started_local_calendar_date < ? OR
            (session.started_local_calendar_date = ? AND session.started_at_epoch_ms < ?) OR
            (session.started_local_calendar_date = ? AND session.started_at_epoch_ms = ? AND session.id < ?)
          )`
        : '';
      if (query.cursor)
        parameters.push(
          query.cursor.startedLocalCalendarDate,
          query.cursor.startedLocalCalendarDate,
          query.cursor.startedAtEpochMilliseconds,
          query.cursor.startedLocalCalendarDate,
          query.cursor.startedAtEpochMilliseconds,
          query.cursor.id,
        );
      parameters.push(limit + 1);
      const rows = await this.database.getAll<HistoryRow>(
        `SELECT session.id, session.display_name, session.started_at_epoch_ms,
          session.started_local_calendar_date, session.started_utc_offset_minutes,
          session.completed_at_epoch_ms,
          (SELECT COUNT(*) FROM workout_session_exercise exercise
            WHERE exercise.workout_session_id = session.id) AS exercise_count,
          (SELECT COUNT(*) FROM workout_session_exercise exercise
            WHERE exercise.workout_session_id = session.id AND EXISTS (
              SELECT 1 FROM workout_set actual
              WHERE actual.workout_session_exercise_id = exercise.id
            )) AS performed_exercise_count,
          (SELECT COUNT(*) FROM workout_set actual
            JOIN workout_session_exercise exercise
              ON exercise.id = actual.workout_session_exercise_id
            WHERE exercise.workout_session_id = session.id) AS actual_set_count
        FROM workout_session session
        WHERE session.status = ? ${cursorClause}
        ORDER BY session.started_local_calendar_date DESC,
          session.started_at_epoch_ms DESC, session.id DESC
        LIMIT ?`,
        parameters,
      );
      const hasMore = rows.length > limit;
      const items = rows.slice(0, limit).map(mapHistoryRow);
      return {
        items,
        nextCursor: hasMore ? cursorFor(items.at(-1)) : null,
      };
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async summarizeCompletedRange(
    range: WorkoutHistoryRange,
  ): Promise<WorkoutProgressSummary> {
    try {
      const row = await this.database.getFirst<SummaryRow>(
        `WITH completed AS (
          SELECT id, started_at_epoch_ms, completed_at_epoch_ms
          FROM workout_session
          WHERE status = 'completed'
            AND started_local_calendar_date BETWEEN ? AND ?
        ), performed_exercises AS (
          SELECT COUNT(*) AS count
          FROM workout_session_exercise exercise
          JOIN completed session ON session.id = exercise.workout_session_id
          WHERE EXISTS (
            SELECT 1 FROM workout_set actual
            WHERE actual.workout_session_exercise_id = exercise.id
          )
        ), actual_totals AS (
          SELECT COUNT(actual.id) AS actual_set_count,
            SUM(actual.repetitions) AS repetitions,
            SUM(actual.duration_seconds) AS duration_seconds,
            SUM(actual.distance_millimeters) AS distance_millimeters,
            SUM(CASE WHEN exercise.logging_mode_snapshot IN (
              'external-load-and-repetitions',
              'bodyweight-plus-load-and-repetitions'
            ) THEN actual.resistance_grams * actual.repetitions END)
              AS recorded_load_volume
          FROM completed session
          JOIN workout_session_exercise exercise
            ON exercise.workout_session_id = session.id
          JOIN workout_set actual
            ON actual.workout_session_exercise_id = exercise.id
        )
        SELECT COUNT(completed.id) AS completed_workout_count,
          COALESCE(SUM(completed.completed_at_epoch_ms - completed.started_at_epoch_ms), 0)
            AS elapsed_workout_ms,
          (SELECT count FROM performed_exercises) AS performed_exercise_count,
          (SELECT actual_set_count FROM actual_totals) AS actual_set_count,
          (SELECT repetitions FROM actual_totals) AS repetitions,
          (SELECT duration_seconds FROM actual_totals) AS duration_seconds,
          (SELECT distance_millimeters FROM actual_totals) AS distance_millimeters,
          (SELECT recorded_load_volume FROM actual_totals) AS recorded_load_volume
        FROM completed`,
        [range.startLocalCalendarDate, range.endLocalCalendarDate],
      );
      if (row === null) throw new PersistenceError('operation-failed');
      return {
        actualSetCount: nonnegativeInteger(row.actual_set_count),
        completedWorkoutCount: nonnegativeInteger(row.completed_workout_count),
        distanceMillimeters: nullableNonnegative(row.distance_millimeters),
        durationSeconds: nullableNonnegative(row.duration_seconds),
        elapsedWorkoutSeconds:
          nonnegativeInteger(row.elapsed_workout_ms) / 1_000,
        performedExerciseCount: nonnegativeInteger(
          row.performed_exercise_count,
        ),
        recordedLoadVolumeGramRepetitions: nullableNonnegative(
          row.recorded_load_volume,
        ),
        repetitions: nullableNonnegative(row.repetitions),
      };
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async summarizeCompletedByDay(
    range: WorkoutHistoryRange,
  ): Promise<readonly WorkoutProgressDay[]> {
    try {
      const rows = await this.database.getAll<DailySummaryRow>(
        `SELECT session.started_local_calendar_date AS local_calendar_date,
          COUNT(DISTINCT session.id) AS completed_workout_count,
          COUNT(DISTINCT CASE WHEN actual.id IS NOT NULL THEN exercise.id END)
            AS performed_exercise_count,
          COUNT(actual.id) AS actual_set_count
        FROM workout_session session
        LEFT JOIN workout_session_exercise exercise
          ON exercise.workout_session_id = session.id
        LEFT JOIN workout_set actual
          ON actual.workout_session_exercise_id = exercise.id
        WHERE session.status = 'completed'
          AND session.started_local_calendar_date BETWEEN ? AND ?
        GROUP BY session.started_local_calendar_date
        ORDER BY session.started_local_calendar_date ASC`,
        [range.startLocalCalendarDate, range.endLocalCalendarDate],
      );
      return Object.freeze(
        rows.map((row) =>
          Object.freeze({
            actualSetCount: nonnegativeInteger(row.actual_set_count),
            completedWorkoutCount: nonnegativeInteger(
              row.completed_workout_count,
            ),
            localCalendarDate: requiredDate(row.local_calendar_date),
            performedExerciseCount: nonnegativeInteger(
              row.performed_exercise_count,
            ),
          }),
        ),
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async listExercisePerformancePage(
    exerciseDefinitionId: DomainId,
    query: WorkoutHistoryPageQuery,
  ) {
    try {
      const limit = query.limit ?? 20;
      const parameters: (number | string)[] = [
        exerciseDefinitionId.value,
        'completed',
      ];
      const cursorClause = query.cursor
        ? `AND (
            session.started_local_calendar_date < ? OR
            (session.started_local_calendar_date = ? AND session.started_at_epoch_ms < ?) OR
            (session.started_local_calendar_date = ? AND session.started_at_epoch_ms = ? AND exercise.id < ?)
          )`
        : '';
      if (query.cursor)
        parameters.push(
          query.cursor.startedLocalCalendarDate,
          query.cursor.startedLocalCalendarDate,
          query.cursor.startedAtEpochMilliseconds,
          query.cursor.startedLocalCalendarDate,
          query.cursor.startedAtEpochMilliseconds,
          query.cursor.id,
        );
      parameters.push(limit + 1);
      const rows = await this.database.getAll<ExercisePerformanceRow>(
        `SELECT exercise.id, session.id AS session_id,
          session.display_name AS session_name_snapshot,
          session.started_at_epoch_ms, session.started_local_calendar_date,
          exercise.exercise_name_snapshot, exercise.logging_mode_snapshot,
          COUNT(actual.id) AS actual_set_count,
          SUM(actual.repetitions) AS repetitions,
          MAX(actual.resistance_grams) AS maximum_resistance_grams,
          SUM(actual.duration_seconds) AS duration_seconds,
          SUM(actual.distance_millimeters) AS distance_millimeters,
          SUM(CASE WHEN exercise.logging_mode_snapshot IN (
            'external-load-and-repetitions',
            'bodyweight-plus-load-and-repetitions'
          ) THEN actual.resistance_grams * actual.repetitions END)
            AS recorded_load_volume
        FROM workout_session_exercise exercise
        JOIN workout_session session ON session.id = exercise.workout_session_id
        JOIN workout_set actual
          ON actual.workout_session_exercise_id = exercise.id
        WHERE exercise.source_exercise_definition_id = ?
          AND session.status = ? ${cursorClause}
        GROUP BY exercise.id
        ORDER BY session.started_local_calendar_date DESC,
          session.started_at_epoch_ms DESC, exercise.id DESC
        LIMIT ?`,
        parameters,
      );
      const hasMore = rows.length > limit;
      const selectedRows = rows.slice(0, limit);
      return {
        items: selectedRows.map(mapExercisePerformanceRow),
        nextCursor: hasMore ? exerciseCursorFor(selectedRows.at(-1)) : null,
      };
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  /**
   * Performed exercises as history knows them, newest occurrence first. The
   * label comes from the latest completed snapshot rather than the Exercise
   * Catalog, so a deleted definition stays listed under the name it was
   * recorded with.
   */
  async listPerformedExercises(limit: number) {
    try {
      const rows = await this.database.getAll<PerformedExerciseRow>(
        `SELECT id, exercise_name_snapshot, started_local_calendar_date FROM (
          SELECT exercise.source_exercise_definition_id AS id,
            exercise.exercise_name_snapshot,
            session.started_local_calendar_date,
            ROW_NUMBER() OVER (
              PARTITION BY exercise.source_exercise_definition_id
              ORDER BY session.started_at_epoch_ms DESC, exercise.id DESC
            ) AS occurrence_rank,
            MAX(session.started_at_epoch_ms) OVER (
              PARTITION BY exercise.source_exercise_definition_id
            ) AS latest_started_at_epoch_ms
          FROM workout_session_exercise exercise
          JOIN workout_session session
            ON session.id = exercise.workout_session_id
          WHERE session.status = 'completed'
            AND EXISTS (
              SELECT 1 FROM workout_set actual
              WHERE actual.workout_session_exercise_id = exercise.id
            )
        )
        WHERE occurrence_rank = 1
        ORDER BY latest_started_at_epoch_ms DESC, id ASC
        LIMIT ?`,
        [limit],
      );
      return Object.freeze(rows.map(mapPerformedExerciseRow));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async listRecentlyPerformedExerciseIds(limit: number) {
    try {
      const rows = await this.database.getAll<{ id: string }>(
        `SELECT exercise.source_exercise_definition_id AS id
        FROM workout_session_exercise exercise
        JOIN workout_session session ON session.id = exercise.workout_session_id
        JOIN workout_set actual
          ON actual.workout_session_exercise_id = exercise.id
        WHERE session.status = 'completed'
        GROUP BY exercise.source_exercise_definition_id
        ORDER BY MAX(session.started_at_epoch_ms) DESC,
          exercise.source_exercise_definition_id ASC
        LIMIT ?`,
        [limit],
      );
      return rows.map((row) => requiredId(row.id));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}

function mapHistoryRow(row: HistoryRow): WorkoutHistoryListItem {
  const completedAt = nonnegativeInteger(row.completed_at_epoch_ms);
  const startedAt = nonnegativeInteger(row.started_at_epoch_ms);
  if (completedAt < startedAt || row.display_name.trim() === '')
    return corrupt();
  return Object.freeze({
    actualSetCount: nonnegativeInteger(row.actual_set_count),
    completedAtEpochMilliseconds: completedAt,
    elapsedSeconds: (completedAt - startedAt) / 1_000,
    exerciseCount: nonnegativeInteger(row.exercise_count),
    nameSnapshot: row.display_name,
    performedExerciseCount: nonnegativeInteger(row.performed_exercise_count),
    sessionId: requiredId(row.id),
    startedAtEpochMilliseconds: startedAt,
    startedLocalCalendarDate: requiredDate(row.started_local_calendar_date),
    startedUtcOffsetMinutes: validOffset(row.started_utc_offset_minutes),
  });
}

function mapExercisePerformanceRow(
  row: ExercisePerformanceRow,
): ExercisePerformanceItem {
  if (
    row.exercise_name_snapshot.trim() === '' ||
    row.session_name_snapshot.trim() === ''
  )
    return corrupt();
  return Object.freeze({
    actualSetCount: nonnegativeInteger(row.actual_set_count),
    distanceMillimeters: nullableNonnegative(row.distance_millimeters),
    durationSeconds: nullableNonnegative(row.duration_seconds),
    exerciseNameSnapshot: row.exercise_name_snapshot,
    loggingModeSnapshot: row.logging_mode_snapshot,
    maximumResistanceGrams: nullableNonnegative(row.maximum_resistance_grams),
    recordedLoadVolumeGramRepetitions: nullableNonnegative(
      row.recorded_load_volume,
    ),
    repetitions: nullableNonnegative(row.repetitions),
    sessionId: requiredId(row.session_id),
    sessionNameSnapshot: row.session_name_snapshot,
    startedAtEpochMilliseconds: nonnegativeInteger(row.started_at_epoch_ms),
    startedLocalCalendarDate: requiredDate(row.started_local_calendar_date),
  });
}

function mapPerformedExerciseRow(
  row: PerformedExerciseRow,
): PerformedExerciseSummary {
  if (row.exercise_name_snapshot.trim() === '') return corrupt();
  return Object.freeze({
    exerciseNameSnapshot: row.exercise_name_snapshot,
    latestStartedLocalCalendarDate: requiredDate(
      row.started_local_calendar_date,
    ),
    sourceExerciseDefinitionId: requiredId(row.id),
  });
}

function cursorFor(
  item: WorkoutHistoryListItem | undefined,
): WorkoutHistoryCursor | null {
  return item
    ? {
        id: item.sessionId.value,
        startedAtEpochMilliseconds: item.startedAtEpochMilliseconds,
        startedLocalCalendarDate: item.startedLocalCalendarDate,
      }
    : null;
}

function exerciseCursorFor(
  row: ExercisePerformanceRow | undefined,
): WorkoutHistoryCursor | null {
  return row
    ? {
        id: row.id,
        startedAtEpochMilliseconds: row.started_at_epoch_ms,
        startedLocalCalendarDate: row.started_local_calendar_date,
      }
    : null;
}

function requiredId(value: string): DomainId {
  const result = DomainId.create(value);
  return result.isSuccess ? result.value : corrupt();
}

function requiredDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return corrupt();
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  )
    return corrupt();
  return value;
}

function validOffset(value: number): number {
  return Number.isInteger(value) && value >= -840 && value <= 840
    ? value
    : corrupt();
}

function nonnegativeInteger(value: number): number {
  return Number.isInteger(value) && value >= 0 ? value : corrupt();
}

function nullableNonnegative(value: number | null): number | null {
  return value === null
    ? null
    : Number.isFinite(value) && value >= 0
      ? value
      : corrupt();
}

function corrupt(): never {
  throw new PersistenceError('operation-failed');
}
