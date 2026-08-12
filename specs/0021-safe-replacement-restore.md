# Specification 0021: Safe replacement restore

**Status:** Approved for implementation on 2026-08-12.

## Objective and scope

[Specification 0018](0018-offline-data-export.md) made locally stored
information portable, [specification 0019](0019-offline-data-restore.md) made it
recoverable into an installation that holds nothing, and
[specification 0020](0020-offline-local-data-erasure.md) made emptying an
installation a deliberate in-app action.

Replacing one dataset with another is now possible but fragmented: export the
current information, leave that screen, open deletion, confirm erasure, return
to Data controls, open restore, select the replacement file, and restore it. The
destructive step happens before the incoming file has ever been read, so a user
can erase everything and only then discover that their replacement file is
invalid, an unsupported version, oversized, or simply the wrong file. Nothing in
the product recovers from that.

This specification adds a fourth local data-lifecycle operation: one guided
workflow that validates an incoming version 1 export completely, offers a
recovery export of the current dataset, and then replaces the local dataset in
one exclusive transaction that either commits the whole replacement or leaves
the previous dataset untouched.

Replacement requires no network, account, backend, cloud storage, telemetry,
external analytics, or AI provider. A destination chosen from the platform share
sheet may independently use a network service; the application never uploads
anything itself.

Merge import, synchronization, conflict resolution, selective or date-range
replacement, scheduled replacement, cloud backup, encrypted archives, and
database-file swapping are out of scope.

## Replacement workflow

```text
Profile
  → Data controls
      → Export my data                 (existing /data-export)
      → Restore my data                (existing /data-restore)
      → Replace local data from an export (/replace-local-data)
          → what replacement does, and what it cannot promise
          → Choose file → the operating system's file picker
          → read the file
          → validate the complete file
          → review non-sensitive record counts
          → recovery decision:
              → Create a recovery export → Open share options
              → or acknowledge continuing without one
          → acknowledge that current information will be replaced
          → Replace all local data → destructive platform alert
          → one exclusive transaction: erase → verify → insert → verify
          → persistent completion
          → return to the application showing the replacement dataset
      → Delete all local data          (existing /delete-local-data)
```

Validation is a completed step before any destructive control is enabled. That
separation is what makes the operation safe, and it also gives assistive
technology a persistent panel to announce and gives automated tests a stable
boundary on each side of the platform-owned picker.

## What replacement is, and is not

Replacement makes the incoming validated dataset the whole local dataset. No
record from the previous dataset survives, and no record from either side is
reconciled with the other.

It is not merge. Merging needs identifier-collision policies, semantic duplicate
detection, singleton authority rules, tombstones, update clocks, a deletion log,
conflict presentation, and recovery semantics. The schema carries none of those,
and `PRODUCT.md` requires conflict behavior, identifiers, clocks, deletion
semantics, and recovery rules to be designed together before synchronization is
implemented. Replacement introduces none of those primitives, so the seam
[ADR 0014](../docs/decisions/0014-empty-installation-data-restore.md) left for a
future reconciler stays clean.

It is not empty-installation restore. That operation refuses when any record
exists and remains available and unchanged.

It is not erasure. Erasure removes information and restores nothing, and remains
separately available.

## Non-negotiable ordering

A replacement never begins before the incoming file has been completely read,
format-checked, version-checked, structurally validated, domain-validated,
referentially validated, bounded by the existing resource limits, and summarized
for the user. Nothing is erased in order to discover whether the incoming file
is valid.

## Validation

Specification 0019's parser is reused unchanged. There is no second parser, no
second policy module, and no second set of limits. All twenty pre-transaction
layers run in the same order — picker result, file accessibility, metadata size,
UTF-8 decoding, JSON parsing, top-level shape, `format`, `formatVersion`, exact
sections, required keys, primitives, enumerations, string and collection bounds,
finite and integral numbers, identifiers, duplicates per identity scope,
occurrence context, domain reconstruction, cross-record referential integrity,
and the preview.

A selected file remains untrusted input. Parsing starts from `unknown`. `any`,
unsafe assertions, `@ts-ignore`, disabled lint rules, unchecked enum casts, and
direct JSON-to-SQL insertion stay prohibited in this workflow, exactly as they
are in `data-restore`.

File and format failures surface as the existing `DataRestoreError` values,
because those messages already say the right thing and adding parallel codes
would duplicate a working vocabulary.

## Recovery export policy

