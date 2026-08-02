import { openDatabaseAsync } from 'expo-sqlite';
import { initializeDatabase } from '../infrastructure/persistence/database-initializer';
import type { DatabaseConnection } from '../infrastructure/persistence/database';
import { migrations } from '../infrastructure/persistence/migrations';
import { toPersistenceError } from '../infrastructure/persistence/persistence-error';
import { SqliteDatabaseAdapter } from '../infrastructure/persistence/sqlite-database-adapter';

const databaseName = 'fitness-app.db';
let databasePromise: Promise<DatabaseConnection> | undefined;
let initializationPromise: Promise<void> | undefined;

function getDatabase(): Promise<DatabaseConnection> {
  databasePromise ??= openDatabaseAsync(databaseName)
    .then((database) => new SqliteDatabaseAdapter(database))
    .catch((error: unknown) => {
      databasePromise = undefined;
      throw toPersistenceError(error, 'initialization-failed');
    });

  return databasePromise;
}

export function initializePersistence(): Promise<void> {
  initializationPromise ??= getDatabase()
    .then(async (database) => initializeDatabase(database, migrations))
    .catch((error: unknown) => {
      initializationPromise = undefined;
      throw toPersistenceError(error, 'initialization-failed');
    });

  return initializationPromise;
}
