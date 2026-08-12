import type { StoredDataEraser } from '../../../application/persistence/stored-data-eraser';
import type { DataRestoreTransactionContext } from '../../data-restore/application/data-restore-transaction-context';
import type { CapabilityPresenceProbes } from './capability-presence';

/**
 * Everything one replacement transaction needs, composed from a single
 * exclusive SQLite transaction so the previous dataset survives intact or the
 * whole replacement commits.
 *
 * It is the erasure context and the restore context together, deliberately:
 * replacement is not a new persistence capability, it is the two existing ones
 * running under one commit. The erasers arrive children-first from composition,
 * `target` carries the same repositories and probe list restore already uses,
 * and `presence` is those probes keyed by capability for verification. The
 * coordinator owns no table and issues no SQL of its own.
 */
export type LocalDataReplacementTransactionContext = Readonly<{
  /** Ordered so that referencing rows are removed before what they reference. */
  erasers: readonly StoredDataEraser[];
  presence: CapabilityPresenceProbes;
  target: DataRestoreTransactionContext;
}>;
