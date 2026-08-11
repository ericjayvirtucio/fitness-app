import type { DatabaseConnection } from './database';
import { toPersistenceError } from './persistence-error';

/**
 * Answers "does any row exist" for a capability's own tables.
 *
 * Every stored-data probe needs the same bounded question, so the query lives
 * once here rather than eight times. It selects a constant and stops at the
 * first row, so the cost does not grow with a long history, and it reads no
 * column, so no stored value is ever loaded to decide emptiness.
 *
 * Table names are interpolated because SQLite cannot parameterize an identifier.
 * Every caller passes a module constant naming its own table; no value reaching
 * this function comes from a file, a screen, or any other input.
 */
export async function hasStoredRows(
  database: DatabaseConnection,
  tableNames: readonly string[],
): Promise<boolean> {
  try {
    for (const tableName of tableNames) {
      const row = await database.getFirst<{ present: number }>(
        `SELECT 1 AS present FROM ${tableName} LIMIT 1`,
      );
      if (row !== null) return true;
    }
    return false;
  } catch (error: unknown) {
    throw toPersistenceError(error, 'operation-failed');
  }
}
