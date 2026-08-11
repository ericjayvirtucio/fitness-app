import type {
  ExportPage,
  ExportPageQuery,
  NameExportCursor,
} from '../../../application/persistence/export-paging';
import type { ExerciseCatalogItem } from './exercise-catalog-item';

/**
 * The Exercise Catalog's own projection for data export. It returns the
 * definitions that currently exist. A definition that was deleted is gone and
 * is never reconstructed from the workout snapshots that still name it.
 */
export interface ExerciseCatalogExportReader {
  listExercisesPage(
    query: ExportPageQuery<NameExportCursor>,
  ): Promise<ExportPage<ExerciseCatalogItem, NameExportCursor>>;
}
