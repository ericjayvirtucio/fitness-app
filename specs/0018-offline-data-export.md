# Specification 0018: Offline data export

**Status:** Approved for implementation on 2026-08-11.

## Objective and scope

Give the user a supported way to take their locally stored fitness information
out of the application. The product promises user ownership and portability, but
every record currently lives only inside the application sandbox, so uninstalling
the app or losing the device destroys the entire history.

This specification adds one offline export: a single documented, versioned JSON
file describing everything the application stores, handed to the operating
system's share and save controls by an explicit user action.

Import, restore, backup, synchronization, cloud upload, scheduled export, and
encryption are out of scope.

## Export workflow

```text
Profile
  → Export my data
  → privacy notice and included-data summary
  → Create export
  → "Export ready" confirmation with file name, size, and record counts
  → Open share options
  → the operating system's share or save controls
```

Generation is a separate, completed step before the share handoff. That
separation gives assistive technology a persistent confirmation instead of a
transient toast, lets the user see what is about to leave the application, and
provides a stable automated-test boundary before any platform-owned sheet.

Generation requires no network, no account, and no backend. The application
never uploads the export and never opens an external service on its own.

## Format

One UTF-8 JSON file, no byte-order mark, LF line endings, two-space indentation,
`.json` extension, `application/json` media type.

JSON is chosen because it represents the nested session-exercise-set structure
without invented join keys, distinguishes an unknown nutrient (`null`) from a
known zero, carries its own format identifier and version, and stays readable by
both a person and future import tooling without a new dependency.

CSV cannot express nesting and confuses unknown with empty. A raw SQLite copy
would publish the internal schema as a public contract. A ZIP archive would add a
dependency to solve a size problem the measured data does not have. A PDF is not
machine-readable.

## Contract

The file always contains every top-level key:

```json
{
  "format": "fitness-app-data-export",
  "formatVersion": 1,
  "generatedAt": "2026-08-11T09:15:04.123Z",
  "application": { "name": "Fitness App", "version": "0.0.0" },
  "profile": null,
  "goalsAndEnergy": { "goal": null },
  "nutrition": { "entries": [], "catalogItems": [] },
  "hydration": { "entries": [], "currentTarget": null },
  "exerciseCatalog": { "exercises": [] },
  "workoutPlanner": { "plannedWorkouts": [] },
  "workoutSessions": { "activeSession": null, "completedSessions": [] },
  "bodyMeasurements": { "weightCheckIns": [] }
}
```

Section names use product language. No database table name, column name, or
internal search key appears anywhere in the file.

### Required, optional, and empty values

Every key is always present. Optionality is expressed with `null`, never by
omitting a key. Collections are always arrays and become `[]` when empty.
Singleton records become `null` when nothing is stored. A brand-new installation
therefore produces a valid, complete, small export; that is a success, not an
error.

The one deliberate exception is the prescription and result variant objects,
where the `kind` discriminator already governs which measurement fields exist.
Those objects carry only their own variant's fields.

### Unknown values

An unrecorded optional nutrient is exported as `null`. It is never converted to
zero. A known zero is exported as `0`.

## Data scope

| Section            | Contents                                                                                                   | Authority                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `profile`          | Height, weight, biological sex, date of birth, activity level, preferred unit system                       | `personal_profile`                                           |
| `goalsAndEnergy`   | Goal type and calorie adjustment                                                                           | `goal_configuration`                                         |
| `nutrition`        | Every consumption entry with its own snapshot; every saved catalog item with favourite and usage state     | `nutrition_consumption_entry`, `nutrition_catalog_item`      |
| `hydration`        | Every fluid entry; the current daily target, named as current                                              | `hydration_entry`, `hydration_target`                        |
| `exerciseCatalog`  | Every exercise definition and its favourite state                                                          | `exercise_catalog_item`                                      |
| `workoutPlanner`   | Every planned weekday, its ordered exercises, and prescriptions                                            | `planned_workout`, `planned_exercise`                        |
| `workoutSessions`  | The single active session, if any, and every completed session with exercise snapshots and individual sets | `workout_session`, `workout_session_exercise`, `workout_set` |
| `bodyMeasurements` | Every recorded weight check-in                                                                             | `body_weight_entry`                                          |

### Historical truth

The export never performs a join the write path did not already perform.

