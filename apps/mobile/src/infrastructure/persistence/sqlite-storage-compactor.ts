import type { StorageCompactor } from '../../application/persistence/storage-compactor';
import type { DatabaseConnection } from './database';
import { toPersistenceError } from './persistence-error';

/**
 * Truncates the write-ahead log and rebuilds the database file.
 *
 * Deleting rows returns their pages to SQLite's free list; it does not return
 * the bytes to the filesystem, and committed frames stay in the write-ahead log
 * until a checkpoint. Running both after an erasure is what lets the product
 * say the file was rebuilt without claiming anything about physical recovery.
 *
 * Neither statement may run inside a transaction, so this works on the main
 * connection after the erasure transaction has committed. On a database that
 * was just emptied, `VACUUM` copies almost nothing.
 */
export class SqliteStorageCompactor implements StorageCompactor {
  constructor(private readonly database: DatabaseConnection) {}

  async compact(): Promise<void> {
    try {
      await this.database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      await this.database.exec('VACUUM');
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}
