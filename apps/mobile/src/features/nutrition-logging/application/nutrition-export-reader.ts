import type { ConsumptionEntry } from '@fitness/domain';
import type {
  ExportPage,
  ExportPageQuery,
  NameExportCursor,
  OccurrenceExportCursor,
} from '../../../application/persistence/export-paging';
import type { NutritionCatalogItem } from './nutrition-catalog-item';

/**
 * Nutrition's own projection for data export. Entries keep the snapshot they
 * were logged with and are never rejoined to the catalog, so an item that was
 * later edited or deleted cannot rewrite what was recorded.
 */
export interface NutritionExportReader {
  listCatalogItemsPage(
    query: ExportPageQuery<NameExportCursor>,
  ): Promise<ExportPage<NutritionCatalogItem, NameExportCursor>>;
  listEntriesPage(
    query: ExportPageQuery<OccurrenceExportCursor>,
  ): Promise<ExportPage<ConsumptionEntry, OccurrenceExportCursor>>;
}
