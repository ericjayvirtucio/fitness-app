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

| Category                         | Logging mode                                | Compared canonical value | Order      |
| -------------------------------- | ------------------------------------------- | ------------------------ | ---------- |
| `most-repetitions`               | `repetitions`, `bodyweight-and-repetitions` | repetitions              | descending |
| `heaviest-load`                  | `external-load-and-repetitions`             | grams                    | descending |
| `heaviest-added-load`            | `bodyweight-plus-load-and-repetitions`      | grams                    | descending |
| `longest-duration`               | `duration`                                  | seconds                  | descending |
| `longest-distance`               | `distance`                                  | millimetres              | descending |
| `longest-distance-with-duration` | `distance-and-duration`                     | millimetres              | descending |
| `longest-duration-with-distance` | `distance-and-duration`                     | seconds                  | descending |
| `least-assistance`               | `assistance-and-repetitions`                | grams                    | ascending  |

Every logging mode the domain defines has at least one category.

A category may claim one dimension and stay silent about the others; it may never
combine two. `least-assistance` claims the smallest assistance recorded on one
completed set and refuses to claim anything about repetitions, effort, strength,
or progression — exactly as `heaviest-load` claims a load and says nothing about
the repetitions performed under it. Less assistance and more repetitions still do
not collapse into one value; that is why neither category tries.

`workout_set.resistance_grams` is constrained above zero, so zero assistance is
not recordable. A repetition performed with no assistance is unassisted work
under a different logging mode, not an assisted set holding zero, and it starts
its own record group rather than driving this one to zero.

Repetitions under load, single-set load volume, pace, and estimated
one-repetition maximum are excluded. [ADR 0017](../decisions/0017-deterministic-workout-personal-records.md)
records why each was rejected, and
[ADR 0022](../decisions/0022-personal-record-ordering-direction.md) amends its
assistance clause and records what a record is permitted to claim.

Body mass is never inferred or added. Load and added load are never merged,
summed, or ranked against each other.

## Ordering, ties, and stability

Every category uses one total order: the compared value in the direction its
descriptor declares, then the captured local date, the start instant, the
exercise position, the set position, and the set identifier ascending.

Direction lives on the descriptor beside the dimension because the dimension
cannot decide it — `heaviest-load` and `least-assistance` both order on
resistance and order oppositely — and because the comparison rule must exist
once. Column names, join shapes, index selection, and the tie-break chain stay in
infrastructure, so the table describes what may be claimed rather than how to
fetch it. The field is required, so adding a descriptor without deciding its
direction is a type error rather than a silent descending default.

Equal values therefore report the earliest
completed occurrence — when the record was first achieved — and a later equal
result moves neither the date nor the evidence link. The identifier tie-break
only guarantees a stable answer; it never changes the claim and never reaches
the interface.

Ordering compares exact stored canonical numbers rather than the domain's
epsilon equality, because a total order is what makes the selection
reproducible. Rounding happens only when a value is formatted for display.

Every recorded quantity is strictly positive in the domain and in the schema, so
a zero record cannot exist. Absence is absence. That matters most under an
ascending order, where a corrupt zero would otherwise sort to the top: the reader
rejects it as corruption instead.

Records are stable across relaunch, timezone change, unit-preference change,
Catalog rename, Catalog deletion, Planner edits, export, restore, and
replacement restore. Four deliberate acts move a record, and only those four: a
[correction of a recorded set](completed-workout-correction.md), a
[removal of one completed session exercise](completed-session-exercise-removal.md),
an
[addition of one session exercise to a completed workout](completed-workout-exercise-addition.md),
and a [deletion of a completed workout](completed-workout-deletion.md). In every
case the next read derives the new truth — an overstated or deleted record disappears
and the next eligible result takes its place, an added result establishes or
replaces one, or no record is claimed — with nothing to invalidate. Evidence never points at a workout, exercise, or set that no longer exists.

## Queries and indexes

Two bounded statements per exercise, both fully bound:

1. One compound statement with one `ORDER BY ... LIMIT 1` branch per category,
   generated from the descriptor table in
   `application/exercise-personal-records.ts`. Branch count is fixed by that
   table, never by history size, and a mode the exercise never used contributes
   no row. The comparison rule therefore exists once, in TypeScript, and the SQL
   is derived from it.
2. One statement reporting which logging modes appear in that exercise's
   completed history, for the undescribed-mode explanation and the latest
   captured name.

Only the leading order term differs between branches, and only by the `ASC` or
`DESC` its descriptor declares. That token is a compile-time constant from a
closed union in a frozen table, never a bound value and never anything a person
typed, so every branch stays fully parameterised where it reads data.

`unsupportedLoggingModes` has no member today, because every logging mode is
described. It is retained because `exerciseLoggingModes` lives in
`@fitness/domain` while the descriptor table lives in `workout-history`: a mode
can enter the vocabulary before a descriptor decides what may truthfully be
claimed about it, and until one does the screen explains the mode rather than
dropping it or showing a zero.

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

A category whose achievement is a smaller number carries that in its label rather
than anywhere a person could miss it: "Least recorded assistance in a set" leads
with the direction, so somebody reading only the heading is never told a heavier
number is better, and the spoken name says the same words in the same order.

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
