# Offline data restore architecture

## Flow and boundaries

Data Restore is an offline mobile capability owned by the Profile area:

```text
Profile route
  → PersonalProfileScreen ("Restore my data")
  → /data-restore
  → DataRestoreScreen
  → GetRestoreTargetUseCase        → capability stored-data probes
  → SelectDataRestoreFileUseCase   → DataRestoreFileSource → expo-file-system
  → ParseDataExportUseCase (pure)  → version dispatch → version 1 parser
                                   → domain reconstruction
                                   → referential validation → restore preview
  → RestoreDataExportUseCase
      → SqliteTransactionRunner<DataRestoreTransactionContext> (one exclusive write)
          → stored-data probes, rechecked
          → each capability's existing repository
```

The capability coordinates only. It owns no table, issues no SQL, and holds no
persistence rules. See
[ADR 0014](../decisions/0014-empty-installation-data-restore.md) for the durable
decision and [specification 0019](../../specs/0019-offline-data-restore.md) for
the approved scope.

`@fitness/domain` and `apps/api` are unchanged. No domain record gained an
import method, for the same reason none gained an export method: a public file
format must not be coupled to mutable domain classes.

## What restore accepts

Exactly the version 1 contract produced by
[offline data export](offline-data-export.md):

```json
{ "format": "fitness-app-data-export", "formatVersion": 1 }
```

The `format` and `formatVersion` constants are imported from the export
contract module, so one public promise has one definition. The `Exported*`
TypeScript interfaces are deliberately **not** used as parse targets: they
describe what this application writes, not what an arbitrary file contains.

Compatibility is never inferred from the application version, the SQLite
migration version, the file name, the media type, or the file extension. The
picker filters on `application/json` only to make selection easier.

An unsupported version is reported as such. There is no upcasting and no
format-migration framework; a future version 2 adds a branch at the dispatch
boundary in `parse-data-export.ts`.

## Trust boundary and validation

A selected file is untrusted input even when it declares the supported format.
Parsing starts from `unknown` and narrows every value with an explicit guard in
`data-restore-parsing.ts`. No `any`, no assertion, no unchecked enum cast, and
no parsed primitive reaches SQL.

| Layer                             | Where                            |
| --------------------------------- | -------------------------------- |
| picker result, size, decoding     | `SelectDataRestoreFileUseCase`   |
| JSON, format, version             | `parseDataExport`                |
| sections, keys, primitives, enums | `parse-data-export-v1.ts`        |
| bounds and duplicate identifiers  | `data-restore-parsing.ts`        |
| business invariants               | existing domain constructors     |
| references across records         | `parse-data-export-v1.ts`        |
| emptiness                         | `StoredDataProbe` per capability |

Everything except the final emptiness recheck completes before the write
transaction opens.

### Unknown, missing, and null keys

Unknown keys are ignored: nothing unvalidated is passed through, so rejecting
them would gain no safety while breaking a file that only added a member. A
missing required key is rejected, because the contract states every key is
always present and expresses optionality with `null`. The one exception is the
prescription and result variant objects, where `kind` already governs which
measurement fields exist. `null` is accepted only where the contract declares
it, and an unknown nutrient stays unknown rather than becoming zero.

### Limits

| Limit                                                  | Value       |
| ------------------------------------------------------ | ----------- |
| file size                                              | 25 MB       |
| nutrition entries, hydration entries, weight check-ins | 200000 each |
| nutrition catalog items, exercises                     | 20000 each  |
| completed workout sessions                             | 50000       |
| planned workouts                                       | 7           |
| exercises per planned workout or session               | 100         |
| sets per session exercise                              | 100         |
| characters in any single string                        | 4096        |

Size is checked from file metadata before the contents are read, and again
against the decoded text. The 25 MB ceiling is the same figure documented for
export's whole-document buffering, so a file this application produced always
fits. Per-record limits are the domain's own policies rather than new numbers,
so a record the application can create can always be restored. These are
resource protection, not fitness advice.

## Identity, units, and time

Exported identifiers are restored exactly; none is regenerated. Duplicates are
rejected before anything is written, scoped per collection, with session
exercises and sets unique across every restored session because both are
primary keys. Historical source references never participate in duplicate
detection.

Canonical values are restored unchanged — grams, millimeters, milliliters,
kilojoules, sodium milligrams, seconds, epoch milliseconds, and whole
kilocalories for the goal adjustment. Nothing is round-tripped through
kilograms, pounds, cups, formatted dates, or the current time zone.
`preferredUnitSystem` is restored as a setting and never rewrites history.

The occurrence triple and the workout `startedAt` triple are restored as
stored. Agreement between instant, offset, and local date is enforced by the
domain constructors that already own that rule. `generatedAt` is file metadata:
it is shown so the user can recognise their file, and is never persisted as a
record timestamp.

## Historical truth

- Nutrition entries keep their captured facts and are never re-resolved against
  the catalog. Catalog items are restored separately with favourite and usage
  state; their internal normalized search key is derived on write, never read
  from the file.
- Hydration entries are history; `currentTarget` is restored as current
  configuration only.
- Exercise definitions and favourite state are restored. Definitions absent
  from the file are not fabricated.
- The planner is current intent and never becomes history.
- At most one active session is restored, with its captured execution context,
  and it never becomes completed history.
- Completed sessions keep their name, logging-mode, and prescription snapshots
  and their individual performed sets. Performed work is never inferred from a
  prescription.
- Body-weight check-ins and profile weight stay separate, preserving
  [ADR 0012](../decisions/0012-body-measurement-history-and-current-weight-authority.md).
