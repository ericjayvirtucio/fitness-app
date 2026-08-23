import type { StoredDataEraser } from '../../../application/persistence/stored-data-eraser';
import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';

/**
 * Everything one erasure transaction needs, composed from one exclusive SQLite
 * transaction so the whole installation is emptied or none of it is.
 *
 * Both lists are ordered by composition, not by this capability: the erasers
 * arrive children-first, and the probes are the same ones restore already uses
 * to decide whether an installation is empty. The coordinator owns no table and
 * issues no SQL of its own.
 */
export type LocalDataErasureTransactionContext = Readonly<{
  /** Clears every queued local-change record; see `clearOutbox`. */
  clearOutbox: () => Promise<void>;
  /** Ordered so that referencing rows are removed before what they reference. */
  erasers: readonly StoredDataEraser[];
  /** One per capability, so "empty" cannot quietly mean "no profile". */
  probes: readonly StoredDataProbe[];
}>;
