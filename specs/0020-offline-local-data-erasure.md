# Specification 0020: Offline local data erasure

**Status:** Approved for implementation on 2026-08-11.

## Objective and scope

[Specification 0018](0018-offline-data-export.md) made locally stored
information portable. [Specification 0019](0019-offline-data-restore.md) made it
recoverable, but only into an installation that holds nothing. The only way to
reach that state today is to leave the application, clear its data through
operating-system controls, and relaunch — a hidden, platform-specific step that
the application itself documents as a workaround.

This specification adds the third and final local data-lifecycle operation: one
deliberate in-app action that erases every user-owned record this installation
stores, verifies the result, and returns the application to a truthful first-run
state.

Erasure requires no network, account, backend, cloud storage, telemetry,
external analytics, or AI provider. It deletes nothing outside the application's
own storage.

Cloud deletion, account deletion, merge import, replacement restore, automatic
restoration after deletion, scheduled or selective deletion, secure encrypted
backups, and remote or device-wide wipe are out of scope.

## Erasure workflow

```text
Profile
  → Data controls
      → Export my data        (existing /data-export)
      → Restore my data       (existing /data-restore)
      → Delete all local data (/delete-local-data)
          → what is removed and what is not
          → optional: Export my data first
          → acknowledge that this cannot be undone
          → Delete all local data
          → destructive confirmation
          → Deleting local data → Verifying → Cleaning up
          → persistent completion
          → return to a first-run Profile
```

## What erasure means

A successful erasure leaves the product in the same meaningful user-data state
as a fresh installation after migrations have run.

Erasure is irreversible from the application's point of view. It creates no
tombstone, no soft-delete copy, no hidden recovery copy, and no undo history. It
fabricates no replacement record and recreates no default the fresh-install
behavior does not already create.

## Exactly what is deleted

Every row of every user-owned table:

| Capability       | Tables                                                       |
| ---------------- | ------------------------------------------------------------ |
| Workout Session  | `workout_set`, `workout_session_exercise`, `workout_session` |
| Workout Planner  | `planned_exercise`, `planned_workout`                        |
| Exercise Catalog | `exercise_catalog_item`                                      |
| Nutrition        | `nutrition_consumption_entry`, `nutrition_catalog_item`      |
| Hydration        | `hydration_entry`, `hydration_target`                        |
| Body Measurement | `body_weight_entry`                                          |
| Goals & Energy   | `goal_configuration`                                         |
| Personal Profile | `personal_profile`                                           |

Plus the application-owned export cache, `<cache>/data-export/`, which holds at
most one generated export file.

## Exactly what is preserved

The database file, its schema, every index, the
`prevent_referenced_exercise_logging_mode_change` trigger, and
`PRAGMA user_version = 11`; the installation and its binaries; export files the
user already saved elsewhere; the file a user selected for a restore; everything
outside the application sandbox; and QA infrastructure. The application remains
immediately usable and can create new records at once.

The application stores no theme or display preference: appearance follows the
operating system, so nothing of that kind exists to preserve or delete.

## Storage inventory

Local persistence is SQLite plus one application-owned cache directory. There is
no `AsyncStorage`, secure store, key-value store, or persisted navigation state
anywhere in `apps/mobile`.

The document picker on iOS is created with `asCopy: true`, so the operating
system places a copy of a selected restore file in the application's temporary
directory. The application never records that location, never reads it after a
restore completes, and cannot enumerate it: `expo-file-system` exposes `cache`,
`bundle`, and `document` paths only. Erasure therefore cannot reach it, and the
documentation says so rather than implying otherwise. The operating system
reclaims that directory.

## Capability ownership

A new `data-lifecycle` capability coordinates only. It owns no table and issues
no SQL, exactly as `data-restore` does.

