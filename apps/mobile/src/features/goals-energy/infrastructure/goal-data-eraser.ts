import type { StoredDataEraser } from '../../../application/persistence/stored-data-eraser';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { deleteAllRows } from '../../../infrastructure/persistence/stored-record-erasure';

export class GoalDataEraser implements StoredDataEraser {
  constructor(private readonly database: DatabaseConnection) {}

  eraseStoredRecords(): Promise<void> {
    return deleteAllRows(this.database, ['goal_configuration']);
  }
}
