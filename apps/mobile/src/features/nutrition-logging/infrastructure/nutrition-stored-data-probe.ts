import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { hasStoredRows } from '../../../infrastructure/persistence/stored-record-presence';

/** Logged entries and saved items are independent; either one means data. */
export class NutritionStoredDataProbe implements StoredDataProbe {
  constructor(private readonly database: DatabaseConnection) {}

  hasStoredRecords(): Promise<boolean> {
    return hasStoredRows(this.database, [
      'nutrition_consumption_entry',
      'nutrition_catalog_item',
    ]);
  }
}