The application prominently recommends creating a recovery export of the current
dataset and allows an explicit, separately acknowledged opt-out.

Requiring one is rejected. [ADR 0015](../docs/decisions/0015-local-data-erasure.md)
already established that a user may remove information without producing another
copy of it, and the application cannot see whether a share sheet saved anything,
so a mandatory export would block a legitimate replacement on a condition the
product cannot evaluate. Omitting the offer entirely is also rejected: it is the
only path back from replacing valuable information with the wrong valid file.

Continuing without a recovery export therefore requires its own acknowledgement,
distinct from the acknowledgement that current information will be replaced. Two
acknowledgements exist only on the opt-out path.

The application never claims a recovery export was saved. Opening the share
sheet is a handoff, and a dismissed sheet stays a neutral outcome.

## Recovery export lifecycle

The recovery export is produced by the existing `CreateDataExportUseCase`, in
its own exclusive read transaction, before the replacement transaction opens. No
second export contract, mapping, or serializer exists, and the file is written
to the same application-owned cache directory, `<cache>/data-export/`, which
holds at most one generated export at a time.

Because it is generated before replacement begins, it contains only the current
dataset. No incoming record can reach it.

It is deliberately **not** removed after the replacement commits. Erasure clears
that cache because everything is being deleted; replacement must not, because
the recovery export is the user's only path back and the application cannot tell
whether the share sheet saved a copy. Deleting it at the moment it becomes
useful would defeat the purpose of creating it.

Its retention is bounded and stated: it stays in the application-owned cache
until the next export or the next replacement prepares that directory again, or
until the operating system reclaims the cache. The cache is inside the sandbox
and is excluded from device backup by platform convention. The completion panel
tells the user the copy is still on the device and offers the share controls
again. Its contents and its path are never logged, and no file outside the
sandbox is ever removed.

## Incoming file lifecycle

The picker returns an operating-system-created temporary copy on iOS and may
return a content URI on Android. The application reads it once, parses it into
an immutable validated model, and never touches it again. By the time the
replacement transaction opens, only that model is held, so the source file is
not needed and cannot be invalidated by anything the application does.

The incoming file never lands in `<cache>/data-export/`, so preparing the
recovery export cannot delete it.

## Transaction strategy

One exclusive transaction through the existing `SqliteTransactionRunner`. No
second transaction framework, no nested transaction, and no new runner. Its
context composes, from the same transaction connection, the Sprint 20 capability
erasers, the Sprint 19 stored-data probes, and the Sprint 19 capability
repositories.

Inside the transaction, in this order:

1. every capability eraser runs, children first;
2. every stored-data probe runs and must report empty;
3. every record is written through its owning capability's existing repository;
4. capability presence is verified against the validated model.

Any failure at any step raises inside the callback, which rolls the whole
transaction back.

The guarantee is therefore: **the previous dataset survives intact, or the
complete replacement dataset commits.** Never a partially deleted dataset, never
a partially restored one, never a committed empty database caused by a failed
insertion, and never a mixture of previous and incoming records.

Sequential erase-then-restore is rejected precisely because it commits an empty
database between two transactions, where an interruption or an insertion failure
destroys the previous dataset without producing the new one. Staging a second
database and swapping files is rejected for the reasons recorded in
[ADR 0016](../docs/decisions/0016-atomic-local-data-replacement.md).

### Deletion order

The Sprint 20 order, unchanged, so a referencing row is always removed before
what it references:

`workout_set` → `workout_session_exercise` → `workout_session` →
`planned_exercise` → `planned_workout` → `exercise_catalog_item` →
`nutrition_consumption_entry` → `nutrition_catalog_item` → `hydration_entry` →
`hydration_target` → `body_weight_entry` → `goal_configuration` →
`personal_profile`.

`ON DELETE CASCADE` is not relied upon here for the same measured reason
recorded in specification 0020: the exclusive transaction runs on a connection
whose foreign-key enforcement the application does not control.

### Insertion order

The Sprint 19 order, unchanged: profile, goal configuration, nutrition catalog
items, nutrition entries, hydration entries, the current hydration target,
exercise definitions, planned workouts, completed sessions, the active session,
and body-weight check-ins.

The one definition of that order moves into a shared `writeRestoreData` function
used by both empty-installation restore and replacement, so the two paths cannot
drift apart.

Erasing before writing inside the same transaction is also what keeps the
schema's own guards satisfied: the `workout_session_single_active` partial
unique index never sees two active sessions, and `planned_workout.weekday`
never sees a stale weekday.

