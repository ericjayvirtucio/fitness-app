import type {
  ExportPage,
  ExportPageQuery,
  NameExportCursor,
} from '../../../application/persistence/export-paging';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  nameKeyset,
  toExportPage,
} from '../../../infrastructure/persistence/export-keyset';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type { ExerciseCatalogExportReader } from '../application/exercise-catalog-export-reader';
import type { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import {
  exerciseColumns,
  mapExerciseRow,
  type ExerciseRow,
} from './exercise-row-mapping';

export class ExerciseCatalogExportSqliteReader implements ExerciseCatalogExportReader {
  constructor(private readonly database: DatabaseConnection) {}

  async listExercisesPage(
    query: ExportPageQuery<NameExportCursor>,
  ): Promise<ExportPage<ExerciseCatalogItem, NameExportCursor>> {
    const keyset = nameKeyset(
      { id: 'id', name: 'normalized_name' },
      query.cursor,
    );
    try {
      const rows = await this.database.getAll<ExerciseRow>(
        `SELECT ${exerciseColumns}
         FROM exercise_catalog_item
         ${keyset.sql === '' ? '' : `WHERE ${keyset.sql}`}
         ORDER BY normalized_name ASC, id ASC
         LIMIT ?`,
        [...keyset.parameters, query.limit + 1],
      );
      return toExportPage(rows, query.limit, mapExerciseRow, (row) => ({
        id: row.id,
        normalizedName: row.normalized_name,
      }));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}
