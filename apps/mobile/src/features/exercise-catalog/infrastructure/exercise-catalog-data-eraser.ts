import type { StoredDataEraser } from '../../../application/persistence/stored-data-eraser';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { deleteAllRows } from '../../../infrastructure/persistence/stored-record-erasure';

/**
 * Planned exercises reference these definitions with a restricted foreign key,
 * so the coordinator runs the Planner eraser first. This eraser does not rely
 * on that constraint being enforced; it only relies on the ordering.
 */
export class ExerciseCatalogDataEraser implements StoredDataEraser {
  constructor(private readonly database: DatabaseConnection) {}

  eraseStoredRecords(): Promise<void> {
    return deleteAllRows(this.database, ['exercise_catalog_item']);
  }
}