- Goal configuration is restored; BMI, energy estimates, and the calorie target
  are recomputed by existing deterministic logic and never imported.
- Progress imports nothing. Existing readers derive summaries from the restored
  authoritative records.

## Referential integrity

Current intent must resolve:

- every planned exercise references a restored exercise definition, because
  `planned_exercise.exercise_definition_id` is a restricted foreign key;
- a planned prescription is compatible with that definition's logging mode;
- planned exercise positions run from zero without gaps, and each weekday
  appears at most once;
- session exercise and set positions run from zero without gaps;
- a set result and a planned prescription snapshot are both compatible with the
  exercise's recorded logging mode;
- at most one active session exists, and no session appears with the wrong
  status for the slot it occupies;
- profile, goal configuration, and hydration target are singletons.

History deliberately need not resolve. `sourceExerciseId`,
`sourcePlannedExerciseId`, and `sourcePlannedWorkoutId` may point at records
that no longer exist, exactly as
[ADR 0008](../decisions/0008-historical-workout-session-snapshots.md) intends;
the schema carries no foreign key on them and none was added.

Reference checks use maps and sets, so validation stays linear in record count.

## Empty-installation policy

Restoring is supported only into an installation that holds no user-owned
record or configuration. "Empty" is not "no profile": a `StoredDataProbe` is
implemented once per capability, and together they cover `personal_profile`,
`goal_configuration`, `nutrition_consumption_entry`, `nutrition_catalog_item`,
`hydration_entry`, `hydration_target`, `exercise_catalog_item`,
`planned_workout`, `workout_session`, and `body_weight_entry`.
`planned_exercise`, `workout_session_exercise`, and `workout_set` are
cascade-deleted children of covered parents.

The check runs when the screen opens, so the refusal is explained before the
user picks a file, and again inside the write transaction, so a record created
in between cannot be silently joined. When the installation is not empty,
nothing is deleted, nothing is modified, and the screen suggests exporting
first. No overwrite option is offered.

## Writes and transaction

`RestoreDataExportUseCase` opens one exclusive transaction through the existing
`SqliteTransactionRunner`, rechecks emptiness, and writes in schema order:

1. profile
2. goal configuration
3. nutrition catalog items, then nutrition entries
4. hydration entries, then the current target
5. exercise definitions
6. planned workouts, which reference step 5
7. completed sessions, then the active session
8. body-weight check-ins

Every write is a capability's existing repository method. Those already preserve
identifiers, favourite and usage state, snapshots, and occurrence context, so no
restore-only writer contract was added and the public surface did not grow. The
refusal path returns an outcome instead of throwing, so its meaning is not
flattened by the transaction runner's error translation.

Restoring is all-or-nothing. Any failure rolls back every insert, and a
partially restored installation is never presented as successful. If the
application is killed mid-transaction, SQLite rolls back on next open.

No migration, table, column, index, trigger, or view was added; the migration
version stays 11, and the database file itself is never restored or replaced.

## File selection

`expo-file-system`, already a direct dependency, provides `File.pickFileAsync`
on Expo SDK 57. No dependency was added. The picker grants access to exactly one
file, so no storage permission is requested and no directory is browsed. iOS
returns a temporary copy and Android may return a content URI; both are read the
same way, and the application never modifies or deletes the file the user chose.

The picker sits behind the `DataRestoreFileSource` port, so the application
layer never sees Expo types.

## Application refresh

Every screen reloads on focus, so returning to the tabs after a restore shows
restored state. The profile screen was moved from a mount-only load to the same
focus-based refresh in this change; nothing else was needed, and no composition
reset, application restart, or global mutable state is involved.

## Failure, cancellation, and errors

`DataRestoreError` carries `picker-unavailable`, `file-unreadable`,
`file-empty`, `file-too-large`, `invalid-encoding`, `invalid-json`,
`unsupported-format`, `unsupported-format-version`, `invalid-structure`,
`invalid-record`, `duplicate-identifier`, `unresolved-reference`,
`too-many-records`, `storage-unavailable`, `target-not-empty`, or
`write-failed`, each with a fixed safe message, mirroring `PersistenceError` and
`DataExportError`.

Dismissing the picker is a neutral outcome, never described as a failure. A
superseded selection or an unmounted screen discards its result by request
identity. Once the write transaction begins the workflow exposes no cancel
control, because SQLite cannot honour a half-transaction cancellation and the
application will not promise one; the in-transaction emptiness recheck is what
prevents a racing restore.

## Privacy and security

The selected file holds sensitive personal and fitness information. It is
processed entirely on the device. There is no network call, telemetry, or
analytics in the capability, and no logging at all, so no log can leak file
contents. No user-facing message contains SQL, a stack trace, a JSON fragment,
an identifier, a measurement, or an internal path. Automated tests and
end-to-end evidence use synthetic data only.

Encrypted import does not exist and is not implied anywhere in the interface or
the documentation.

## Known limitations

- Restoring works only on an installation that holds no information. A user who
  already has records must export first and clear application data before
  restoring.
- Merging an export with existing information, and replacing existing
  information, are not supported. Both need their own reviewed design; the
  seam is described in ADR 0014.
- Only `formatVersion` 1 is accepted.
- Encrypted or compressed archives are not supported.
- Restoration issues one statement per record, so a very large history is bound
  by transaction throughput. Batching stays available behind the unchanged
  repository contracts if measurement justifies it.
- A complete successful restore cannot be automated end to end, because the
  file picker is platform-owned. It is covered by manual device QA with a
  synthetic export.
- An export is a copy the user controls, not an automatic backup, and nothing
  here recovers data from a cloud service.
