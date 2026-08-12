# ADR 0016: Replace local data by erasing and restoring in one verified transaction

**Status:** Accepted

## Context

[ADR 0013](0013-versioned-offline-data-export.md) made local information
portable, [ADR 0014](0014-empty-installation-data-restore.md) made it
recoverable into an installation holding nothing, and
[ADR 0015](0015-local-data-erasure.md) made emptying an installation a
deliberate, verified in-app action.

ADR 0014 rejected replacement "for now" and named what a safe design would need:
a pre-replacement export, stronger confirmation, a recovery copy, retention
rules for that copy, interruption recovery, cleanup on failure, and
post-replacement verification. ADR 0015 then built most of the missing
mechanism — capability erasers, in-transaction verification, storage compaction,
the Data controls hub, and the destructive-confirmation vocabulary — and
deliberately excluded "restore automatically after deleting", leaving
replacement to its own reviewed design.

The composed workflow that exists today is safe but fragmented: export, leave
the flow, erase, return, restore. Its destructive step runs before the incoming
file has been read at all, so erasing in order to discover that the replacement
file is invalid is the expected failure mode, and it is unrecoverable.

Replacing is not the same problem as restoring or erasing. Restoring writes into
a database known to be empty. Erasing removes records and proves nothing
survived. Replacing has to do both, in one place, without ever committing the
state in between.

## Decision

Add a guided replacement workflow to the existing `data-lifecycle` capability
that validates the incoming version 1 export **completely and outside any write
transaction**, and then erases and restores **inside one exclusive SQLite
transaction, verified before it commits**.

The guarantee is that the previous dataset survives intact or the complete
replacement dataset commits. There is no partially deleted dataset, no partially
restored one, no committed empty database caused by a failed insertion, and no
mixture of previous and incoming records.

Inside the transaction, in order: every Sprint 20 capability eraser runs
children-first; every Sprint 19 stored-data probe must then report empty; every
record is written through its owning capability's existing repository in the
Sprint 19 insertion order; and capability presence is verified against the
validated model. Any failure raises inside the callback and rolls everything
back.

Nothing new is invented at the persistence layer. `SqliteTransactionRunner` is
already generic over its context, so the replacement context simply composes the
erasers, the probes, and the repositories from one transaction connection. The
coordinator owns no table and issues no SQL, exactly as `data-restore` and
`data-lifecycle` already do not.

The single definition of insertion order moves into a shared
`writeRestoreData` function used by both empty-installation restore and
replacement, so the two paths cannot drift.

A recovery export of the current dataset is prominently recommended and may be
declined through a separate, explicit acknowledgement. It is produced by the
existing exporter into the existing application-owned cache, before the
transaction opens, so it can contain nothing incoming. It is deliberately not
deleted after the commit, because it is the user's only path back and the
application cannot tell whether the share sheet saved a copy; its retention is
bounded by the next export or replacement preparing that directory, or by the
operating system reclaiming the cache, and the user is told it is still there.

Replacement is protected by six deliberate acts, ending in a platform alert
whose destructive option reads differently from the screen's own control. A
typed confirmation phrase is not required.

Verification claims exactly what it performs: emptiness after erasure, and
capability presence parity after insertion. It does not claim record-by-record
verification.

## Consequences

- The local data lifecycle is complete offline: export, restore into an empty
  installation, replace an existing installation, and erase.
- The failure that the manual workflow made likely — erase, then discover the
  replacement file is unusable — becomes impossible, because validation
  completes before any destructive control is enabled.
- Empty-installation restore, local erasure, and export remain separately
  available and unchanged. Restore did not become an overwrite, deletion did not
  gain a restore step, and Data controls never infers intent.
- Capability boundaries survive. The public surface grows by one transaction
  context and one error type, not by a table list, a bulk writer, or a second
  parser.
- Restore and replacement share one insertion-order definition, so a future
  capability is added to one function rather than two.
- The exclusive lock is held for a deletion plus one statement per incoming
  record. That is longer than either existing operation alone and is accepted:
  this is a foreground action on a single-user device.
