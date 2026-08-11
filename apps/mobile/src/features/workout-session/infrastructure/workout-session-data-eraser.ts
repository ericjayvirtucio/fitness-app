import type { StoredDataEraser } from '../../../application/persistence/stored-data-eraser';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { deleteAllRows } from '../../../infrastructure/persistence/stored-record-erasure';

/**
 * Sets, then session exercises, then sessions. Active and completed sessions
 * live in the same table, so both disappear together.
 */
export class WorkoutSessionDataEraser implements StoredDataEraser {
  constructor(private readonly database: DatabaseConnection) {}

  eraseStoredRecords(): Promise<void> {
    return deleteAllRows(this.database, [
      'workout_set',
      'workout_session_exercise',
      'workout_session',
    ]);
  }
}
