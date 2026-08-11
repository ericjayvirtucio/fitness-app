# Specification 0019: Offline data restore

**Status:** Approved for implementation on 2026-08-11.

## Objective and scope

[Specification 0018](0018-offline-data-export.md) made locally stored information
portable. It did not make it recoverable. A saved export can be inspected,
copied, archived, and processed elsewhere, but it cannot be brought back after
the application is reinstalled, the device is replaced, or app-local data is
lost.

This specification adds one offline restore: the user selects a saved
`fitness-app-data-export` file with `formatVersion` 1, the application validates
it completely, shows a non-sensitive summary, and — only when the installation
contains no user-owned records — writes every record in one atomic transaction.

Restoration requires no network, account, backend, cloud storage, telemetry,
external analytics, or AI provider. The operating system provides the file
picker; the application never uploads the selected file.

Merge, replacement, conflict resolution, selective restore, date-range restore,
cloud backup, synchronization, and encrypted import are out of scope.

## Restore workflow

```text
Profile
  → Restore my data
  → explanation and limitations
  → Choose file → the operating system's file picker
  → read the file
  → validate the complete file
  → review non-sensitive record counts
  → Restore my data (confirmation)
  → one exclusive transaction
  → persistent "Restore complete" confirmation
  → return to the application
```

Validation is a separate, completed step before confirmation. That separation
gives assistive technology a persistent panel to announce, lets the user see
what is about to be written, and provides a stable automated-test boundary on
each side of the platform-owned picker.

## Empty-installation policy

The application restores only into an installation that contains no user-owned
records or configuration. When any record exists, restoration does not begin,
nothing is deleted, nothing is modified, and the screen explains why and
suggests exporting current data first. No overwrite option is offered.

"Empty" is not "no profile". An installation may hold nutrition, hydration,
exercise, planner, session, or body-measurement records without a profile, and
may hold a goal configuration or a hydration target on their own. Every relevant
table is checked.

The reasoning, the rejected merge and replacement alternatives, and the seam
left for a future replacement design are recorded in
[ADR 0014](../docs/decisions/0014-empty-installation-data-restore.md).

## Trust boundary

A selected file is untrusted input, including when it claims

```json
{ "format": "fitness-app-data-export", "formatVersion": 1 }
```

Parsed JSON is never treated as a trusted TypeScript type, never cast to an
export contract interface, and never inserted directly into the database. The
version 1 export contract's TypeScript interfaces describe what the exporter
writes; they carry no runtime guarantee about a file the application did not
create. The parser therefore starts from `unknown` and narrows every value with
an explicit guard.

`any`, unsafe assertions, `@ts-ignore`, disabled lint rules, and unchecked enum
casts are prohibited in this capability.

## Validation pipeline

Layers run in order. Everything except the final empty-state recheck completes
before any record is written.

1. Picker result — cancellation is a neutral outcome, not a failure.
2. File accessibility.
3. File metadata and size, read before the contents.
4. UTF-8 decoding.
5. JSON parsing.
6. Top-level value is a non-array object.
7. `format` discriminator.
8. `formatVersion` dispatch.
9. Exact section presence.
10. Required-key presence.
11. Primitive types.
12. Enumerations.
13. String and collection bounds.
14. Finite and integral numbers.
15. Identifiers.
16. Duplicate identifiers per identity scope.
17. Occurrence instants, local calendar dates, and UTC offsets.
18. Domain reconstruction through existing constructors.
19. Cross-record referential integrity.
20. Restore preview.
21. Empty-target verification.
22. Atomic persistence, with the empty-target check repeated inside the write
    transaction.

### Supported format

Exactly `"fitness-app-data-export"` with `formatVersion` `1`. Compatibility is
never inferred from the application version, the SQLite migration version, the
file name, the media type, or the file extension. The picker filters on
`application/json` to improve the selection experience; the contents remain
authoritative.

An unsupported version produces its own understandable error. No upcasting or
generic format-migration framework is created. Version 1 needs a deliberate
parser behind a version-dispatch boundary a future version can extend.

The `format` and `formatVersion` constants are imported from the existing
version 1 export contract module, so the two sides of the contract cannot drift.
The `Exported*` interfaces are deliberately not used as parse targets.

### Unknown, missing, and null keys

