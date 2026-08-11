import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { hasStoredRows } from '../../../infrastructure/persistence/stored-record-presence';

/**
 * Covers active and completed sessions alike. Session exercises and sets are
 * cascade-deleted children and cannot exist without their session.
 */
export class WorkoutSessionStoredDataProbe implements StoredDataProbe {
  constructor(private readonly database: DatabaseConnection) {}

  hasStoredRecords(): Promise<boolean> {
    return hasStoredRows(this.database, ['workout_session']);
  }
}
