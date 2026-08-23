import type { HydrationEntry } from '@fitness/domain';
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
import type { HydrationExportReader } from '../application/hydration-export-reader';
import {
  hydrationEntryColumns,
  mapHydrationEntryRow,
  type HydrationEntryRow,
} from './hydration-row-mapping';

export class HydrationExportSqliteReader implements HydrationExportReader {
  constructor(private readonly database: DatabaseConnection) {}

  async listEntriesPage(
    query: ExportPageQuery<OccurrenceExportCursor>,
  ): Promise<ExportPage<HydrationEntry, OccurrenceExportCursor>> {
    const keyset = occurrenceKeyset(
      {
        date: 'local_calendar_date',
        id: 'id',
        occurredAt: 'occurred_at_epoch_ms',
      },
      query.cursor,
    );
    try {
      const rows = await this.database.getAll<HydrationEntryRow>(
        `SELECT ${hydrationEntryColumns}
         FROM hydration_entry
         WHERE deleted_at_epoch_ms IS NULL
           ${keyset.sql === '' ? '' : `AND (${keyset.sql})`}
         ORDER BY local_calendar_date ASC, occurred_at_epoch_ms ASC, id ASC
         LIMIT ?`,
        [...keyset.parameters, query.limit + 1],
      );
      return toExportPage(rows, query.limit, mapHydrationEntryRow, (row) => ({
        id: row.id,
        localCalendarDate: row.local_calendar_date,
        occurredAtEpochMilliseconds: row.occurred_at_epoch_ms,
      }));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}