Unknown keys are ignored. Rejecting them would gain no safety, because nothing
unvalidated is ever passed through, and would break a file that only added an
additive member.

A missing required key is rejected. The contract states that every key is always
present and that optionality is expressed with `null`. The single exception is
the prescription and result variant objects, where the `kind` discriminator
already governs which measurement fields exist.

`null` is accepted only where the contract declares it: `application.version`,
`profile`, `goalsAndEnergy.goal`, `hydration.currentTarget`,
`workoutSessions.activeSession`, `completedAtEpochMilliseconds`, a hydration
entry description, exercise notes, a check-in note, the six optional nutrients,
`resistanceGrams` inside a `resistance-and-repetitions` prescription,
`lastUsedAtEpochMilliseconds`, `sourcePlannedExerciseId`,
`sourcePlannedWorkoutId`, and `sourceWeekday`. An unknown nutrient stays
unknown; it is never converted to zero, and a known zero stays zero.

### Enumerations, numbers, and strings

Enumerations are validated against the domain's exported constant arrays.
Numbers must be finite, and integral where the contract and schema require it.
Ranges beyond primitive sanity are left to the domain constructors so no
business rule is duplicated. Any single string is capped at 4096 characters as
resource protection before domain length rules apply.

### File size and resource protection

The file is rejected when it is empty or larger than 25 MB, checked from file
metadata before the contents are read and again against the decoded text. That
ceiling matches the whole-document buffering limit already documented for
export, so a file this application produced always fits.

Collection ceilings exist to bound memory and processing. They are technical
resource protection, not fitness advice, and sit far above realistic use:

| Collection                                             | Maximum |
| ------------------------------------------------------ | ------- |
| nutrition entries, hydration entries, weight check-ins | 200000  |
| nutrition catalog items, exercises                     | 20000   |
| completed workout sessions                             | 50000   |
| planned workouts                                       | 7       |
| exercises per planned workout or session               | 100     |
| sets per session exercise                              | 100     |
| characters in any single string                        | 4096    |

Nesting depth is fixed by the contract, so the parser never recurses over
arbitrary structure. Streaming parsing is not introduced; nothing in the
measured data justifies it.

## Identity

Exported identifiers are preserved exactly. No replacement identifier is
generated, because stable identifiers are what preserve planner references,
workout provenance, session nesting, exercise and set identity, and the
possibility of a faithful re-export.

Malformed identifiers are rejected. Duplicates are rejected before anything is
written, per identity scope:

| Scope                                                                            | Unique within                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------- |
| nutrition entries, catalog items, hydration entries, exercises, weight check-ins | their own array                                    |
| planned workouts                                                                 | the planner section                                |
| planned exercises                                                                | the whole planner section                          |
| workout sessions                                                                 | the active session and completed sessions combined |
| session exercises, sets                                                          | every restored session                             |

Identifiers are not required to be unique across capabilities, because those are
separate tables and no such rule exists in the application.

Historical source references are references, not entities, and never participate
in duplicate detection.

## Canonical units

Canonical values are restored exactly as exported: mass in grams, length in
millimeters, volume in milliliters, energy in kilojoules, sodium in milligrams,
duration in seconds, instants in epoch milliseconds, and the goal adjustment in
whole kilocalories. No value is round-tripped through kilograms, pounds, ounces,
cups, formatted dates, localized strings, or the current time zone.
`preferredUnitSystem` is restored as a setting and never rewrites stored
history.

## Time and historical semantics

The occurrence triple — `occurredAtEpochMilliseconds`, `localCalendarDate`, and
`utcOffsetMinutes` — is restored unchanged, as is the equivalent workout session
`startedAt` triple and the completion instant. Agreement between the stored
instant, offset, and local date is enforced by the existing domain constructors,
which recompute the local date at the stored offset.

No history is reprojected through the device's current time zone, and no
timestamp is invented for a record that never stored one. `generatedAt` is file
metadata; it is shown as context and never persisted as a record timestamp.

## Historical truth

- **Nutrition.** Consumption entries are restored with their captured facts and
  are never re-resolved against the catalog. Unknown optional nutrients stay
  unknown. Catalog items are restored separately with their favourite and usage
  state, and their internal normalized search key is derived on write rather
  than read from the file.
