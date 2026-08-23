# Offline data export architecture

## Flow and boundaries

Data Export is an offline mobile capability owned by the Profile area:

```text
Profile route
  → PersonalProfileScreen ("Data controls")
  → /data-controls ("Export my data")
  → /data-export
  → DataExportScreen
  → CreateDataExportUseCase
  → SqliteTransactionRunner<DataExportTransactionContext> (one exclusive read)
      → capability-owned export readers
  → DataExportSerializer → JsonDocumentWriter
  → DataExportFileWriter → expo-file-system
  → ShareDataExportUseCase → DataExportShareService → expo-sharing
```

The capability coordinates only. It owns no table, issues no SQL, and holds no
persistence rules. Each existing capability keeps ownership of its own data
through a narrow export reader, following the cross-capability reader boundary
in [ADR 0011](../decisions/0011-cross-capability-derived-progress-analytics.md).
See [ADR 0013](../decisions/0013-versioned-offline-data-export.md) for the
durable decision and [specification 0018](../../specs/0018-offline-data-export.md)
for the approved scope.

`@fitness/domain` and `apps/api` are unchanged. A local offline export needs no
server, and a public file format must not be coupled to mutable domain classes,
so no domain record gained an export method.

## Capability-owned readers

Reused unchanged, because they are already bounded:

- `PersonalProfileRepository.get`
- `GoalRepository.get`
- `HydrationTargetRepository.get`
- `WorkoutPlannerRepository.getWeeklyWorkouts` (at most seven plans)
- `WorkoutSessionRepository.getActive` (at most one session)

Added, one per capability that stores unbounded history:

| Reader                        | Capability               | Returns                                    |
| ----------------------------- | ------------------------ | ------------------------------------------ |
| `NutritionExportReader`       | Nutrition                | consumption entries, catalog items         |
| `HydrationExportReader`       | Hydration                | fluid entries                              |
| `ExerciseCatalogExportReader` | Exercise Catalog         | exercise definitions                       |
| `WorkoutSessionExportReader`  | Workout History          | completed sessions with snapshots and sets |
| `BodyWeightExportReader`      | Body Measurement History | weight check-ins                           |

Readers return existing domain records and application read models. The mapping
to the public contract lives once, in `data-export/application/data-export-mapping.ts`,
so a contract version change is one reviewable file instead of a change spread
across every capability.

Workout History returns full stored sessions rather than its `WorkoutHistoryListItem`
read model, because that model carries derived counts and elapsed time for the
history screens. Export carries recorded facts only.

## Read consistency

`CreateDataExportUseCase` reads and serializes inside a single exclusive SQLite
transaction built with the existing `SqliteTransactionRunner`, composing every
capability repository from that one transaction. A file therefore cannot contain
a mutually inconsistent set of related records.

The file write and the share handoff happen outside the transaction. Writes are
blocked while the transaction is open; that is accepted because the export is a
foreground action on a single-user device, every read is index-ordered, and no
new locking primitive was introduced.

## Bounded reads

Every unbounded table is read with ascending keyset paging, with no `OFFSET`.
`exportPagePolicy` sets 200 records per page for flat records and 25 for
completed workout sessions, because a session may hold up to 100 exercises of
up to 100 sets and a full-size page of sessions could pull an implausible but
unbounded number of child rows into memory at once. Cursor predicates live in
`infrastructure/persistence/export-keyset.ts`; the shared page and cursor types
live in `application/persistence/export-paging.ts`. Each page is turned into
text immediately by `JsonDocumentWriter`, so the export never holds lifetime
history twice.

Text chunks are joined and written once. A streaming writer is not used in
version 1: five years of heavy use is roughly 12 to 18 MB of JSON, and managing
a file handle across an exclusive transaction and a cancellation path is not
justified at that size. If measured exports approach 25 MB, the escalation is a
writable stream behind the unchanged `DataExportFileWriter` port.

Paging is an internal read strategy. It never appears in the user interface.

## Export contract

The document is one UTF-8 JSON file with a fixed member order:

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

Every key is always present. Optionality is expressed with `null`, never by
omitting a key; collections become `[]`. The single exception is the
prescription and result variant objects, where the `kind` discriminator already
governs which measurement fields exist.

Section and field names are product language. No table name, column name, or
internal search key such as a normalized name appears in the file.

### Sections