## Verification

Verification runs inside the transaction and nowhere else, because a failure
found there can still be undone.

Two assertions:

- **After erasure**, every capability probe must report empty. This catches an
  eraser that failed or was skipped before a single record is written.
- **After insertion**, each capability's presence must match the presence
  implied by the validated model. A capability the file populates must hold
  records, and a capability the file leaves empty must hold none.

The application claims exactly this and no more. It does not claim
record-by-record verification, because it does not perform one.

Per-capability record counts are deliberately not read. There is no write path
that could silently lose a record for a count to detect: only
`personal_profile`, `goal_configuration`, and `hydration_target` use upsert
semantics, and all three are validated as singletons before the transaction
opens, while every other write is a plain insert against a primary key that
throws on conflict. Duplicate identifiers, duplicate weekdays, and position gaps
are all rejected by the parser. Counting would grow the public surface by one
port per capability to detect a class of failure that cannot occur without an
error being raised first.

Two limits of presence verification are stated rather than hidden: the Nutrition
probe covers entries and catalog items together, and the Hydration probe covers
entries and the current target together, so parity for those two capabilities is
coarser than per-table.

The one-active-session invariant is enforced by the schema's partial unique
index inside the transaction, and by the parser before it. Singleton uniqueness
is enforced by the `singleton_id` constraint. Neither needs a new check.

## Empty and identical inputs

A valid empty export is a complete dataset, and replacing populated data with it
is permitted. It is equivalent to deletion and carries the same consequences, so
the preview states plainly that the selected export contains no records and that
replacing will leave the application empty. The workflow does not silently
redirect to local erasure.

A replacement export containing the same identifiers and values as the current
data — including one this installation generated moments earlier — is processed
identically. Identifiers and canonical values round-trip exactly, so the visible
outcome is unchanged data. No semantic equality comparison is performed: it
would cost a full second comparison of two datasets to prevent nothing harmful.

An export with no profile but other records replaces the profile with its
first-run state. An export with an active workout restores that active workout
and no other. An export whose completed history references deleted catalog
definitions is valid, exactly as
[ADR 0008](../docs/decisions/0008-historical-workout-session-snapshots.md)
intends; those references are deliberately unconstrained and none is added.

Replacing an installation that is already empty is permitted and is simply a
restore that took the replacement route. No precondition refuses it, because
refusing would add a failure mode with no safety benefit.

## Confirmation

Six deliberate acts, and no fewer:

1. opening Data controls;
2. opening the dedicated replacement screen;
3. selecting a file through the platform picker;
4. reviewing the validated summary;
5. resolving the recovery decision, either by creating and sharing a recovery
   export or by acknowledging that none will be created;
6. acknowledging that current information will be replaced, then confirming in a
   platform alert.

The screen's destructive control is named **Replace all local data** and the
platform alert's destructive option reads **Replace everything**, deliberately
different so no selector or screen reader has to disambiguate by position.
Vague labels such as Continue, Confirm, Reset, Import, or Proceed are not used.

A typed confirmation phrase is deliberately not required, for the reasons
recorded in ADR 0015; replacement already has three more deliberate acts than
erasure did.

Replacement never happens through navigation, a screen mount, application
startup, a failed export or restore, background cleanup, a migration, or retry
behavior.

## What the screen explains

- All information currently stored on this device will be replaced.
- The selected file is checked completely before anything is replaced.
- Replacement does not combine the file with what is already here.
- Current information can be exported first, and the application cannot verify
  that a share sheet saved that copy.
- Neither file is uploaded.
- If replacement fails, current information is preserved.
- Export files already saved elsewhere are never modified.
- Everything happens on this device.

Database terminology does not appear.

## Application state after replacement

No process restart, composition reset, application-shell remount,
persistence-generation key, or hidden global state is introduced. The connection
stays open and valid, which is why rows are replaced rather than the database
file.

On completion the stack is dismissed and the Profile tab is replaced, so no back
gesture can reach a route whose entity belonged to the previous dataset,
including an active workout and a completed workout detail route. Every product
screen reloads on focus, so mounted tabs re-read and show the replacement
dataset: Profile shows the replacement profile or its first-run state, Progress
derives from the replacement history, and the active workout reflects the
replacement active session. Stale asynchronous results are discarded by the same
mounted and request-sequence guards the restore and deletion screens use.

