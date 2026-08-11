# ADR 0014: Restore a version 1 export only into an empty installation

**Status:** Accepted

## Context

[ADR 0013](0013-versioned-offline-data-export.md) added a versioned offline
export so a user could take their information out of the application. It
deliberately preserved identifiers, canonical units, occurrence context, and
historical snapshots so restoring the file would later be possible.

Nothing can bring that file back in. After a reinstall, a replacement device, or
app-local data loss, every record is gone even though the user is holding a
complete, valid copy of it. The portability promise in `PRODUCT.md` is therefore
only half kept, and each additional logging capability increases the amount of
irreplaceable information.

Restoring into an installation that already holds records is a materially
different problem from restoring into one that does not. Two shapes of it exist:

- **Merge** the imported records with the existing ones.
- **Replace** the existing records with the imported ones.

Both are attractive because they sound like small variations of the same
feature. Neither is.

## Decision

Add a `data-restore` capability that restores a `fitness-app-data-export` file
with `formatVersion` 1 **only into an installation that contains no user-owned
records or configuration**. When any record exists, restoration does not begin,
nothing is deleted or modified, and the user is told why and offered an export
of current data instead. No overwrite option is presented.

Emptiness is determined across every capability, not by the absence of a
profile. A narrow `StoredDataProbe` port is implemented once per capability in
its own infrastructure folder, following the cross-capability reader boundary in
[ADR 0011](0011-cross-capability-derived-progress-analytics.md). The check runs
before confirmation and again inside the write transaction, so a record created
between preview and confirmation cannot be silently joined.

A selected file is untrusted input even when it declares the supported format
and version. Parsing starts from `unknown`, validates format, version, sections,
keys, primitives, enumerations, bounds, identifiers, duplicates, and occurrence
context, and then reconstructs records through the existing domain constructors.
Referential integrity is checked across records. All of this completes before
the write transaction opens.

Exported identifiers are preserved exactly. Canonical values and occurrence
triples are restored unchanged. Snapshots stay snapshots and current
configuration is never presented as history. Derived values are recomputed, not
imported.

Writing reuses each capability's existing repository methods inside one
exclusive transaction through the existing `SqliteTransactionRunner`. No new
writer contract, no bulk-repository abstraction, and no second transaction
framework is introduced. Restoration is all-or-nothing.

No migration, table, column, index, trigger, or view is added, the migration
version stays 11, and the database file itself is never restored.

## Consequences

- The recovery journey a user actually needs — export, reinstall or replace the
  device, restore — works entirely offline.
- Existing local data cannot be silently destroyed or silently blended, because
  the only supported target is an installation with nothing to lose.
- A user who already has records must export first and clear application data
  before restoring. This is a real restriction and is stated plainly in the
  interface and the documentation rather than worked around.
- The exporter and the importer share one public contract with one version
  constant, and version 1 gains a deliberate parser behind a dispatch boundary
  that a version 2 can extend without a migration framework.
- Capability boundaries survive: the coordinator still owns no table and issues
  no SQL, and each capability answers only for its own records.
- The public surface grows by one narrow read port rather than by a parallel set
  of writer contracts.
- Restoration issues one statement per record, so a very large history is bound
  by transaction throughput. Batching stays available behind the unchanged
  repository contracts if measurement justifies it.
- A complete successful restore cannot be automated end to end, because the file
  picker is platform-owned. That boundary is documented and covered by manual
  device QA with a synthetic export.

## Alternatives considered

- **Merge imported and existing records.** Rejected. Merging is synchronization
  under another name. It needs policies for identifier collisions, semantically
  duplicated records, profile, goal, and hydration-target authority, planner and
  active-session conflicts, catalog conflicts, deleted historical references,
  ordering, tombstones, conflict presentation, rollback, and recovery. None of
  those exist: the schema carries no tombstone, no update instant, and no
  deletion log, and `PRODUCT.md` requires conflict behavior, identifiers,
  clocks, deletion semantics, and recovery rules to be designed together before
  synchronization is implemented. Inventing them inside a local restore screen
  would pre-commit that design by accident.
- **Replace existing records with the imported ones.** Rejected for now. A
  transaction protects against partial technical failure; it cannot protect a
  user who selected the wrong valid file. Safe replacement needs a mandatory
  pre-replacement export, stronger confirmation, a reversible recovery copy,
  retention rules for that copy because it is sensitive, interruption recovery,
  cleanup on failure, and post-replacement verification. That is its own
  reviewed design, and empty-installation restore leaves a clean seam for it.
- **Restore the SQLite database file.** Rejected. It would replace the database
  wholesale, bypass every domain invariant, publish the internal schema as the
  real contract, and couple a saved file to migration version 11 — undoing the
  independence ADR 0013 established.
- **Treat the export contract's TypeScript interfaces as the parsed type.**
  Rejected. Compile-time types describe what this application writes. They are
  not a runtime guarantee about a file it did not create, and casting to them
  would move an untrusted value across the trust boundary unchecked.
- **Reject unknown keys.** Rejected. Nothing unvalidated is ever passed through,
  so rejection buys no safety while breaking a file that merely added a member.
- **Add per-capability restore-writer contracts.** Rejected. Every existing
  repository method already preserves identifiers, favourite and usage state,
  snapshots, and occurrence context. Parallel contracts would duplicate working
  code and grow the public surface for no behavioral gain.
- **Let one restore module write to every table directly.** Rejected. It is the
  shortest path to a working importer and the fastest way to lose the capability
  boundaries [ADR 0005](0005-capability-application-slices.md), ADR 0011, and
  ADR 0013 have maintained.
- **Define emptiness as "no profile".** Rejected. Nutrition, hydration,
  exercise, planner, session, and body-measurement records can all exist without
  a profile, and a goal configuration or hydration target can exist on its own.
  That definition would allow a silent partial merge.
- **Add a new dependency for the file picker.** Rejected. `expo-file-system` is
  already a declared direct dependency and provides the system picker on Expo
  SDK 57, with cancellation as a first-class result and no runtime storage
  permission.
- **Add foreign keys for historical source references.** Rejected. Those
  references are deliberately unconstrained so a completed workout survives the
  deletion of its catalog definition, exactly as
  [ADR 0008](0008-historical-workout-session-snapshots.md) intends. Requiring
  them to resolve would reject truthful history.
