import type { BodyWeightEntry } from '@fitness/domain';
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
import type { BodyWeightExportReader } from '../application/body-weight-export-reader';
import {
  bodyWeightEntryColumns,
  mapBodyWeightEntryRow,
  type BodyWeightEntryRow,
} from './body-weight-row-mapping';

export class BodyWeightExportSqliteReader implements BodyWeightExportReader {
  constructor(private readonly database: DatabaseConnection) {}

  async listCheckInsPage(
    query: ExportPageQuery<OccurrenceExportCursor>,
  ): Promise<ExportPage<BodyWeightEntry, OccurrenceExportCursor>> {
    const keyset = occurrenceKeyset(
      {
        date: 'local_calendar_date',
        id: 'id',
        occurredAt: 'occurred_at_epoch_ms',
      },
      query.cursor,
    );
    try {
      const rows = await this.database.getAll<BodyWeightEntryRow>(
        `SELECT ${bodyWeightEntryColumns}
         FROM body_weight_entry
         ${keyset.sql === '' ? '' : `WHERE ${keyset.sql}`}
         ORDER BY local_calendar_date ASC, occurred_at_epoch_ms ASC, id ASC
         LIMIT ?`,
        [...keyset.parameters, query.limit + 1],
      );
      return toExportPage(rows, query.limit, mapBodyWeightEntryRow, (row) => ({
        id: row.id,
        localCalendarDate: row.local_calendar_date,
        occurredAtEpochMilliseconds: row.occurred_at_epoch_ms,
      }));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}