Afterwards, exporting produces the replacement dataset, empty-installation
restore refuses because data now exists, and deletion remains available.
Relaunching preserves the replacement.

## After the commit

`PRAGMA wal_checkpoint(TRUNCATE)` and `VACUUM` run on the main connection
through the existing `StorageCompactor`, best effort, for the same reason
specification 0020 gave: free pages still hold bytes from the dataset that was
just deleted. Unlike erasure, `VACUUM` here rebuilds a populated database, so
its cost scales with the replacement dataset. Neither statement may run inside a
transaction, both are caught deliberately, and neither can turn a committed
replacement into a reported failure.

No application-owned file is deleted after the commit. The recovery export is
kept, and the incoming file was never the application's to remove.

User-facing language distinguishes two outcomes and never blurs them:
replacement failed and current information was preserved, or replacement
succeeded, possibly with a warning about housekeeping that changed nothing about
the records.

## Failure, cancellation, and interruption

| Situation                                     | Behavior                                                            |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Picker cancelled                              | Neutral outcome, never described as a failure                       |
| Invalid, wrong format, unsupported version    | Distinct existing failure, nothing changed                          |
| Oversized file or parser failure              | Safe failure before any destructive control is enabled              |
| Recovery export generation fails              | Reported with retry; replacement stays reachable only by opting out |
| Recovery share cancelled                      | Neutral; the application never claims a save                        |
| User continues without a recovery export      | Allowed after its own acknowledgement                               |
| Screen unmounted before confirmation          | Nothing happened; no acknowledgement is persisted                   |
| Application backgrounded before confirmation  | Nothing happened; acknowledgements do not survive a relaunch        |
| Application terminated before the transaction | Nothing happened                                                    |
| Erasure fails inside the transaction          | Whole transaction rolled back; previous dataset intact              |
| Insertion fails inside the transaction        | Whole transaction rolled back; previous dataset intact              |
| Verification fails inside the transaction     | Whole transaction rolled back; previous dataset intact              |
| Application terminated during the transaction | SQLite rolls back; previous dataset intact; the user may retry      |
| Checkpoint or `VACUUM` fails after commit     | Success; best effort; not user-facing                               |
| Navigation refresh fails after commit         | Replacement already committed; screens reload on focus              |
| Repeated replacement request                  | Control disabled while busy; the exclusive lock serializes          |
| Stale asynchronous completion                 | Discarded by request identity                                       |

No startup repair is added: an interrupted replacement leaves nothing half-done.

## Errors

`LocalDataReplacementError` carries one of `storage-unavailable`,
`recovery-export-failed`, `replace-failed`, or `verification-failed`, each with a
fixed safe message, mirroring `PersistenceError`, `DataExportError`,
`DataRestoreError`, and `LocalDataErasureError`. `replace-failed` and
`verification-failed` both mean the previous dataset was preserved, and their
messages say so.

File selection and parsing failures continue to surface as `DataRestoreError`,
because that vocabulary already distinguishes the cases that change what the
user should do next.

No SQL, table name, stack trace, internal path, identifier, personal detail, or
fitness value reaches a user-facing message. The workflow performs no logging.

## Privacy and security

Replacement handles two sensitive datasets at once, which is the one genuinely
new privacy fact in this sprint: after a recovery export is generated and before
the transaction opens, the process holds the validated incoming model while the
recovery document text is still resident, and the recovery file coexists on disk
with nothing from the incoming file. Neither is written anywhere the application
does not already write.

The operation is always user-initiated and always confirmed. It performs no
network call, telemetry, analytics, or AI request, requests no new permission,
writes no hidden backup, keeps no hidden recovery copy, and deletes nothing the
application does not own. No custom cryptography is written and encrypted
archives are not supported. Automated and manual QA use synthetic data only.

The application never claims a recovery export was saved externally, and never
claims account, cloud, or forensic behavior it does not have.

## Accessibility

The workflow uses existing design-system components across its explaining,
selecting, reading, validating, failed, preview, recovery-decision,
recovery-generating, recovery-ready, acknowledging, replacing, verifying,
complete, and warning states.

The destructive control is explicitly named, is never an icon alone, keeps its
label when disabled, and states why it is disabled. Both acknowledgements expose
a checkbox role and their checked state at the minimum touch target. Phase
changes are announced through a polite live region, the preview, recovery-ready,
and completion panels are persistent rather than transient, focus moves to the
preview after validation and to the completion panel afterwards, content wraps
under large Dynamic Type without horizontal scrolling, counts are readable text,
and no state is communicated by colour alone. Picker and share cancellation read
as neutral. Failure states say plainly that current information was preserved.
The platform picker, share sheet, and alert remain platform-owned.