- **Hydration.** Entries are restored as history. `currentTarget` is restored as
  current configuration only; no past day gains a target.
- **Exercise Catalog.** Current definitions and favourite state are restored.
  Definitions absent from the file are not fabricated.
- **Workout Planner.** Recurring future intent is restored and is never merged
  into history. Planner references must satisfy the live-reference rules.
- **Active session.** At most one is restored, with its captured execution
  context, `"status": "active"`, and no completion instant. It never becomes
  completed history.
- **Completed history.** Names, logging-mode snapshots, planned prescriptions,
  and individual performed sets are restored as recorded, never re-resolved
  against the current Catalog or Planner, and never inferred from prescriptions.
- **Body measurements.** Check-ins are restored separately from profile weight.
  Neither is derived from the other.
- **Goals and energy.** The authoritative configuration is restored. BMI,
  resting and maintenance energy, and the daily calorie target are recomputed by
  the existing deterministic logic and never imported or persisted.
- **Progress.** No summary is imported. Existing readers derive Progress from the
  restored authoritative records.

## Referential integrity

Current mutable intent must resolve:

- every planned exercise references a restored exercise definition, because
  `planned_exercise.exercise_definition_id` is a restricted foreign key;
- a planned prescription is compatible with that definition's logging mode;
- planned exercise positions are contiguous from zero within a workout and each
  weekday appears at most once;
- session exercise and set positions are contiguous from zero;
- a set result is compatible with its exercise's logging-mode snapshot;
- a planned prescription snapshot is compatible with that same logging mode;
- at most one active session exists, no active session appears among completed
  sessions, and no completed session appears in the active slot;
- a completed session has a completion instant at or after its start;
- profile, goal configuration, and hydration target are singletons.

Historical references deliberately need not resolve: `sourceExerciseId`,
`sourcePlannedExerciseId`, and `sourcePlannedWorkoutId` may point at definitions
that no longer exist, exactly as
[ADR 0008](../docs/decisions/0008-historical-workout-session-snapshots.md)
intends. The schema carries no foreign key on them, and none is added.

Reference checks use maps and sets, so validation stays linear in record count.

No database foreign key, table, column, index, trigger, or view is added.

## Domain reconstruction

Parsed primitives pass through the existing domain constructors — `DomainId`,
`Mass`, `Length`, `Volume`, `Duration`, `Energy`, `NutritionFacts`,
`ConsumptionEntry`, `HydrationEntry`, `HydrationTarget`, `ExerciseDefinition`,
`PlannedPrescription`, `PlannedExercise`, `PlannedWorkout`, `WorkoutResult`,
`WorkoutSet`, `WorkoutSessionExercise`, `WorkoutSession`, `BodyWeightEntry`,
`UserProfile`, `GoalConfiguration` — and the application-owned
`NutritionCatalogItem` and `ExerciseCatalogItem`.

`@fitness/domain` is unchanged. No domain record gains an import method, because
a public file format must not be coupled to mutable domain classes. Business
invariants stay in the domain; the parser rejects only malformed primitive
structure before the domain is called.

## Architecture

```text
Profile route
  → PersonalProfileScreen ("Restore my data")
  → /data-restore → DataRestoreScreen
  → SelectDataRestoreFileUseCase → DataRestoreFilePicker → expo-file-system
  → ParseDataExportUseCase (pure) → version dispatch → version 1 parser
      → domain reconstruction → referential validation → restore preview
  → RestoreDataExportUseCase
      → SqliteTransactionRunner<DataRestoreTransactionContext>
          → capability stored-data probes (empty recheck)
          → existing capability repositories (writes)
```

A new `data-restore` capability coordinates only. It owns no table and issues no
SQL. It owns file selection, size enforcement, format and version dispatch,
parsing, cross-capability validation, the preview, orchestration, transaction
completion, and the screen.

### Capability writers

No new writer contract is added. Every existing repository method already
preserves identity and complete state, so restoration reuses them:

