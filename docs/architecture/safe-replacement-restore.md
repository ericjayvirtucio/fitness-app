# Safe replacement restore architecture

## Flow and boundaries

```text
Profile
  → Data controls (/data-controls)
      → Export my data                    (/data-export, unchanged)
      → Restore my data                   (/data-restore, unchanged)
      → Replace local data from an export (/replace-local-data)
          → ReplaceLocalDataScreen
          → SelectDataRestoreFileUseCase  (reused) → expo-file-system picker
          → ParseDataExportUseCase (pure, reused) → version 1 parser
              → domain reconstruction → referential validation → preview
          → CreateRecoveryExportUseCase   → CreateDataExportUseCase (reused)
          → ShareDataExportUseCase        (reused, platform-owned destination)
          → acknowledgements + destructive platform alert
          → ReplaceLocalDataUseCase
              → SqliteTransactionRunner<LocalDataReplacementTransactionContext>
                  → capability stored-data erasers   (deletion)
                  → capability stored-data probes    (emptiness gate)
                  → writeRestoreData → capability repositories (writes)
                  → capability presence probes       (verification)
              → SqliteStorageCompactor    (after commit, best effort)
          → dismiss the stack, replace with Profile
      → Delete all local data             (/delete-local-data, unchanged)
```

Replacement is not a new persistence capability. It is the existing export,
restore, and erasure mechanisms running under one workflow and, for the database
part, under one commit. The coordinator lives in `data-lifecycle`, owns no table,
and issues no SQL. See
[ADR 0016](../decisions/0016-atomic-local-data-replacement.md) for the durable
decision and [specification 0021](../../specs/0021-safe-replacement-restore.md)
for the approved scope.

`@fitness/domain` and `apps/api` are unchanged. No migration, table, column,
index, trigger, or view was added; `user_version` stays 11 and `formatVersion`
stays 1.

## What is reused, and what is new

| Concern                   | Where it lives                                  |
| ------------------------- | ----------------------------------------------- |
| File selection and size   | `SelectDataRestoreFileUseCase` (unchanged)      |
| Parsing and validation    | `ParseDataExportUseCase` (unchanged)            |
| Insertion order           | `writeRestoreData`, shared with empty restore   |
| Deletion order            | The eight `StoredDataEraser` implementations    |
| Emptiness and presence    | The eight `StoredDataProbe` implementations     |
| Recovery copy             | `CreateDataExportUseCase` via a narrow port     |
| Sharing the copy          | `ShareDataExportUseCase` (unchanged)            |
| Storage hygiene           | `SqliteStorageCompactor` (unchanged)            |
| Replacement transaction   | `ReplaceLocalDataUseCase` and its context (new) |
| Presence expectations     | `capability-presence.ts` (new)                  |
| Errors this workflow owns | `LocalDataReplacementError` (new)               |

The only genuinely new persistence idea is the transaction context, which is the
erasure context and the restore context composed from one transaction
connection:

```ts
type LocalDataReplacementTransactionContext = Readonly<{
  erasers: readonly StoredDataEraser[];
  presence: CapabilityPresenceProbes;
  target: DataRestoreTransactionContext;
}>;
```

`writeRestoreData` was extracted from `RestoreDataExportUseCase` so the
schema-shaped insertion order has one definition that both workflows call. A
capability added later is added there once.

## Validation before anything destructive

The screen offers no acknowledgement, no destructive control, and no platform
alert until a file has been read and has passed every layer specification 0019
defines. Nothing is erased to discover whether the incoming file is valid.

A selected file remains untrusted input, parsed from `unknown`, and the same
25 MB and per-collection ceilings apply. There is no second parser, no second
policy module, and no relaxed path for this screen. File and format failures
surface as the existing `DataRestoreError` values, whose messages already say
the right thing.

## The transaction

One exclusive transaction through the existing `SqliteTransactionRunner`:

1. every capability eraser runs, children first;
2. every stored-data probe must report empty;
3. `writeRestoreData` writes every record through its owning capability;
4. capability presence is compared with the validated model.

Any failure raises inside the callback and rolls everything back. The guarantee
is that **the previous dataset survives intact or the complete replacement
commits** — never a partial deletion, a partial restoration, a committed empty
database, or a mixture of the two datasets.

Two transactions would have been the smaller change and the worse guarantee:
they commit an empty database in between, where an insertion failure or a force
quit destroys what the user had without producing what they asked for.

Erasing before writing inside the same transaction is also what keeps the
schema's own guards satisfied. The `workout_session_single_active` partial
unique index never sees two active sessions, and `planned_workout.weekday` never
sees a stale weekday.

