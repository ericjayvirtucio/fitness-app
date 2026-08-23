import type { ConsumptionEntry } from '@fitness/domain';
import type {
  ExportPage,
  ExportPageQuery,
  NameExportCursor,
  OccurrenceExportCursor,
} from '../../../application/persistence/export-paging';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  nameKeyset,
  occurrenceKeyset,
  toExportPage,
} from '../../../infrastructure/persistence/export-keyset';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type { NutritionCatalogItem } from '../application/nutrition-catalog-item';
import type { NutritionExportReader } from '../application/nutrition-export-reader';
import {
  consumptionEntryColumns,
  mapConsumptionEntryRow,
  mapNutritionCatalogRow,
  nutritionCatalogColumns,
  type ConsumptionEntryRow,
  type NutritionCatalogRow,
} from './nutrition-row-mapping';

export class NutritionExportSqliteReader implements NutritionExportReader {
  constructor(private readonly database: DatabaseConnection) {}

  async listEntriesPage(
    query: ExportPageQuery<OccurrenceExportCursor>,
  ): Promise<ExportPage<ConsumptionEntry, OccurrenceExportCursor>> {
    const keyset = occurrenceKeyset(
      {
        date: 'local_calendar_date',
        id: 'id',
        occurredAt: 'occurred_at_epoch_ms',
      },
      query.cursor,
    );
    try {
      const rows = await this.database.getAll<ConsumptionEntryRow>(
        `SELECT ${consumptionEntryColumns}
         FROM nutrition_consumption_entry
         WHERE deleted_at_epoch_ms IS NULL
           ${keyset.sql === '' ? '' : `AND (${keyset.sql})`}
         ORDER BY local_calendar_date ASC, occurred_at_epoch_ms ASC, id ASC
         LIMIT ?`,
        [...keyset.parameters, query.limit + 1],
      );
      return toExportPage(rows, query.limit, mapConsumptionEntryRow, (row) => ({
        id: row.id,
        localCalendarDate: row.local_calendar_date,
        occurredAtEpochMilliseconds: row.occurred_at_epoch_ms,
      }));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async listCatalogItemsPage(
    query: ExportPageQuery<NameExportCursor>,
  ): Promise<ExportPage<NutritionCatalogItem, NameExportCursor>> {
    const keyset = nameKeyset(
      { id: 'id', name: 'normalized_name' },
      query.cursor,
    );
    try {
      const rows = await this.database.getAll<NutritionCatalogRow>(
        `SELECT ${nutritionCatalogColumns}
         FROM nutrition_catalog_item
         WHERE deleted_at_epoch_ms IS NULL
           ${keyset.sql === '' ? '' : `AND (${keyset.sql})`}
         ORDER BY normalized_name ASC, id ASC
         LIMIT ?`,
        [...keyset.parameters, query.limit + 1],
      );
      return toExportPage(rows, query.limit, mapNutritionCatalogRow, (row) => ({
        id: row.id,
        normalizedName: row.normalized_name,
      }));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}
