import type { DatabaseConnection } from './database';
import { toPersistenceError } from './persistence-error';

export type SyncOutboxOperation = 'delete' | 'upsert';

/**
 * Records that a person-owned row has local changes not yet sent anywhere.
 *
 * One row per `(tableName, rowId)`: a record queued twice before it is ever
 * drained collapses into its latest revision and operation rather than
 * accumulating an event log, so an actively edited row — a workout logging
 * many sets, for example — costs one outbox row, not one per edit. Nothing
 * reads or drains this table yet; it is inert until a future sync design
 * consumes it.
 */
/**
 * Clears every queued outbox entry. Called only from erase-all and
 * replace-all, alongside the capability erasers: those are hard deletes of
 * every row the outbox could reference, so outbox rows left behind would
 * dangle. The outbox is bookkeeping, not user-owned content, so it has no
 * `StoredDataProbe` of its own and is cleared unconditionally rather than
 * verified empty.
 */
export async function clearOutbox(database: DatabaseConnection): Promise<void> {
  try {
    await database.run('DELETE FROM sync_outbox');
  } catch (error: unknown) {
    throw toPersistenceError(error, 'operation-failed');
  }
}

export async function queueOutboxEntry(
  database: DatabaseConnection,
  tableName: string,
  rowId: string,
  operation: SyncOutboxOperation,
  revision: number,
  queuedAtEpochMilliseconds: number,
): Promise<void> {
  try {
    await database.run(
      `INSERT INTO sync_outbox (
        table_name, row_id, operation, revision, queued_at_epoch_ms
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (table_name, row_id) DO UPDATE SET
        operation = excluded.operation,
        revision = excluded.revision,
        queued_at_epoch_ms = excluded.queued_at_epoch_ms`,
      [tableName, rowId, operation, revision, queuedAtEpochMilliseconds],
    );
  } catch (error: unknown) {
    throw toPersistenceError(error, 'operation-failed');
  }
}
