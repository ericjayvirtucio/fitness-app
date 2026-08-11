import type { WorkoutSession } from '@fitness/domain';
import type {
  ExportPage,
  ExportPageQuery,
  OccurrenceExportCursor,
} from '../../../application/persistence/export-paging';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  occurrenceKeyset,
  toExportPage,
} from '../../../infrastructure/persistence/export-keyset';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import {
  mapSession,
  type ExerciseRow,
  type SessionRow,
  type SetRow,
} from '../../workout-session/infrastructure/workout-session-row-mapping';
import type { WorkoutSessionExportReader } from '../application/workout-session-export-reader';

export class WorkoutSessionExportSqliteReader implements WorkoutSessionExportReader {
  constructor(private readonly database: DatabaseConnection) {}

  async listCompletedSessionsPage(
    query: ExportPageQuery<OccurrenceExportCursor>,
  ): Promise<ExportPage<WorkoutSession, OccurrenceExportCursor>> {
    const keyset = occurrenceKeyset(
      {
        date: 'started_local_calendar_date',
        id: 'id',
        occurredAt: 'started_at_epoch_ms',
      },
      query.cursor,
    );
    try {
      const sessionRows = await this.database.getAll<SessionRow>(
        `SELECT * FROM workout_session
         WHERE status = ? ${keyset.sql === '' ? '' : `AND (${keyset.sql})`}
         ORDER BY started_local_calendar_date ASC, started_at_epoch_ms ASC, id ASC
         LIMIT ?`,
        ['completed', ...keyset.parameters, query.limit + 1],
      );
      // The extra look-ahead row is dropped before children are fetched so no
      // page reads snapshots it will not return.
      const pageRows = sessionRows.slice(0, query.limit);
      const sessionIds = pageRows.map((row) => row.id);
      const exerciseRows = await this.readExercises(sessionIds);
      const setRows = await this.readSets(sessionIds);

      return toExportPage(
        sessionRows,
        query.limit,
        (row) =>
          mapSession(
            row,
            exerciseRows.filter(
              (exercise) => exercise.workout_session_id === row.id,
            ),
            setRows,
          ),
        (row) => ({
          id: row.id,
          localCalendarDate: row.started_local_calendar_date,
          occurredAtEpochMilliseconds: row.started_at_epoch_ms,
        }),
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  private async readExercises(
    sessionIds: readonly string[],
  ): Promise<readonly ExerciseRow[]> {
    if (sessionIds.length === 0) return [];
    return this.database.getAll<ExerciseRow>(
      `SELECT * FROM workout_session_exercise
       WHERE workout_session_id IN (${placeholders(sessionIds)})
       ORDER BY workout_session_id ASC, position ASC`,
      [...sessionIds],
    );
  }

  private async readSets(
    sessionIds: readonly string[],
  ): Promise<readonly SetRow[]> {
    if (sessionIds.length === 0) return [];
    return this.database.getAll<SetRow>(
      `SELECT actual.* FROM workout_set actual
       JOIN workout_session_exercise exercise
         ON exercise.id = actual.workout_session_exercise_id
       WHERE exercise.workout_session_id IN (${placeholders(sessionIds)})
       ORDER BY exercise.position ASC, actual.position ASC`,
      [...sessionIds],
    );
  }
}

function placeholders(values: readonly string[]): string {
  return values.map(() => '?').join(', ');
}
