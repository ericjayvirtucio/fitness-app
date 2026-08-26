# Specification 0012: Offline workout planner

- Status: Approved
- Date: 2026-08-05
- Amended: 2026-08-26, to note that "RPE/RIR," excluded below, now has an
  approved recorded-observation version. See
  [Specification 0046](0046-record-reps-in-reserve.md).

## Objective and scope

Add one device-local recurring Sunday-to-Saturday workout plan. Each day is
either Rest or a named planned workout containing ordered references to Exercise
Catalog definitions and logging-mode-specific planned prescriptions. This sprint
models future intent only; it adds no Workout Session, actual result, history,
timer, completion, record, volume, or analytics behavior.

## Domain and lifecycle

`@fitness/domain` owns the controlled Sunday-first weekday representation,
immutable planned workouts and exercises, and a discriminated prescription
union. Prescriptions reuse `DomainId`, `Mass`, `Length`, `Duration`, `Result`, and
`DomainError`. Workout names are required and limited to 80 characters. Sets,
repetitions, and optional resistance are positive and bounded for input
integrity. Duration and distance targets are positive and bounded. These limits
are technical safeguards, not medical or training advice.

A planned exercise references a mutable Exercise Definition rather than
snapshotting catalog metadata. Renames therefore appear in current plans.
Referenced Exercise Definitions cannot be hard-deleted, and their logging mode
cannot change until the affected plan items are removed. The application reports
the referencing days and workouts; SQLite foreign keys and a trigger defend the
same lifecycle. Other valid catalog edits remain allowed. Future completed
Workout Sessions must snapshot historically stable context and must not depend
solely on mutable catalog or Planner rows.

## Weekly plan and persistence

Weekdays use integers 0 through 6, where 0 is Sunday. The application always
materializes seven ordered day states. A missing `planned_workout` row represents
Rest; no fake empty workout or seven-row schedule singleton is stored.

Migration 8 adds UUID-identified `planned_workout` and `planned_exercise` tables.
One workout is allowed per weekday. Child positions are contiguous and unique
within a workout. A planned-exercise row is the relational encoding of the
closed prescription union, with checks requiring exactly the columns applicable
to its discriminator. Workout deletion deliberately cascades to owned children;
Exercise Definition deletion is restricted.

The Planner repository loads the full week with one ordered join and exposes
aggregate replacement, lookup, deletion, and focused exercise-reference reads.
Saving a workout replaces its ordered children inside the existing transaction
abstraction. No generic repository, ORM, cache, calendar engine, sync metadata,
timestamp, or derived summary is introduced.

## Planning rules

Repetitions and bodyweight-repetitions modes plan sets and repetitions. External
load, added bodyweight load, and assistance modes additionally permit an optional
positive `Mass`, retaining distinct UI labels for their different semantics.
Duration, distance, and distance-duration modes accept only their applicable
canonical measurements plus sets. Per-set variation is deferred.

Duplicate Exercise Definitions in one workout are legal after confirmation and
receive independent planned-exercise identifiers. Reordering uses accessible
move-up and move-down controls. Copy-to-day and planner notes are deferred.
Selecting an exercise for future intent does not make it a catalog recent.

## Experience and accessibility

The Workout tab becomes the weekly overview while preserving Exercise Library
access. Compact day cards show a full day name, Rest or workout name, exercise
count, and a descriptive edit action. A single editor owns its unsaved draft and
an internal Exercise Picker so navigation does not require global state or place
sensitive draft contents in route parameters.

The editor exposes only fields supported by the selected logging mode. Existing
profile unit preference controls kilogram/pound and kilometer/mile presentation;
canonical storage remains grams and millimeters. The flow supports Dynamic Type,
screen readers, keyboard interaction, minimum targets, textual state, live
validation feedback, descriptive ordering controls, and deliberate confirmation
before converting a populated workout to Rest.

## Privacy, security, and performance

Plans remain in the operating-system application sandbox. There is no network,
analytics, telemetry, AI, sensitive logging, or new permission. SQL values are
bound, persisted rows are validated, and errors remain generic. Encryption,
export, backup, restore, reset, and retention are deferred.

The full plan uses one small joined read; reference checks use one focused
indexed query. Writes hold short local transactions. There are no N+1 reads,
global state, speculative caches, background work, or persisted analytics.

## Verification and completion

Domain tests cover weekdays, aggregate invariants, prescriptions, mode
compatibility, bounds, ordering, duplicates, and immutability. Application,
persistence, and UI tests cover seven-day materialization, aggregate CRUD,
Rest/workout conversion, exercise selection, mode-specific targets, ordering,
references, catalog mutation protection, transactions, migration 8, corrupt
rows, safe errors, accessibility, and Exercise Library reachability.

Completion requires all repository quality gates, staff-level diff review, and
the Sprint 12 manual checklist. Merge readiness remains blocked until the
repository owner confirms manual QA.

## Explicit exclusions

Workout Sessions, actual sets or measurements, history, completion, timers,
RPE/RIR, PRs, training volume, analytics, calories, arbitrary dates, multi-week
cycles, copy-to-day, planner notes, in-planner catalog creation, Planner recents,
drag-and-drop, backend behavior, authentication, synchronization, tombstones,
notifications, encryption, and external integrations are excluded.

The repository owner approved the Stage 1 design and requested staged,
commit-by-commit implementation on 2026-08-05.
