import type { HydrationEntry } from '@fitness/domain';
import type {
  ExportPage,
  ExportPageQuery,
  OccurrenceExportCursor,
} from '../../../application/persistence/export-paging';

/**
 * Hydration's own projection for data export. Only recorded entries are
 * returned; the daily target is a single mutable current value with no history
 * and is read through its existing repository instead.
 */
export interface HydrationExportReader {
  listEntriesPage(
    query: ExportPageQuery<OccurrenceExportCursor>,
  ): Promise<ExportPage<HydrationEntry, OccurrenceExportCursor>>;
}