- Presence parity is coarser than per-table counts for Nutrition and Hydration,
  whose probes each cover two tables. That limit is documented rather than
  papered over.
- The recovery export is a sensitive file that outlives the operation that
  created it. That is deliberate, bounded, disclosed to the user, and never
  backed up by platform convention.
- `VACUUM` after replacement rebuilds a populated database, so unlike after
  erasure its cost scales with the dataset. It stays best effort and can never
  turn a committed replacement into a reported failure.
- The rollback guarantee is asserted against a real SQLite engine in tests,
  which is a change to how this repository has tested persistence.
- A complete successful replacement still cannot be automated end to end,
  because the picker and share sheet are platform-owned. That boundary is
  documented and covered by manual device QA with synthetic exports.

## Alternatives considered

- **Compose the existing erasure and empty restore sequentially.** Rejected. It
  is the smallest change and the worst guarantee: it commits an empty database
  between two transactions, so an insertion failure, a force quit, or a low
  storage condition destroys the previous dataset without producing the new one.
  That is strictly worse than today's manual workflow, in which the user at
  least chose to erase.
- **Stage the replacement in a second SQLite database and swap files.**
  Rejected. `composition/persistence.ts` caches the connection with no close
  path and screens hold use cases built from it, so the adapters would point at
  a closed handle — the same reason ADR 0015 rejected deleting the database
  file. It would additionally require migration re-runs, WAL and sidecar
  handling, rollback-file ownership, and platform-specific filesystem behavior,
  to verify a result the transaction already verifies before committing.
- **Require a recovery export before replacing.** Rejected. ADR 0015 already
  established that a user may replace or remove information without producing
  another sensitive copy of it, and the application cannot observe whether a
  share sheet saved anything, so the requirement would gate a legitimate
  operation on a condition the product cannot evaluate.
- **Offer no recovery export.** Rejected. A transaction protects against
  technical failure; it cannot protect a user who selected the wrong valid file.
  The recovery copy is the only path back, which is exactly what ADR 0014 said a
  safe replacement would need.
- **Delete the recovery export during post-commit cleanup, as erasure does.**
  Rejected. Erasure clears that cache because everything is being deleted;
  replacement would be deleting the user's safety net at the moment it becomes
  useful, on a device where the application cannot confirm any external copy
  exists.
- **Verify replacement with per-capability record counts.** Rejected on
  evidence. Only the three singletons use upsert semantics and all three are
  validated as singletons before the transaction; every other write is a plain
  insert against a primary key that throws on conflict, and duplicate
  identifiers, duplicate weekdays, and position gaps are rejected by the parser.
  There is no silent-loss write path for a count to detect, so eight new ports
  and their tests would buy no protection.
- **Verify after the transaction commits.** Rejected for the same reason ADR
  0015 rejected it: a check that runs after a commit can only report a problem
  it can no longer fix.
- **Add a `data-replacement` capability of its own.** Rejected. It would split
  the destructive family across two folders and give two capabilities a claim on
  the Data controls hub, for a workflow that reuses `data-lifecycle`'s erasers,
  confirmation vocabulary, acknowledgement component, and compaction wiring.
- **Duplicate the restore writer inside the replacement coordinator.**
  Rejected. Insertion order is a schema-shaped invariant, and two copies of it
  would diverge the first time a capability is added.
- **Add a second parser, contract, or set of limits for the replacement path.**
  Rejected. The trust boundary is identical, and a second definition of what a
  valid version 1 export is would be a second thing to keep correct.
- **Compare the incoming dataset with the current one to detect an identical
  replacement.** Rejected. It would cost a full comparison of two datasets to
  prevent an outcome that is not harmful.
- **Silently redirect an empty incoming export to local erasure.** Rejected. A
  valid empty export is a complete dataset, and substituting a different
  operation for the one the user chose is not something the workflow should do
  on its own. The preview says plainly that the file contains no records.
- **Require a typed confirmation phrase.** Rejected, for the reasons in ADR
  0015, and more so here: replacement already has three more deliberate acts
  than erasure.
