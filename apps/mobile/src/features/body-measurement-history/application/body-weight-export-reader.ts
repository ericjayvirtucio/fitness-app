import type { BodyWeightEntry } from '@fitness/domain';
import type {
  ExportPage,
  ExportPageQuery,
  OccurrenceExportCursor,
} from '../../../application/persistence/export-paging';

/**
 * Body Measurement History's own projection for data export.
 *
 * It returns recorded check-ins in ascending recorded order, which is the
 * opposite of the newest-first history screens, and it never reads the current
 * profile weight. The two remain separate answers to separate questions.
 */
export interface BodyWeightExportReader {
  listCheckInsPage(
    query: ExportPageQuery<OccurrenceExportCursor>,
  ): Promise<ExportPage<BodyWeightEntry, OccurrenceExportCursor>>;
}