- Completed session exercises keep their stored name, logging-mode, and planned
  prescription snapshots. They are never re-resolved against the current
  Exercise Catalog or Planner.
- Nutrition entries keep their own captured facts. They are never re-resolved
  against the Nutrition Catalog.
- The hydration target is exported once, outside the entries array, named
  `currentTarget`. No historical target is known for any past day and none is
  invented.
- The Planner is a separate section describing recurring future intent. It is
  never merged into completed history.
- An active session is exported at `workoutSessions.activeSession` with
  `"status": "active"` and a `null` completion time. It never appears among
  completed sessions.
- Profile weight and body-weight check-ins stay in separate sections. Neither is
  derived from the other, preserving the authority split in
  [ADR 0012](../docs/decisions/0012-body-measurement-history-and-current-weight-authority.md).
- Deleted records are not fabricated. A session exercise whose definition was
  later deleted keeps its snapshot; the absence of that identifier from
  `exerciseCatalog` is itself the truthful record.

### Derived values

Derived values are not exported. BMI, resting energy, maintenance energy, the
daily calorie target, and consumed nutrition amounts are all pure functions of
values already in the file. Exporting them would duplicate state that can drift
from the formulas and would invite reading a current calculation as history.
Recomputation rules are documented in the architecture guide.

## Identifiers

Application-generated UUIDs are exported as `id`. They carry no personal
information, no account, and no device identity, and they are the only stable way
to express session-to-exercise-to-set nesting and planner references. Array
positions never carry identity; `position` is exported as ordered domain data.

References use export-facing names: `exerciseId`, `sourceExerciseId`,
`sourcePlannedExerciseId`, `sourcePlannedWorkoutId`.

## Canonical units

Stored canonical units are exported unchanged and every numeric field name ends
in its unit.

| Dimension | Canonical unit     |
| --------- | ------------------ |
| Mass      | grams              |
| Length    | millimeters        |
| Volume    | milliliters        |
| Energy    | kilojoules         |
| Sodium    | milligrams         |
| Duration  | seconds            |
| Instant   | epoch milliseconds |

The goal calorie adjustment stays in whole kilocalories because the domain
guarantees an integer there and converting it would introduce a fraction.

No presentation-rounded value is exported and no display duplicate is added. The
profile's preferred unit system is exported as a setting; it never rewrites a
stored value.

## Time semantics

Historical records export the stored occurrence triple unchanged:
`occurredAtEpochMilliseconds`, `localCalendarDate` (`YYYY-MM-DD`), and
`utcOffsetMinutes`. Workout sessions use the equivalent `startedAt` triple. No
history is reprojected through the device's current time zone and no derived
local timestamp string is added.

`generatedAt` is an ISO 8601 UTC instant with millisecond precision and a `Z`
suffix. Records whose creation time was never stored carry no timestamp; the
application does not know when they were set and will not invent one.

## Ordering and determinism

Every array has a declared total order, each backed by an index that already
exists. Ties break on `id` ascending.

| Array                               | Order                                            |
| ----------------------------------- | ------------------------------------------------ |
| `nutrition.entries`                 | local calendar date, occurrence, id              |
| `nutrition.catalogItems`            | normalized name, id                              |
| `hydration.entries`                 | local calendar date, occurrence, id              |
| `exerciseCatalog.exercises`         | normalized name, id                              |
| `workoutPlanner.plannedWorkouts`    | weekday, then exercise position                  |
| `workoutSessions.completedSessions` | started local calendar date, started instant, id |
| session exercises and sets          | position                                         |
| `bodyMeasurements.weightCheckIns`   | local calendar date, occurrence, id              |

Object keys are emitted in a fixed declared order. Given identical stored state,
an identical `generatedAt`, and an identical application version, the file is
byte-identical. Byte equality is not promised across runs because `generatedAt`
legitimately differs.

## Versioning

`format` is the constant `fitness-app-data-export`. `formatVersion` is the
integer `1`.

`formatVersion` is a public compatibility contract and is deliberately
independent of the SQLite migration version, which is currently 11. Any change to
the contract increments `formatVersion`; a single integer with one meaning is
preferred over a compatibility matrix. `application.version` is metadata only and
carries no compatibility meaning.

No migration framework, version registry, or upcasting code is created. Version 1
needs a constant and an assertion.

## Architecture

