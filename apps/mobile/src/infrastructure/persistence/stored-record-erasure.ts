import type { DatabaseConnection } from './database';
import { toPersistenceError } from './persistence-error';

/**
 * Deletes every row of a capability's own tables, in the order given.
 *
 * The order matters and is the caller's responsibility. `ON DELETE CASCADE`
 * cannot be relied on here: `PRAGMA foreign_keys` is a per-connection setting
 * that is a no-op once a transaction has begun, and Expo runs an exclusive
 * transaction on a connection it opens itself, so the setting applied during
 * initialization does not necessarily reach this statement. Every caller
 * therefore lists its child tables before their parents, which is correct
 * whether or not foreign keys are enforced.
 *
 * Table names are interpolated because SQLite cannot parameterize an
 * identifier. Every caller passes module constants naming its own tables; no
 * value reaching this function comes from a file, a screen, or any other input.
 */
export async function deleteAllRows(
  database: DatabaseConnection,
  tableNames: readonly string[],
): Promise<void> {
  try {
    for (const tableName of tableNames) {
      await database.run(`DELETE FROM ${tableName}`);
    }
  } catch (error: unknown) {
    throw toPersistenceError(error, 'operation-failed');
  }
}
