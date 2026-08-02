import type { DatabaseConnection } from './database';
import type { Migration } from './migrations';
import { PersistenceError } from './persistence-error';

function toInitializationError(error: unknown): PersistenceError {
  if (
    error instanceof PersistenceError &&
    (error.code === 'migration-failed' ||
      error.code === 'unsupported-schema-version')
  ) {
    return error;
  }

  return new PersistenceError('initialization-failed', { cause: error });
}

function validateMigrations(availableMigrations: readonly Migration[]): void {
  availableMigrations.forEach((migration, index) => {
    const expectedVersion = index + 1;

    if (migration.version !== expectedVersion) {
      throw new PersistenceError('migration-failed');
    }
  });
}

export async function initializeDatabase(
  database: DatabaseConnection,
  availableMigrations: readonly Migration[],
): Promise<void> {
  try {
    validateMigrations(availableMigrations);
    await database.exec('PRAGMA foreign_keys = ON');
    await database.exec('PRAGMA journal_mode = WAL');

    const currentVersion = await database.getVersion();
    const latestVersion = availableMigrations.length;

    if (
      !Number.isSafeInteger(currentVersion) ||
      currentVersion < 0 ||
      currentVersion > latestVersion
    ) {
      throw new PersistenceError('unsupported-schema-version');
    }

    const pendingMigrations = availableMigrations.slice(currentVersion);

    for (const migration of pendingMigrations) {
      try {
        await database.runExclusive(async (transaction) => {
          await migration.up(transaction);
          await transaction.exec(`PRAGMA user_version = ${migration.version}`);
        });
      } catch (error: unknown) {
        throw error instanceof PersistenceError &&
          error.code === 'migration-failed'
          ? error
          : new PersistenceError('migration-failed', { cause: error });
      }
    }
  } catch (error: unknown) {
    throw toInitializationError(error);
  }
}