| Section                             | Contents                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `profile`                           | `heightMillimeters`, `weightGrams`, `biologicalSex`, `dateOfBirth`, `activityLevel`, `preferredUnitSystem`            |
| `goalsAndEnergy.goal`               | `goalType`, `adjustmentKilocalories`                                                                                  |
| `nutrition.entries`                 | entry snapshot: `description`, `provenance`, `reference`, `consumedQuantity`, `referenceNutrition`, occurrence triple |
| `nutrition.catalogItems`            | saved item plus `isFavorite`, `useCount`, `lastUsedAtEpochMilliseconds`                                               |
| `hydration.entries`                 | `fluidType`, `volumeMilliliters`, `description`, occurrence triple                                                    |
| `hydration.currentTarget`           | `targetMilliliters`, named as current                                                                                 |
| `exerciseCatalog.exercises`         | `name`, `equipment`, `primaryMuscleGroup`, `loggingMode`, `notes`, `isFavorite`                                       |
| `workoutPlanner.plannedWorkouts`    | `weekday`, `name`, ordered exercises with `exerciseId` and `prescription`                                             |
| `workoutSessions.activeSession`     | the single active session, or `null`                                                                                  |
| `workoutSessions.completedSessions` | completed sessions with exercise snapshots and individual sets                                                        |
| `bodyMeasurements.weightCheckIns`   | `massGrams`, `note`, occurrence triple                                                                                |

### Canonical units

| Dimension | Unit               |
| --------- | ------------------ |
| Mass      | grams              |
| Length    | millimeters        |
| Volume    | milliliters        |
| Energy    | kilojoules         |
| Sodium    | milligrams         |
| Duration  | seconds            |
| Instant   | epoch milliseconds |

Every numeric field name ends in its unit. The goal calorie adjustment stays in
whole kilocalories because the domain guarantees an integer there. Nothing is
presentation-rounded and no display duplicate exists; `preferredUnitSystem` is
exported as a setting and never rewrites a stored value.

### Time

Historical records carry `occurredAtEpochMilliseconds`, `localCalendarDate`, and
`utcOffsetMinutes` exactly as stored; workout sessions carry the equivalent
`startedAt` triple. History is never reprojected through the device's current
time zone, and no derived local timestamp string is added. `generatedAt` is an
ISO 8601 UTC instant. Records whose creation time was never stored carry no
timestamp, because the application does not know it.

### Derived values

BMI, resting energy, maintenance energy, the daily calorie target, and consumed
nutrition amounts are not exported. Each is a pure function of values already in
the file, so exporting them would duplicate state that can drift and would
invite reading a current calculation as history.

Consumed nutrition is recomputable as
`consumed = referenceNutrition × (consumedQuantity ÷ reference)`. The energy and
BMI formulas are documented in
[Goals & Energy](goals-and-energy.md).

### Historical truth

The export performs no join the write path did not already perform.

- Completed session exercises keep their stored name, logging-mode, and planned
  prescription snapshots, so a renamed or deleted definition cannot rewrite what
  was performed. A `sourceExerciseId` absent from `exerciseCatalog` is itself
  the truthful record; nothing is fabricated in its place.
- Nutrition entries keep their captured facts and are never rejoined to the
  catalog.
- The hydration target sits outside the entries array and is named as current.
  No past day has a known target and none is invented.
- Planner intent is a separate section and is never presented as history.
- An active session is exported on its own, with `"status": "active"` and a
  `null` completion time. It is never listed or counted as a completed workout.
- Profile weight and body-weight check-ins stay in separate sections, preserving
  the authority split in
  [ADR 0012](../decisions/0012-body-measurement-history-and-current-weight-authority.md).

### Identifiers

Application-generated UUIDs are exported as `id`, and references use
export-facing names (`exerciseId`, `sourceExerciseId`, `sourcePlannedExerciseId`,
`sourcePlannedWorkoutId`). They carry no personal information, no account, and
no device identity, and they are the only stable way to express the
session-exercise-set relationship. `position` is exported as ordered domain
data, never as identity.

### Ordering and determinism

Every array has a declared total order broken by identifier, and each order is
served by an index that already exists, so no migration or new index was needed.

| Array                                                                       | Order                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------ |
| `nutrition.entries`, `hydration.entries`, `bodyMeasurements.weightCheckIns` | local calendar date, occurrence, id              |
| `nutrition.catalogItems`, `exerciseCatalog.exercises`                       | normalized name, id                              |
| `workoutPlanner.plannedWorkouts`                                            | weekday, then exercise position                  |
| `workoutSessions.completedSessions`                                         | started local calendar date, started instant, id |
| session exercises and sets                                                  | position                                         |

Given identical stored state, an identical `generatedAt`, and an identical
application version, the document is byte-identical. Byte equality across runs
is not promised, because `generatedAt` legitimately differs.

### Versioning

`format` is the constant `fitness-app-data-export`. `formatVersion` is the
integer `1` and is a public compatibility contract, deliberately independent of
the SQLite migration version. Any contract change increments it; one integer
with one meaning is preferred over a compatibility matrix. `application.version`
is metadata only. No migration framework exists for a version that does not
exist yet.

