# Offline workout planner architecture

## Boundary and recurring-week semantics

The Workout Planner is a device-local capability:

```text
Workout routes → workout-planner presentation → Planner use cases
  → capability repository → Expo SQLite
```

The plan is the user's current recurring Sunday-to-Saturday routine. It has no
calendar dates, week instances, history, or completion state. The domain uses a
controlled `Weekday` value from 0 (Sunday) through 6 (Saturday). UI owns display
labels and can localize them later without changing persisted values.

The application always returns seven ordered day states. A missing
`planned_workout` row is Rest. Rest is not an empty workout or a workout named
“Rest.” Converting a populated workout to Rest requires confirmation and
atomically deletes that workout's owned planned exercises.

## Planned workouts, exercises, and prescriptions

`PlannedWorkout` is immutable future intent with a UUID, weekday, required
trimmed name, and ordered `PlannedExercise` children. Children have independent
UUIDs, catalog identifiers, contiguous positions, and a discriminated
prescription. A workout may temporarily contain no exercises so a user can name
and build it incrementally.

Prescription variants are repetitions, resistance and repetitions, duration,
distance, and distance plus duration. They reuse canonical `Mass`, `Duration`,
and `Length`; no Planner-specific measurement values exist. Sets and repetitions
are uniform targets rather than actual or per-set results. Resistance is optional
and its UI meaning comes from the authoritative logging mode: external weight,
added bodyweight, or assistance.

Technical limits protect input and storage: 100 sets, 10,000 repetitions,
1,000 kg resistance, seven days duration, 1,000 km distance, and 100 exercises
per workout. They are not medical or programming advice.

## Exercise Catalog references

Plans reference current mutable `ExerciseDefinition` rows. Catalog renames,
notes, muscle-group edits, and compatible equipment edits therefore appear in
the plan without rewriting Planner data. Planner selection does not create a
catalog recent because future intent is not performed exercise usage.

Hard deletion uses `ON DELETE RESTRICT`. The catalog application reads a narrow
Planner-owned reference port and reports affected weekdays and workout names.
Referenced logging modes also cannot change; the application check and migration
8 trigger prevent silently reinterpreting an existing target. Users remove the
references before either operation. There is no cascade from catalog, archive,
tombstone, or sync lifecycle.

Future completed Workout Sessions must snapshot sufficient exercise name,
logging semantics, and performed result context. Session history must never use
the mutable catalog/Planner join as historical truth.

## Persistence, queries, and transactions

Migration 8 creates `planned_workout` and `planned_exercise`. Workout weekday is
unique. Child position is unique within its workout. The prescription columns
form a strict SQL encoding of the closed domain union: checks require exactly the
applicable repetitions, resistance, duration, and distance values. Canonical
grams, seconds, and millimeters are stored.

Deleting a workout deliberately cascades to its owned children. Deleting an
Exercise Definition is restricted. An index on exercise definition and workout
supports reference checks. One ordered joined query loads workouts, children,
and current definitions; the repository groups, reconstructs, and validates the
result before filling Rest days. There are no N+1 reads.

Saving replaces one aggregate inside the existing `TransactionRunner`: delete
the current weekday row, insert the workout, then insert ordered children. Any
failure rolls back the complete replacement. Catalog reference checks and
protected mutation also share one transaction-scoped catalog/Planner context.

## Units, experience, accessibility, and privacy

Profile preference selects kilograms/pounds and kilometers/miles in forms and
summaries. `Length` now exposes exact kilometer and mile conversions while
retaining canonical millimeters. Duration input supports seconds and minutes.
Changing display units never changes canonical meaning.

The Workout tab shows seven compact day cards and preserves Exercise Library
access. One editor owns its unsaved draft and internal searchable Exercise
Picker, avoiding global state and navigation parameters containing targets.
Duplicates require confirmation and receive independent IDs. Accessible move
buttons are the only ordering interaction; drag-and-drop is absent.

The UI supports Dynamic Type, keyboard-aware scrolling, minimum targets, full day
names, textual Rest state, screen-reader action labels, live validation, and
descriptive destructive confirmation. Meaning does not rely on color.

Workout plans remain in the operating-system application sandbox. There is no
network, permission, analytics, telemetry, AI, or sensitive record logging. SQL
uses bound values, stored rows are validated, and errors are safe. Encryption,
export, backup, restore, and retention remain deferred.

## Known limitations and future seam

There is one recurring week, no notes, no copy-to-day, no date exceptions, no
multi-week program, and no Planner recents. The plan records intent only.

Sprint 13 transactionally snapshots today's name, weekday, ordered exercises,
logging modes, and prescriptions into an independent Workout Session. Later
Planner replacement cannot rewrite execution. Completion and adherence remain
absent from Planner.