```text
Profile route
  → DataExportScreen
  → CreateDataExportUseCase
  → SqliteTransactionRunner<DataExportTransactionContext> (one exclusive read)
      → capability-owned export readers
  → DataExportSerializer (pure)
  → DataExportFileWriter → expo-file-system
  → ShareDataExportUseCase → DataExportShareService → expo-sharing
```

A new `data-export` capability coordinates only. It owns orchestration, format
metadata, contract mapping, serialization, file handling, and the screen. It owns
no table and issues no SQL.

Each existing capability keeps ownership of its data through a narrow export
reader in its own application and infrastructure folders, following the
cross-capability reader precedent in
[ADR 0011](../docs/decisions/0011-cross-capability-derived-progress-analytics.md).
Readers return existing domain records and application read models; the mapping
to the public contract lives once, inside `data-export`, so a version change is a
single reviewable file rather than a change spread across eight capabilities.

Reused unchanged: the personal profile, goal, hydration target, planner, workout
session, and body-weight repositories. New readers are added for nutrition
entries, the nutrition catalog, hydration entries, the exercise catalog, and
completed workout sessions.

`@fitness/domain` is unchanged. No domain record gains an export method, because
a public file format must not be coupled to mutable domain classes. `apps/api` is
unchanged, because a local offline export needs no server.

## Read consistency

All reads run inside one exclusive SQLite transaction through the existing
`SqliteTransactionRunner`, with every capability repository composed from that
single transaction, exactly as a body-weight check-in composes two capabilities
today. The export therefore cannot capture a mutually inconsistent set of related
records.

Serialization runs inside the transaction. The file write and the share handoff
run outside it. The transaction blocks writes for its duration; that is accepted
because the export is a foreground action on a single-user device, every read is
index-ordered, and no new locking primitive is introduced.

## Bounded reads

Every unbounded table is read with keyset paging of 200 records per page, in the
declared order, with no `OFFSET`. Each page is converted to text immediately and
the domain objects are released.

Text chunks are accumulated and written once. A streaming file writer is not
introduced in version 1: the realistic ceiling for five years of heavy use is
roughly 12 to 18 MB of JSON, and hand-managing a file handle across an exclusive
transaction and a cancellation path is not justified at that size. The escalation
trigger is documented: if measured exports approach 25 MB, the file adapter
switches to a writable stream behind the unchanged `DataExportFileWriter`
interface.

No pagination control appears in the user interface. Paging is an internal read
strategy.

## File handling

The export is written to a `data-export` directory inside the application cache
directory. The cache is used deliberately: it is inside the sandbox, it is
excluded from device backup by platform convention, and the system may reclaim
it.

The file is named `fitness-app-export-<compact UTC instant>.json`, for example
`fitness-app-export-20260811T091504Z.json`, derived from the same instant as
`generatedAt`. The name is ASCII, contains no personal data, and is safe on every
supported file system and share target.

The export directory is removed and recreated before every generation, so exactly
one export file exists at a time and a same-second repeat cannot collide.

Cleanup runs when the export screen mounts, before every generation, and when the
user discards an export. Cleanup deliberately does not run immediately after the
share handoff resolves, because an Android receiver may still be reading the
granted content URI. Cleanup failure is never fatal and never surfaces an error.

The application never deletes or modifies the destination the user chose. It
controls only its own temporary copy.

## Failure and cancellation

| Situation                                  | Behavior                                                        |
| ------------------------------------------ | --------------------------------------------------------------- |
| No stored data                             | Success with empty sections                                     |
| Any repository read failure                | Abort, no file, no partial export                               |
| Malformed persisted row                    | Translated to a read failure with no value in the message       |
| Serialization failure                      | Abort, temporary file removed                                   |
| File write failure or insufficient storage | Abort, partial file removed                                     |
| Sharing unavailable                        | Explicit failure, temporary file removed                        |
| Share sheet dismissed                      | Neutral status; the application never claims the file was saved |
| Repeated requests                          | The control is disabled while generating                        |
| Screen unmounted mid-flight                | Cancellation requested, no state update                         |
| Stale completion                           | Discarded by request identity                                   |
| Cleanup failure                            | Silent, retried on the next preparation                         |

Version 1 is all-or-nothing. A capability is never silently omitted because one
read failed, and a failed export is never presented as successful.

Generation exposes an explicit cancel control. Cancellation is checked between
pages and between sections and removes any partial file.