## File handling

The export is written to a `data-export` directory inside the application cache
directory. Cache is deliberate: it is inside the sandbox, platform convention
keeps it out of device backups, and the system may reclaim it.

The file is named `fitness-app-export-<compact UTC instant>.json`, derived from
the same instant as `generatedAt`, media type `application/json`. The directory
is removed and recreated before every export, so exactly one export exists at a
time and a same-second repeat cannot collide.

Cleanup runs when the export screen opens, before every generation, when the
user discards an export, and when local data is erased. It deliberately does not
run immediately after the share handoff resolves, because an Android receiver
may still be reading the granted content URI. The application never touches the
destination the user chose.

Replacing local data is a second caller of this exporter. It produces the
recovery copy through `CreateDataExportUseCase` unchanged, so the same directory
rule applies and a recovery copy replaces any export the application was still
holding. That copy is deliberately **not** cleaned up when the replacement
commits — it is the user's way back, and the application cannot tell whether a
share sheet saved it — so it survives until the export screen next prepares the
directory or the system reclaims the cache. See
[safe replacement restore architecture](safe-replacement-restore.md).

`ClearDataExportsUseCase` reports a cleanup failure to its caller rather than
swallowing it, because its callers owe the user different answers. The export
screen ignores it, since generating an export prepares the directory again. An
erasure reports it as a warning on an otherwise successful deletion, because a
file the application still owns is exactly what the user asked to be gone; see
[offline local data erasure architecture](offline-local-data-erasure.md).

## Failure, cancellation, and errors

Version 1 is all-or-nothing. Any repository read failure aborts the export with
no file; a capability is never silently omitted, and a failed export is never
presented as successful. `DataExportError` carries `read-failed`,
`serialization-failed`, `file-write-failed`, `sharing-unavailable`,
`sharing-failed`, or `cancelled` with a fixed safe message, mirroring
`PersistenceError`.

Generation exposes a cancel control. The token is checked between pages and
between sections, and it is also set when the screen unmounts. Any file already
written is removed. Stale completions are discarded by request identity, so a
superseded or unmounted export can never update the screen.

The platform resolves the share sheet whether the user saved or dismissed it, so
the application reports a neutral handoff message and never claims the file was
saved.

## Privacy and security

The export contains sensitive personal and fitness information, including date
of birth, biological sex, and body measurements. It is produced only by an
explicit user action, after a notice stating what is included, that the file is
created on this device, that the application does not upload it, that the user
chooses the destination, that the file is not encrypted, and that it can be
restored later only into an application that holds no information yet.

There is no network call, telemetry, or analytics in the capability, and no
logging at all, so no log can leak export contents. No storage permission is
requested; the platform share and save controls own the destination. Automated
tests and end-to-end evidence use synthetic data only.

Export encryption does not exist and is not implied anywhere in the interface or
documentation. Adding it would need a separate reviewed design covering key
derivation, container format, password handling, recovery, and cross-platform
compatibility.

## Dependencies

`expo-sharing` is the only supported way to hand a file to the platform share
and save controls on both targets; the React Native `Share` API cannot share a
file on Android. It is first-party, MIT licensed, autolinked, requires no
runtime permission, and performs no network access. `expo-file-system` was
promoted from a transitive dependency of `expo` to a declared direct dependency
because the application now imports it.

Generated native projects remain ignored, so the native module adds no committed
native change. The first end-to-end run after this change rebuilds the native
project.

## Persistence and Progress

No migration, table, column, index, trigger, or view was added; the migration
version stays 11. Progress Analytics is unchanged: the export reads the same
historical authorities but adds no card, trend, chart, or period calculation and
never treats a presentation-formatted Progress summary as export data.

## Known limitations

- An export is a copy the user controls, not an automatic backup. Nothing
  creates one on a schedule and nothing recovers one from a cloud service.
- A saved export can be read back in through
  [offline data restore](offline-data-restore.md), but only into an
  installation that holds no information yet. Merging and replacing are not
  supported.
- The file is not encrypted once it leaves the application sandbox.
- The whole document is held in memory while it is written, which caps practical
  exports at roughly 25 MB.
- Progress is indeterminate. A percentage would need a counting pass over every
  table, doubling the work.
- Selecting capabilities or a date range is not supported; an export is always
  complete.
- Writes are blocked for the duration of the export transaction.
- Since migration 12, a tombstoned record — one a person deleted — is excluded
  from export exactly as a hard-deleted one always was, and the synchronization
  metadata described in
  [Schema synchronization readiness](schema-synchronization-readiness.md) is
  never read into the file; the contract and `formatVersion` are unchanged.
