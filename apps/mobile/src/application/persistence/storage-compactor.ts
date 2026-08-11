/**
 * Reclaims database space that deleted rows no longer need.
 *
 * Compaction is deliberately separate from deletion: it cannot run inside a
 * transaction, it changes no record, and it must never be able to turn a
 * committed deletion into a reported failure. Callers treat it as best effort.
 */
export interface StorageCompactor {
  compact(): Promise<void>;
}