The application cannot distinguish a completed save from a dismissed share sheet
on iOS, so the post-handoff message is neutral and offers to open share options
again.

## Errors

`DataExportError` carries one of `read-failed`, `serialization-failed`,
`file-write-failed`, `sharing-unavailable`, `sharing-failed`, or `cancelled`,
with a fixed safe message, mirroring `PersistenceError`. No SQL, file path, stack
trace, identifier, or measurement reaches a user-facing message. The capability
contains no logging, so no log path exists to leak into.

## Privacy and security

The export contains sensitive personal and fitness information, including date of
birth, biological sex, and body measurements. It is produced only by an explicit
user action, after a screen that states what is included, that the file is
created on this device, that the application does not upload it, that the user
chooses the destination, that the file is not encrypted, and that bringing data
back in is not supported.

There is no network call, telemetry, or analytics anywhere in the capability. No
storage permission is requested; the platform share and save controls own the
destination. Automated tests and end-to-end evidence use synthetic data only.

Encryption is deliberately absent and documented as absent. Adding it would
require a separate reviewed design covering key derivation, container format,
password handling, recovery expectations, and cross-platform compatibility.

## Dependencies

`expo-sharing` is added at the version matching Expo SDK 57. It is the only
supported way to hand a file to the platform share and save controls on both
targets; the React Native `Share` API cannot share a file on Android. It is
first-party, MIT licensed, autolinked, requires no runtime storage permission,
and performs no network access.

`expo-file-system` is promoted from a transitive dependency of `expo` to a
declared direct dependency because the application now imports it directly.

The generated native projects remain ignored, so adding a native module produces
no committed native change. The first end-to-end run after this change rebuilds
the native project.

## Persistence and migration

No migration, table, column, index, trigger, or view is added. The SQLite
migration version stays 11. Every declared export order is served by an index
that already exists.

## Accessibility

The workflow uses existing design-system components with explicit loading,
ready, cancelled, and failure states. The success confirmation is a persistent
panel, not a transient toast. Status changes are announced. Disabled controls
keep their labels and expose a disabled state. Content wraps under large Dynamic
Type, meets minimum touch targets, and never communicates state through colour
alone. The platform share sheet remains platform-owned.

## Navigation

One route, `/data-export`, reached from the Profile tab. No tab is added; five
tabs remain the intended maximum.

## Progress analytics

Progress is unchanged. The export reads the same historical authorities but adds
no card, trend, chart, or period calculation, and never treats a
presentation-formatted Progress summary as export data.

## Verification and completion

- Serializer tests cover the format identifier, the version constant and its
  independence from the migration version, byte-stable output under a fixed
  clock, declared ordering including identifier tie-breaks, canonical units,
  preserved occurrence triples, empty and absent state, unknown nutrients
  remaining unknown, and the absence of internal names in the output.
- Use-case tests cover a complete export, empty state, a read failure in each
  capability, serialization failure, write failure, single-transaction
  composition, cancellation, and temporary-file cleanup.
- Share tests cover unavailability, rejection, and neutral success.
- Reader tests cover authoritative records only, bounded keyset paging without
  gaps or duplicates, completed snapshots surviving catalog mutation, planner
  intent staying out of completed history, profile weight staying out of
  check-ins, the current hydration target never being attached to an entry, and
  safe translation of corrupt rows.
- Presentation tests cover the notice, loading, ready panel, cancellation,
  failure and retry, accessibility labels, disabled controls, repeated-request
  protection, stale completion, and navigation from Profile.
- Sprint 18 Maestro scenarios cover opening the screen, reviewing the notice,
  generating an export, reaching the share handoff control, and returning safely.
- The full iOS regression suite passes on the final branch state.
- Repository formatting, lint, type checking, tests, and builds pass without
  warnings.

## Explicit exclusions

Import, restore, merge, backup, scheduled or automatic export, cloud upload,
synchronization, authentication, accounts, encryption or password protection,
compression, ZIP, CSV, PDF or spreadsheet output, per-capability or date-range
selection, export history, sharing to a specific named application, telemetry,
external analytics, AI, medical interpretation, new Progress cards or charts, new
measurement types, notifications, API changes, domain-package changes, SQLite
migrations, new tables or indexes, application data deletion or reset, and any
second QA runner are excluded.
