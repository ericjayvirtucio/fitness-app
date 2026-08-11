import type { StoredDataEraser } from '../../../application/persistence/stored-data-eraser';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { deleteAllRows } from '../../../infrastructure/persistence/stored-record-erasure';

/** Planned exercises are removed before the workouts that own them. */
export class WorkoutPlannerDataEraser implements StoredDataEraser {
  constructor(private readonly database: DatabaseConnection) {}

  eraseStoredRecords(): Promise<void> {
    return deleteAllRows(this.database, [
      'planned_exercise',
      'planned_workout',
    ]);
  }
}