`ON DELETE CASCADE` is not relied on, for the reason measured and recorded in
[local persistence architecture](local-persistence.md): the exclusive
transaction runs on a connection whose foreign-key enforcement the application
does not control.

## Verification

Verification runs inside the transaction and nowhere else, because a failure
found there can still be undone.

The emptiness gate after erasure is the same check erasure itself makes. The
check after insertion compares each capability's presence with the presence the
validated model implies: a capability the file populates must hold records, and
a capability it leaves empty must hold none.

The product claims exactly that and no more. It does not claim
record-by-record verification, because it does not perform one.

Per-capability counts are deliberately not read. Only `personal_profile`,
`goal_configuration`, and `hydration_target` use upsert semantics, and all three
are validated as singletons before the transaction opens; every other write is a
plain insert against a primary key that throws on conflict, and duplicate
identifiers, duplicate weekdays, and position gaps are rejected by the parser.
There is no silent-loss write path for a count to detect.

Two limits are stated rather than hidden: the Nutrition probe covers entries and
catalog items together, and the Hydration probe covers entries and the current
target together, so presence parity is coarser for those two capabilities than
for the rest.

## Recovery copy

The workflow prominently recommends a copy of the current information and allows
an explicit, separately acknowledged opt-out. Requiring one would gate a
legitimate operation on a condition the product cannot evaluate — it cannot see
whether a share sheet saved anything — and ADR 0015 already established that a
user may replace or remove information without producing another sensitive copy.

The copy is the existing version 1 export, written by the existing exporter to
`<cache>/data-export/`, produced **before** the replacement transaction opens.
That ordering is what makes it impossible for an incoming record to appear in
it.

It is deliberately **not** deleted after the commit. Erasure clears that cache
because everything is being deleted; replacement would be deleting the user's
only path back at the moment it becomes useful. Its retention is bounded and
disclosed: it stays until the next export or replacement prepares that directory
again, or until the operating system reclaims the cache, and the completion
panel says so. Nothing about it is logged, and no file outside the sandbox is
ever touched.

Opening the share sheet is a handoff. The workflow reports that the sheet
closed and never that the file was saved. A share sheet that cannot open leaves
the copy untouched and is reported as a handoff problem, not as a lost copy.

## Incoming file

The picker returns an operating-system-created temporary copy on iOS and may
return a content URI on Android. It is read once, parsed into an immutable
validated model, and never touched again, so by the time the transaction opens
the source file is not needed. It never lands in `<cache>/data-export/`, so
preparing the recovery export cannot delete it.

## Empty and identical inputs

A valid empty export is a complete dataset and is accepted. The preview says
plainly that the file contains no records and that replacing with it leaves the
application with nothing stored, exactly as deleting everything would. The
workflow does not substitute local erasure for the operation the user chose.

An export whose identifiers and values match the current data — including one
this installation produced moments earlier — is processed identically. No
semantic equality comparison is performed: it would cost a full comparison of
two datasets to prevent an outcome that is not harmful.

Replacing an already-empty installation is permitted. No precondition refuses
it, because refusing would add a failure mode with no safety benefit.

## Confirmation

Six deliberate acts: opening Data controls, opening the replacement screen,
selecting a file, reviewing the validated summary, resolving the recovery
decision, and acknowledging the replacement before confirming in a platform
alert. The second acknowledgement — "I do not want a copy of my current
information" — exists only on the opt-out path.

The screen's control reads "Replace all local data" and the alert's destructive
option reads "Replace everything", deliberately different so no selector or
screen reader has to disambiguate by position. A typed confirmation phrase is
not required, for the reasons in ADR 0015.

Choosing a different file clears every decision already made, because a
different file is a different decision.

## After the commit

`PRAGMA wal_checkpoint(TRUNCATE)` and then `VACUUM` run on the main connection,
best effort. Free pages left by the replaced dataset still hold its bytes, which
is the same privacy argument specification 0020 made. Unlike after an erasure
this rebuilds a populated database, so the cost scales with the replacement
dataset. Neither can run inside a transaction and neither can turn a committed
replacement into a reported failure.

No application-owned file is removed. There is no post-commit warning: erasure
has one because it deletes a file it owns, and replacement deletes none.

## Application state afterwards

No process restart, composition reset, shell remount, persistence-generation
key, or hidden global state. The connection stays open and valid, which is the
practical reason rows are replaced rather than the database file.