## Performance

Status is phase-based — reading the file, checking it, preparing the recovery
copy, replacing local data, verifying, complete — and no percentage is invented.

The transaction is thirteen bounded deletions followed by one statement per
incoming record, which is the same shape restore already has, plus eight
presence probes twice.

Peak memory is stated rather than estimated away. Between recovery generation
and the transaction, the process may hold the validated incoming model and the
whole recovery document text at once. Both sides are bounded by the existing
25 MB ceiling, and export architecture documents a realistic five-year ceiling
of roughly 12 to 18 MB of JSON. The decoded incoming text is released as soon as
the validated model exists, so only the model and the recovery text overlap. No
streaming parser, streaming writer, or background worker is introduced; the
escalation trigger already documented for export applies unchanged.

## Progress, export, restore, erasure, and migrations

Progress semantics are unchanged. It persists nothing, imports nothing, and
derives from the replacement dataset once screens refresh. No summary, chart,
trend, target, or adherence interpretation is added.

Export, empty-installation restore, and local erasure remain separately
available from Data controls and are unchanged in behavior. Restore is not
turned into an overwrite, deletion does not restore anything, an ordinary export
creates no replacement state, and Data controls never infers which operation the
user intended.

No migration is added and `user_version` stays 11. No table, column, index,
trigger, or view is added or removed, and no dependency is added, removed, or
upgraded.

## Verification and completion

- Preflight tests cover a valid complete export, a valid empty export, invalid
  JSON, a wrong format, an unsupported version, an oversized file, an invalid
  domain record, a broken reference, picker cancellation, and that no
  destructive control is enabled before validation completes.
- Recovery tests cover generating from the current dataset only, incoming data
  never appearing in the recovery export, generation failure gating replacement
  behind the explicit opt-out, neutral share cancellation, the absence of any
  claim that the file was saved, the continue-without-recovery path, the
  recovery file surviving the commit, and no external file being deleted.
- Replacement tests cover a populated installation replaced successfully, an
  empty installation replaced, an empty incoming dataset, erasure failure,
  failure in each insertion phase, verification failure, deletion order,
  insertion order, single-transaction composition, and repeated-request
  protection — each failure case asserting the previous dataset is preserved and
  no incoming record was committed.
- A real SQLite integration test runs the repository's own migrations and
  repositories through a test-owned adapter over Node's built-in SQLite, injects
  a controlled insertion failure after the deletion statements, and asserts that
  the original rows survive, that no replacement row exists, and that the schema
  and migration version are intact.
- Presentation tests cover the explanation, preview, recovery decision, both
  acknowledgements and their gating, the destructive confirmation, cancellation,
  busy phases, disabled-state explanations, the original-data-preserved failure
  message, persistent completion, the post-commit warning, live-region behavior,
  and accessibility labels.
- Sprint 21 Maestro scenarios cover opening replacement from Data controls,
  reviewing the destructive and recovery explanations, opening and cancelling the
  platform picker, current records surviving that cancellation, replacement
  controls staying disabled until validation, the other three lifecycle
  operations remaining reachable, and no accidental replacement through
  navigation or retry.
- The iOS regression suite passes on the final branch state.
- Repository formatting, lint, type checking, tests, and builds pass without
  warnings.

A complete successful replacement cannot be automated end to end, because the
file picker and the share sheet are platform-owned. That boundary is documented
rather than hidden, and is covered by the parser, orchestration, and real SQLite
tests together with manual device QA using synthetic exports. No hidden import
route, database fixture, production seeder, test-only bypass, direct SQLite
mutation from Maestro, or second end-to-end runner is added.

## Explicit exclusions

Merge import, synchronization, conflict resolution, tombstones, update
timestamps added for merging, cloud backup or restore, authentication, backend
endpoints, account deletion, automatic or scheduled replacement, selective
capability replacement, date-range replacement, arbitrary JSON or CSV import,
encrypted archive support, custom cryptography, password recovery, a hidden
permanent recovery copy, database-file swapping, connection close-and-reopen
lifecycle, Progress import, charts, AI, notifications, additional measurement
types, domain-package or API changes, SQLite migrations, new tables or indexes,
repository-wide refactoring, broad dependency upgrades, and a second end-to-end
runner are all excluded.
