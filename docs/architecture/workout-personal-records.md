# Workout personal records architecture

## Boundary and authority

Personal records are a derived read inside the `workout-history` capability:

```text
completed session snapshots
  → GetExercisePersonalRecordsUseCase
  → WorkoutPersonalRecordsReader
  → capability-owned SQLite projection
  → immutable read model → per-exercise history UI
```

Only actual sets belonging to a completed Workout Session can establish a
record. Planned prescription snapshots, active sessions, Exercise Catalog rows,
Profile weight, recorded body weight, and Progress summaries are never read.
There is no write model, no record table, no cache, and no background
recomputation. Nothing is persisted; every claim is recomputed from history.

The reader is a separate contract from `WorkoutHistoryRepository`, alongside
`WorkoutSessionExportReader`, because it answers a different question: the
repository pages through history, while this reader selects one bounded set of
per-set maxima for one exercise.

## Identity and logging modes

A record belongs to the `source_exercise_definition_id` captured in completed
history, partitioned by the captured `logging_mode_snapshot`. An exercise whose
logging mode was changed later reports one record group per mode, and unlike
modes are never compared.

Five domain result variants serve eight logging modes, so external load, added
bodyweight load, and assistance all share one stored shape. The result variant
therefore cannot carry record meaning; the captured logging mode does.

Two modes share one category only when they produce the identical result variant
and neither records a load value. `repetitions` and `bodyweight-and-repetitions`
are the only pair that qualifies.

## Categories

| Category                         | Logging mode                                | Compared canonical value |
| -------------------------------- | ------------------------------------------- | ------------------------ |
| `most-repetitions`               | `repetitions`, `bodyweight-and-repetitions` | repetitions              |
| `heaviest-load`                  | `external-load-and-repetitions`             | grams                    |
| `heaviest-added-load`            | `bodyweight-plus-load-and-repetitions`      | grams                    |
| `longest-duration`               | `duration`                                  | seconds                  |
| `longest-distance`               | `distance`                                  | millimetres              |
| `longest-distance-with-duration` | `distance-and-duration`                     | millimetres              |
| `longest-duration-with-distance` | `distance-and-duration`                     | seconds                  |

`assistance-and-repetitions` has no category: less assistance and more
repetitions do not order together. The screen states that reason, and the reader
reports the mode in `unsupportedLoggingModes` so it is explained rather than
dropped or shown as a zero.

Repetitions under load, single-set load volume, pace, and estimated
one-repetition maximum are excluded. [ADR 0017](../decisions/0017-deterministic-workout-personal-records.md)
records why each was rejected.

Body mass is never inferred or added. Load and added load are never merged,
summed, or ranked against each other.

## Ordering, ties, and stability

Every category uses one total order: the compared value descending, then the
captured local date, the start instant, the exercise position, the set position,
and the set identifier ascending. Equal values therefore report the earliest
completed occurrence — when the record was first achieved — and a later equal
result moves neither the date nor the evidence link. The identifier tie-break
only guarantees a stable answer; it never changes the claim and never reaches
the interface.

Ordering compares exact stored canonical numbers rather than the domain's
epsilon equality, because a total order is what makes the selection
reproducible. Rounding happens only when a value is formatted for display.

Every recorded quantity is strictly positive in the domain and in the schema, so
a zero record cannot exist. Absence is absence.

Records are stable across relaunch, timezone change, unit-preference change,
Catalog rename, Catalog deletion, Planner edits, export, restore, and
replacement restore. The one thing that moves a record is a deliberate
[correction of a recorded set](completed-workout-correction.md): the next read
derives the new truth, so an overstated record disappears and the next eligible
result takes its place, with nothing to invalidate.

## Queries and indexes

Two bounded statements per exercise, both fully bound:

1. One compound statement with one `ORDER BY ... LIMIT 1` branch per category,
   generated from the descriptor table in
   `application/exercise-personal-records.ts`. Branch count is fixed by that
   table, never by history size, and a mode the exercise never used contributes
   no row. The comparison rule therefore exists once, in TypeScript, and the SQL
   is derived from it.
2. One statement reporting which logging modes appear in that exercise's
   completed history, for the unsupported-mode explanation and the latest
   captured name.

Access is served by `workout_session_exercise_source_history` and
`workout_set_order` from migrations 10 and 9. No migration, index, schema
change, or persisted value was added, and lifetime history never enters
application memory. A persistence test asserts the query plan uses the source
history index and performs no full scan of `workout_session_exercise`.

## Historical exercise discovery

The Workout History exercise list derives from completed snapshots instead of
resolving identifiers through the mutable Exercise Catalog, so a deleted
definition keeps its captured name and its records stay reachable. No deleted
Catalog state is rebuilt. The Workout Session exercise picker keeps its
Catalog-resolved recents, because choosing an exercise to perform needs a
definition that still exists.

Navigation labels and the screen heading use the latest completed snapshot name.
A record card additionally shows the name captured at that occurrence when it
differs, so a rename never rewrites what history recorded.

## Experience, accessibility, and privacy

The per-exercise history screen gains a personal-records section above its
performed-session list. Each record states its category, its value in the
preferred units, when it was first recorded, the completed workout, and the set,
and opens that workout as evidence. A records failure is scoped to the section
with a retry, so already loaded performed history stays visible, and a response
from a superseded request is discarded rather than rendered.

Accessible labels repeat exactly what is visible with units written as words.
Nothing depends on color, an icon, a badge, or a chart. Wording describes
recorded application data — "heaviest recorded load", not a physiological claim,
a strength level, a score, or advice.

There is no network, telemetry, analytics, AI, permission, external service, or
new dependency. Stored values are revalidated before use, corrupt rows fail
safely, and no name, value, date, identifier, or record is logged.

## Lifecycle impact

Records are derived, so export format version 1 is unchanged and no derived
value is exported, imported, or persisted. After restore or replacement records
follow from the restored history with nothing to migrate, and stable identifiers
keep evidence links intact. After erasure no records remain. Cross-capability
Progress is unchanged: it answers what happened in a chosen period, while
records answer a lifetime question.