Each capability answers for its own tables through a narrow port,
`StoredDataEraser`, implemented once per capability in its own infrastructure
folder beside its existing `StoredDataProbe`. A shared `deleteAllRows` helper
holds the one bounded statement, mirroring `hasStoredRows`. Table names are
module constants owned by the capability; no value from a file, a screen, or any
other input reaches a statement.

A future table is erased by extending its own capability's eraser, next to the
probe that already has to learn about it.

## Deletion order and foreign keys

Rows are deleted children first:

`workout_set` → `workout_session_exercise` → `workout_session` →
`planned_exercise` → `planned_workout` → `exercise_catalog_item` →
`nutrition_consumption_entry` → `nutrition_catalog_item` → `hydration_entry` →
`hydration_target` → `body_weight_entry` → `goal_configuration` →
`personal_profile`.

`ON DELETE CASCADE` is deliberately not relied upon. `PRAGMA foreign_keys` is a
per-connection setting and a no-op once a transaction has begun, and Expo's
`withExclusiveTransactionAsync` runs the transaction on a connection it opens
itself, so the `foreign_keys = ON` applied during initialization cannot be
assumed to hold inside the write transaction. Explicit child-first deletion is
correct whether or not it does, and a test asserts that every child table is
deleted by an explicit statement rather than left to a cascade.

The same reasoning means the restricted reference from `planned_exercise` to
`exercise_catalog_item` is not treated as a safety net; the order above removes
the reference before its target either way.

## Transaction strategy

One exclusive transaction through the existing `SqliteTransactionRunner`. No
second transaction framework is introduced. Its context holds the ordered
capability erasers and the eight Sprint 19 stored-data probes.

Inside the transaction, in order:

1. every capability eraser runs;
2. every stored-data probe runs.

Any probe that still reports records fails the operation, which rolls the whole
deletion back. Logical deletion is therefore all-or-nothing, and a partially
erased database is never presented as success.

The exclusive lock prevents a concurrent write from landing between deletion and
verification.

## Verification

Verification runs inside the transaction and nowhere else. A failure there can
still be undone; a failure after commit could only report a problem it can no
longer fix. Verification covers every capability probe, so "empty" never means
"no profile".

## Temporary-file cleanup

After the transaction commits, the application removes the export it controls by
reusing the existing `ClearDataExportsUseCase`, which deletes and recreates
`<cache>/data-export/`. That use case now reports a failure to its caller
instead of swallowing it: the export screen still continues, because the next
export prepares the directory again, while erasure reports a cleanup warning.

Nothing else is touched. No other capability's cache, no document directory, no
file the user selected, and nothing outside the sandbox. No file path appears in
any message.

## Storage hygiene after commit

Two best-effort statements run on the main connection after the transaction, in
order:

1. `PRAGMA wal_checkpoint(TRUNCATE)` moves committed frames into the database
   and truncates the write-ahead log.
2. `VACUUM` rebuilds the database, releasing free pages that still hold deleted
   bytes and shrinking the file. On a database that was just emptied it copies
   almost nothing, so the usual cost objection does not apply.

Neither can run inside a transaction. Both are caught deliberately and neither
can turn a successful deletion into a reported failure, because the records are
already gone.

`PRAGMA secure_delete` is not enabled. It is per-connection and would have to be
set on a connection the application does not construct, it only zeroes pages
freed after it is set, and on flash storage with wear levelling and platform
encryption it does not justify a write cost paid by every ordinary transaction.
`VACUUM` addresses the same free-page concern once, where it matters.

## What the application may honestly claim

After a successful erasure the application holds no information about the user,
the database contains no user records, the write-ahead log is truncated, and the
database file has been rebuilt so free pages holding deleted bytes are released
to the filesystem.

The application does not claim that bytes are unrecoverable. Flash wear
levelling, filesystem snapshots, and operating-system backups are outside its
control, and protection against off-device recovery comes from iOS Data
Protection and Android file-based encryption. Product language is therefore
"Delete all local data" and "Everything this app has stored on this device will
be deleted", never "permanently unrecoverable", "secure wipe", or any claim
about an account or a cloud copy, of which the product has neither.

