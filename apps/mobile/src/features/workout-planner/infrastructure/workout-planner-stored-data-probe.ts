import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { hasStoredRows } from '../../../infrastructure/persistence/stored-record-presence';

/**
 * Planned exercises are cascade-deleted children of a planned workout, so they
 * cannot exist without the parent this probe already covers.
 */
export class WorkoutPlannerStoredDataProbe implements StoredDataProbe {
  constructor(private readonly database: DatabaseConnection) {}

  hasStoredRecords(): Promise<boolean> {
    return hasStoredRows(this.database, ['planned_workout']);
  }
}