| Capability       | Method                    | Preserves                                       |
| ---------------- | ------------------------- | ----------------------------------------------- |
| Personal Profile | `save`                    | every profile field                             |
| Goals & Energy   | `save`                    | goal type and adjustment                        |
| Nutrition        | `insert` (entry and item) | identifier, snapshot, favourite, usage state    |
| Hydration        | `insert`, `save`          | identifier, occurrence triple, current target   |
| Exercise Catalog | `insert`                  | identifier and favourite state                  |
| Workout Planner  | `replace`                 | workout and planned exercise identifiers, order |
| Workout Session  | `insert`                  | identifier, status, completion, exercises, sets |
| Body Measurement | `insert`                  | identifier, mass, note, occurrence triple       |

Adding parallel restore-writer contracts would duplicate working methods and
grow the public surface for no gain. A batch-insert strategy stays available
later behind the same contracts if measurement justifies it.

### Empty-state detection

The one genuinely new question — "does this capability hold anything?" — is
asked through a narrow shared port, `StoredDataProbe`, implemented once per
capability in its own infrastructure folder, following the cross-capability
reader boundary in
[ADR 0011](../docs/decisions/0011-cross-capability-derived-progress-analytics.md).

Probes cover `personal_profile`, `goal_configuration`,
`nutrition_consumption_entry`, `nutrition_catalog_item`, `hydration_entry`,
`hydration_target`, `exercise_catalog_item`, `planned_workout`,
`workout_session`, and `body_weight_entry`. `planned_exercise`,
`workout_session_exercise`, and `workout_set` are cascade-deleted children and
cannot exist without a covered parent.

## Transaction strategy

Parsing, domain reconstruction, and referential validation complete outside the
write transaction and produce immutable restore data. One exclusive transaction
then rechecks emptiness and writes every record.

Insertion order follows the schema:

1. profile
2. goal configuration
3. nutrition catalog items, then nutrition entries
4. hydration entries, then the current target
5. exercise definitions
6. planned workouts, which reference step 5
7. completed workout sessions, then the active session
8. body-weight check-ins

Sessions carry no foreign key to the catalog, so history restores independently
of step 5. Restoration is all-or-nothing: any failure rolls back every insert,
and a partially restored installation is never presented as successful.

## Persistence and migration

No migration is added and the SQLite migration version stays 11. The database
file is never restored or replaced, and migrations recorded in an export are
never replayed. `formatVersion` 1 stays independent of the migration version.

## File selection

`expo-file-system`, already a declared direct dependency since specification
0018, provides `File.pickFileAsync` on Expo SDK 57. It opens the system picker,
supports MIME filtering, reports cancellation as a first-class result rather
than an exception, returns a temporary copy on iOS, supports Android content
URIs, and needs no runtime storage permission. `file.info()` reports size before
the contents are read, and `file.text()` decodes UTF-8.

No dependency is added. The picker sits behind a `DataRestoreFilePicker` port so
the application layer never sees Expo types, and so a different picker could
replace it without touching the use cases.

The application never asks for broad storage access; the system picker grants
access to exactly one selected file, and the application never modifies or
deletes the file the user chose.

## Application refresh

Every screen except the profile screen already reloads on focus. The profile
screen is changed to the same focus-based refresh, so returning to the
application after a restore shows restored state without a restart, a
composition reset, or hidden global state.

## Failure, cancellation, and lifecycle

| Situation                                | Behavior                                        |
| ---------------------------------------- | ----------------------------------------------- |
| Picker unavailable or fails              | Safe failure, nothing read                      |
| Picker cancelled                         | Neutral outcome, never described as a failure   |
| File inaccessible, empty, or oversized   | Safe failure before the contents are read       |
| Invalid encoding or JSON                 | Safe failure, nothing written                   |
| Wrong format or unsupported version      | Distinct, understandable failure                |
| Invalid structure, record, or reference  | Distinct failure, nothing written               |
| Duplicate identifier                     | Distinct failure, nothing written               |
| Collection above its ceiling             | Distinct failure, nothing written               |
| Installation already holds data          | Refusal before and again inside the transaction |
| Persistence failure                      | Whole transaction rolled back                   |
| Screen unmounted or superseded selection | Result discarded by request identity            |
| Application closes mid-transaction       | SQLite rolls the transaction back               |

The confirmation control is disabled while restoring. Once the write transaction
begins the workflow exposes no cancel control, because SQLite cannot honour a
half-transaction cancellation and the application will not promise one. The
in-transaction emptiness recheck, not the interface, is what prevents a
duplicate or racing restore.