## Confirmation

Three deliberate acts, and no fewer:

1. reaching a dedicated screen, which is not a row on the Profile form;
2. acknowledging in the application that the action cannot be undone, which is
   what enables the destructive control;
3. confirming in a platform alert whose destructive option is distinct from the
   screen's own control.

Erasure never happens through navigation, a screen mount, application startup, a
restore or export failure, background cleanup, a migration, retry behavior, or
an unlabelled icon.

A typed confirmation phrase is deliberately not required. It adds keyboard,
localization, and cognitive cost without adding meaningful protection beyond
three deliberate acts, and the repository already confirms smaller destructive
actions with a platform alert.

## Export before erasure

The screen offers **Export my data**, which navigates to the existing export
screen. No export generation or sharing logic is duplicated. An export is never
mandatory, never generated silently, and never claimed to have been saved: the
application cannot see where a share sheet sent a file, and a dismissed share
sheet stays a neutral outcome. The user returns and confirms deliberately.

## Application state after erasure

No process restart, composition reset, application-shell remount,
persistence-generation key, or hidden global state is introduced. The database
connection stays open and valid, which is the main practical reason rows are
deleted rather than the database file.

On completion the stack is dismissed and the Profile tab is replaced, so no back
gesture can reach a route whose entity no longer exists — including an active
workout. Every product screen already reloads on focus, so a mounted tab
re-reads and finds nothing. Profile shows its first-run empty state and Progress
shows no history. Stale asynchronous results are discarded by the same mounted
and request-sequence guards the restore screen uses.

## Navigation

Two new routes: `/data-controls` and `/delete-local-data`. The Profile screen
replaces its separate export and restore actions with one **Data controls**
action in both the populated and the empty state, which reduces the action list
below the profile form and gives the three lifecycle operations one coherent
home. Restoring is therefore one tap further from the empty state than in Sprint
19; that cost is accepted so a single path reaches every lifecycle operation in
both profile states. No tab is added.

## Failure, interruption, and recovery

| Situation                                       | Behavior                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Initial stored-data check fails                 | Operation unavailable, retry offered, nothing deleted                                                      |
| Any capability eraser fails                     | Whole transaction rolled back, nothing deleted                                                             |
| Verification finds remaining records            | Whole transaction rolled back, reported as a failure                                                       |
| Export-cache cleanup fails after commit         | Success with a cleanup warning                                                                             |
| Checkpoint or `VACUUM` fails after commit       | Success; best effort, documented, not user-facing                                                          |
| Nothing is stored yet                           | Destructive control disabled with a stated reason                                                          |
| User backs out before confirming                | Neutral outcome, nothing changed                                                                           |
| Application backgrounded before confirming      | Nothing happened; acknowledgement is not persisted                                                         |
| Application closes during the transaction       | SQLite rolls back; data intact; the user may retry                                                         |
| Application closes after commit, before cleanup | Data gone; a stale export is removed on the next export screen visit                                       |
| Repeated erasure request                        | Control disabled while busy; the exclusive lock serializes; erasing an empty installation is a valid no-op |
| Stale asynchronous completion                   | Discarded by request identity                                                                              |

No startup retry is added, because an interrupted erasure leaves nothing
half-done to repair.

## Errors

`LocalDataErasureError` carries one of `storage-unavailable`, `erase-failed`,
`verification-failed`, or `cleanup-incomplete`, each with a fixed safe message,
mirroring `PersistenceError`, `DataExportError`, and `DataRestoreError`.
`cleanup-incomplete` is a warning attached to a successful deletion, not a
failure.

No SQL, table name, stack trace, internal path, identifier, personal detail, or
fitness value reaches a user-facing message. The capability performs no logging,
so no log path exists to leak into.

## Privacy and security

