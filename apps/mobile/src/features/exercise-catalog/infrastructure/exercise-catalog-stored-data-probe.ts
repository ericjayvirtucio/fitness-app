import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { hasStoredRows } from '../../../infrastructure/persistence/stored-record-presence';

export class ExerciseCatalogStoredDataProbe implements StoredDataProbe {
  constructor(private readonly database: DatabaseConnection) {}

  hasStoredRecords(): Promise<boolean> {
    return hasStoredRows(this.database, ['exercise_catalog_item']);
  }
}