## Errors

`DataRestoreError` carries one of `picker-unavailable`, `file-unreadable`,
`file-empty`, `file-too-large`, `invalid-encoding`, `invalid-json`,
`unsupported-format`, `unsupported-format-version`, `invalid-structure`,
`invalid-record`, `duplicate-identifier`, `unresolved-reference`,
`too-many-records`, `target-not-empty`, or `write-failed`, each with a fixed
safe message, mirroring `PersistenceError` and `DataExportError`. Distinct codes
exist where they change what the user should do next.

No SQL, stack trace, raw JSON fragment, file content, identifier, measurement,
personal detail, or internal path reaches a user-facing message. The capability
performs no logging, so no log path exists to leak into.

## Privacy and security

The selected file holds sensitive personal and fitness information, including
date of birth, biological sex, and body measurements. It is processed entirely
on the device. There is no network call, telemetry, or analytics anywhere in the
capability. No unnecessary permission is requested. The application controls no
temporary copy of the selected file beyond what the platform picker creates and
owns. Automated tests and end-to-end evidence use synthetic data only.

No custom cryptography is written and encrypted import is not supported. Adding
it would need a separate reviewed design covering key derivation, container
format, password handling, recovery expectations, and cross-platform
compatibility.

## Accessibility

The workflow uses existing design-system components with explicit explanation,
reading, validating, preview, confirming, restoring, failure, and completion
states. Busy indicators are labelled, disabled controls keep their labels and
expose a disabled state, status changes are announced through a polite live
region, and the preview and completion panels are persistent rather than
transient. Content wraps under large Dynamic Type without horizontal scrolling,
meets minimum touch targets, and never communicates state through colour alone.
The system file picker remains platform-owned.

## Navigation

One route, `/data-restore`, reached from the Profile tab. Because restoration
exists precisely for an installation with no data, the entry point also appears
in the profile screen's empty state, which previously offered no actions besides
creating a profile. No tab is added.

## Verification and completion

- Parser tests cover a valid complete export, a valid empty export, a wrong
  format, an unsupported version, invalid JSON, wrong primitive types, missing
  keys, invalid nulls, unknown enumerations, non-finite and out-of-range
  numbers, invalid and duplicate identifiers, invalid local dates and offsets,
  an inconsistent occurrence triple, an oversized file, an oversized collection,
  unknown nutrients staying unknown, and known zeros staying zero.
- Referential tests cover valid and missing planner references, an allowed
  dangling historical reference, session nesting, duplicate exercise and set
  positions, incompatible logging mode and result, incompatible logging mode and
  prescription, multiple active sessions, an invalid completion instant, and the
  separation of the active session from completed history.
- Orchestration tests cover an empty target, a target holding only a profile, a
  target holding history without a profile, a target that becomes non-empty
  between preview and transaction, a complete restore, failure during each major
  insertion phase, single-transaction composition, repeated-request protection,
  and stale-completion protection.
- Presentation tests cover the explanation, picker cancellation, reading,
  validating, an invalid file, an unsupported version, the existing-data
  refusal, the preview, confirmation, restoring, persistent completion, retry,
  accessibility labels, and disabled controls.
- Sprint 19 Maestro scenarios cover opening the screen from Profile, reviewing
  the explanation, reaching the file-selection control, refusing restoration
  when data exists, and returning without changing anything.
- The iOS regression suite passes on the final branch state.
- Repository formatting, lint, type checking, tests, and builds pass without
  warnings.

The system file picker is platform-owned, so no flow opens it or asserts inside
it. A complete successful restore is therefore verified by manual device QA
using a synthetic export, and that boundary is documented rather than hidden.

## Explicit exclusions

Merge import, replacement restore, conflict resolution, deduplication, selective
capability restore, date-range restore, cloud backup, synchronization,
authentication, backend endpoints, database-file replacement, generic import
plugins, arbitrary JSON or CSV import, encrypted archives, password protection,
scheduled or automatic restore, derived Progress import, historical target
fabrication, AI, new measurement types, charts, notifications, API changes,
domain-package changes, SQLite migrations, new tables or indexes, application
data deletion or reset, repository-wide refactoring, broad dependency upgrades,
and any second end-to-end runner are excluded.