The operation is always initiated by the user and always confirmed. It performs
no network call, telemetry, analytics, or AI request, requests no new
permission, writes no backup, keeps no recovery copy, and deletes nothing the
application does not own. No local password or PIN is introduced and no custom
cryptography is written; the device session and the application sandbox remain
the access boundary. Automated and manual QA use synthetic data only.

## Accessibility

The workflow uses existing design-system components across its explaining,
acknowledged, confirming, deleting, verifying, cleaning, failed, and complete
states. The destructive control is explicitly named "Delete all local data", is
never an icon alone, keeps its label when disabled, and states why it is
disabled. The acknowledgement exposes a checkbox role and its checked state at
the minimum touch target. Phase changes are announced through a polite live
region, the completion panel is persistent rather than a transient toast, focus
moves to it, content wraps under large Dynamic Type without horizontal
scrolling, and no state is communicated by color alone.

## Performance

Thirteen bounded `DELETE` statements, eight presence probes, one checkpoint, and
one `VACUUM` over an emptied database. Cost is bounded by page count rather than
record count, and stays below export, which serializes every record. No
background worker is introduced and no percentage is invented; status is
phase-based. On a device low on storage `VACUUM` may fail, which is a caught,
documented, non-user-facing outcome.

## Progress, restore, and migrations

Progress semantics are unchanged. It persists nothing, so it becomes empty
because its sources are empty; no zero-history record is created.

After a successful erasure every stored-data probe reports empty, so Sprint 19's
empty-target policy is satisfied and restoring becomes eligible. Nothing is
automatic: no picker opens, no source path is retained, no export is
re-restored, and deletion and restoration never share a transaction.

No migration is added and `user_version` stays 11. No table, column, index,
trigger, or view is added or removed, and no dependency is added, removed, or
upgraded.

## Verification and completion

- Erasure use-case tests cover an empty installation; installations holding only
  a profile, only a goal, only nutrition, only hydration, only exercises, only a
  plan, only an active session, only completed history, and only weight
  check-ins; a fully populated installation; capability order; failure in each
  phase; rollback preserving the prior logical state; verification failure
  reported as failure; repeated requests; and safe persistence-error
  translation.
- A capability eraser test proves child-first table order without relying on
  cascade, and the shared helper is tested for order and error translation.
- Cleanup tests cover a removed generated export, a propagated cleanup failure
  reported as a warning, and the absence of any internal path in a message.
- Presentation tests cover the explanation, the export option, acknowledgement
  gating, the destructive confirmation, cancellation, busy phases, disabled
  controls, failure and retry, the cleanup warning, persistent completion, the
  nothing-stored state, live-region behavior, and accessibility labels.
- Profile tests cover the Data controls entry point in both profile states.
- Sprint 20 Maestro scenarios cover opening Data controls, reviewing the
  deletion explanation, cancelling without changing data, deleting a populated
  installation, the first-run state afterwards, persistence across a relaunch,
  and restore becoming eligible.
- The iOS regression suite passes on the final branch state.
- Repository formatting, lint, type checking, tests, and builds pass without
  warnings.

## Explicit exclusions

Cloud or account deletion, authentication, merge import, replacement restore,
automatic or scheduled restoration, automatic or scheduled deletion, retention
policies, per-capability or date-range deletion, encrypted backups, custom
cryptography, remote or device-wide wipe, deleting user-saved exports or any
file outside the sandbox, uninstalling the application, synchronization,
tombstones, soft deletion, fabricated undo history, analytics, telemetry, AI,
notifications, new measurement types, charts, database-file deletion, connection
close and reopen lifecycle, `PRAGMA secure_delete`, deleting the platform
picker's temporary copy, a design-system checkbox component, domain-package or
API changes, SQLite migrations, repository-wide refactoring, broad dependency
upgrades, a second end-to-end runner, hidden reset routes, production seeders,
and test-only deletion bypasses are all excluded.