Completion dismisses every route above the tabs and replaces the Profile tab, so
no back gesture can reach a screen whose records belonged to the previous
dataset, including an active workout and a completed workout detail route. Every
product screen reloads on focus, so mounted tabs re-read and show the
replacement dataset. Stale results are discarded by the same mounted and
request-sequence guards the restore and deletion screens use.

Afterwards, exporting produces the replacement dataset, empty-installation
restore refuses because data now exists, deletion remains available, and
relaunching preserves the replacement.

## Failure, interruption, and errors

| Situation                                  | Behavior                                            |
| ------------------------------------------ | --------------------------------------------------- |
| Picker cancelled                           | Neutral outcome, never a failure                    |
| Invalid, wrong format, unsupported version | Existing safe failure, no destructive control shown |
| Recovery copy fails                        | Reported with retry; opt-out is the way past it     |
| Share sheet cannot open                    | Copy unaffected; handoff reported                   |
| Any eraser fails inside the transaction    | Whole transaction rolled back, previous data intact |
| Any write fails inside the transaction     | Whole transaction rolled back, previous data intact |
| Either verification fails                  | Whole transaction rolled back, previous data intact |
| Application closes during the transaction  | SQLite rolls back; previous data intact             |
| Checkpoint or `VACUUM` fails after commit  | Success; best effort, not user-facing               |
| Repeated request                           | Control disabled while busy; the lock serializes    |
| Screen unmounted or superseded request     | Result discarded by request identity                |

`LocalDataReplacementError` carries `storage-unavailable`,
`recovery-export-failed`, `replace-failed`, or `verification-failed`, each with a
fixed safe message. Every one except `recovery-export-failed` means the previous
dataset is still there, and each message says so, because that is exactly what a
user needs to know after a destructive confirmation.

No SQL, table name, stack trace, internal path, identifier, personal detail, or
fitness value reaches a user-facing message. The workflow performs no logging.

No startup repair is added: an interrupted replacement leaves nothing half-done.

## Privacy and security

Replacement handles two sensitive datasets at once. After a recovery export is
generated and before the transaction opens, the process holds the validated
incoming model while the recovery document text is still resident, and the
recovery file coexists on disk with nothing from the incoming file. Neither is
written anywhere the application does not already write.

The operation is always user-initiated and always confirmed. There is no network
call, telemetry, analytics, or AI request, no new permission, no hidden backup,
and nothing deleted that the application does not own. Automated tests and
end-to-end evidence use synthetic data only.

## Performance

Status is phase-based — reading the file, checking it, preparing the copy,
replacing, complete — and no percentage is invented.

The transaction is thirteen bounded deletions plus one statement per incoming
record, the same shape restore already has, plus eight presence probes twice.

Peak memory is bounded by the existing 25 MB file ceiling on each side; the
decoded incoming text is released once the validated model exists, so only that
model and the recovery document text overlap. Export architecture documents a
realistic five-year ceiling of roughly 12 to 18 MB of JSON and the escalation
trigger if measured exports approach 25 MB; that trigger applies unchanged.

## Testing

Orchestration is covered by fake-runner tests for erasure order, insertion
order, the emptiness gate, presence verification, single-transaction
composition, and every failure phase.

The rollback guarantee is covered against a real SQLite engine.
`NodeSqliteDatabase` implements the application's own `DatabaseConnection` over
Node's built-in SQLite, runs the repository's real migrations, and drives the
real repositories through the real transaction runner. A controlled insertion
failure after the deletions proves the original rows survive, that no incoming
row remains, and that the schema and migration version are intact. Failure
injection lives in the test, never behind a switch the application could reach.

That adapter is for tests only. Expo owns production persistence, and
`composition/persistence.ts` remains the only place a production database is
opened.

## Known limitations

- Presence verification is coarser than per-table for Nutrition and Hydration.
- A complete successful replacement cannot be automated end to end, because the
  picker and the share sheet are platform-owned. It is covered by the
  [Sprint 21 manual checklist](../manual-testing/sprint-21-safe-replacement-restore.md).
- The application cannot confirm that a recovery export was saved anywhere, and
  says so rather than implying otherwise.
- Replacement cannot be undone in the application. That is the intent, and it is
  why a recovery copy is offered first.
- Merging an export with existing information is still not supported and still
  needs its own reviewed design; the seam is described in ADR 0014 and left
  untouched by ADR 0016.
- Replacement writes one statement per record, so a very large incoming history
  is bound by transaction throughput. Batching stays available behind the
  unchanged repository contracts if measurement justifies it.
