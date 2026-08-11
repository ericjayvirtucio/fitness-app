import type { WorkoutSession } from '@fitness/domain';
import type {
  ExportPage,
  ExportPageQuery,
  OccurrenceExportCursor,
} from '../../../application/persistence/export-paging';

/**
 * Workout History's own projection for data export.
 *
 * It returns completed sessions with their stored exercise and set snapshots
 * rather than the derived list model the history screens use, because export
 * carries recorded facts and never a presentation summary. The cursor triple
 * addresses the started local date, started instant, and identifier.
 */
export interface WorkoutSessionExportReader {
  listCompletedSessionsPage(
    query: ExportPageQuery<OccurrenceExportCursor>,
  ): Promise<ExportPage<WorkoutSession, OccurrenceExportCursor>>;
}
