import type { StoredDataEraser } from '../../../application/persistence/stored-data-eraser';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { deleteAllRows } from '../../../infrastructure/persistence/stored-record-erasure';

/** The configured daily target is user-owned configuration, not a default. */
export class HydrationDataEraser implements StoredDataEraser {
  constructor(private readonly database: DatabaseConnection) {}

  eraseStoredRecords(): Promise<void> {
    return deleteAllRows(this.database, [
      'hydration_entry',
      'hydration_target',
    ]);
  }
}
