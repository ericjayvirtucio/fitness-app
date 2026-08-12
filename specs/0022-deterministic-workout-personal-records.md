# Specification 0022: Deterministic workout personal records

- Status: Approved
- Date: 2026-08-12

## Objective and scope

Show the best recorded result for one performed exercise, derived exclusively from
completed Workout Session actual sets, with every claim linked to the completed
workout that proves it. Records extend the existing per-exercise history screen;
they do not add a route, a table, a cache, or an export field.

Estimated strength, cross-exercise ranking, cross-mode scores, pace, load-volume
records, coaching, charts, and history correction remain excluded.

## Historical authority

Only actual sets belonging to a completed Workout Session establish a record.
Planned prescription snapshots, active sessions, Exercise Catalog rows, Profile
weight, recorded body weight, and derived Progress summaries are never read.
Completed exercise snapshots stay authoritative after the current Catalog
definition is renamed or deleted.

## Record identity and logging modes

A record belongs to the `source_exercise_definition_id` captured in completed
history, partitioned by the captured `logging_mode_snapshot`. An exercise whose
logging mode changed over time therefore reports one record group per mode, and
unlike modes are never compared.

Two logging modes share one category only when they produce the identical domain
result variant and neither records a load value. That permits exactly one merge,
`repetitions` with `bodyweight-and-repetitions`, and forbids every other.

## Record categories

| Category                              | Eligible logging modes                      | Compared value        |
| ------------------------------------- | ------------------------------------------- | --------------------- |
| Most recorded repetitions in a set    | `repetitions`, `bodyweight-and-repetitions` | repetitions           |
| Heaviest recorded load in a set       | `external-load-and-repetitions`             | canonical grams       |
| Heaviest recorded added load in a set | `bodyweight-plus-load-and-repetitions`      | canonical grams       |
| Longest recorded duration in a set    | `duration`                                  | canonical seconds     |
| Longest recorded distance in a set    | `distance`                                  | canonical millimetres |
| Longest recorded distance in a set    | `distance-and-duration`                     | canonical millimetres |
| Longest recorded duration in a set    | `distance-and-duration`                     | canonical seconds     |

Every category orders descending on one canonical dimension. Body mass is never
inferred or added. Load and added load are never merged, summed, or ranked
against each other.

`assistance-and-repetitions` has no category. Less assistance and more
repetitions do not order together, so the screen states that reason instead of
presenting a value. An unsupported mode never appears as a zero-valued record.

Excluded and their reasons: repetitions under load reward the lightest warm-up
set; single-set load volume is deterministic but is not a performance ordering;
pace is deterministic yet misleading across unconstrained distances and needs
distance bands; estimated one-repetition maximum is not a recorded fact.

## Ties and determinism

Each category resolves through one total order: value descending, then captured
local date, start instant, exercise position, set position, and set identifier
ascending. Equal values therefore report the earliest completed occurrence, and a
later equal performance moves neither the date nor the evidence link.

Ordering compares exact stored canonical numbers rather than the domain epsilon
equality used for value-object comparison, because a total order is what makes
the selection reproducible. Rounding happens only when formatting for display.

Records stay stable across relaunch, timezone change, unit-preference change,
Catalog rename, Catalog deletion, Planner edits, export, restore, and
replacement restore.

## Evidence

Every record carries the completed session identifier, the session name
snapshot, the captured local calendar date, the exercise name snapshot from that
occurrence, and the set position. The user can open the completed workout that
proves the claim. Derivation creates no historical row, and no identifier reaches
the interface, an error, or a log.

## Read side and queries

A capability-owned `WorkoutPersonalRecordsReader` inside `workout-history`
returns one immutable read model per exercise. One compound statement selects one
row per category through `ORDER BY ... LIMIT 1` branches generated from a single
descriptor table, so no comparison rule is written twice. A second statement
reports which logging modes exist in that exercise's completed history.

Query count is constant and independent of history size. Access is bounded by the
`workout_session_exercise_source_history` and `workout_set_order` indexes added by
migrations 9 and 10. No migration, index, schema change, persisted record,
trigger, or background recomputation is introduced, and lifetime history never
enters application memory.

## Historical exercise discovery

The Workout History exercise list derives from completed snapshots rather than
resolving identifiers through the mutable Exercise Catalog, so a deleted
definition keeps its captured name and its records stay reachable. No deleted
Catalog state is rebuilt. The Workout Session exercise picker keeps its existing
Catalog-resolved recents.

Navigation labels and headings use the latest completed snapshot name. A record
card shows the snapshot name captured at that occurrence when it differs.

## Experience and accessibility

The per-exercise history screen gains a personal-records section above its
performed-session list. Each record states its category, its value in the
preferred units, when it was first recorded, the completed workout, and the set,
and opens that workout. States exist for no completed history, no eligible
result, an unsupported mode, loading, and failure with retry. A records failure
keeps already loaded performed history visible.

Screens use the design-system public API, Dynamic Type, native headings, minimum
touch targets, fully spoken units in accessible labels, and textual meaning only.
Nothing depends on color, an icon, a badge, or a chart. Wording describes
recorded application data and never physiological truth, strength, or advice.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, external service, or new
dependency. SQL is bound, stored values are revalidated before use, corrupt rows
fail safely, and diagnostics expose no name, value, date, identifier, or record.

## Verification and completion

Unit tests cover category descriptors, mode eligibility, units, labels, and
formatting. Persistence tests run on a real SQLite engine and cover completed-only
filtering, excluded planned targets and active sessions, per-set maxima, identity
grouping, mode partitioning, renamed and deleted definitions, ties, evidence
selection, unsupported modes, large history, the query plan, and corrupt rows.
Presentation tests cover loading, empty, unsupported, records, failure and retry,
accessible labels, units, stale responses, and evidence navigation.

Sprint 22 adds a Maestro suite that records a first personal record, improves it,
fails to improve it, survives relaunch, and opens the proving workout, and it
enters the stable regression suite. Merge readiness requires:

```bash
./scripts/qa.sh sprint 22 --platform ios
./scripts/qa.sh regression --platform ios
```

Unit-preference display, VoiceOver, TalkBack, Dynamic Type, timezone change,
logging-mode change, Catalog rename and deletion, and large-history
responsiveness remain targeted manual QA.

## Explicit exclusions

Estimated one-repetition maximum, strength scoring, cross-exercise ranking,
cross-mode scores, pace, load-volume records, repetitions under load, assistance
records, medical interpretation, coaching, progression advice, achievements,
gamification, streaks, adherence, calorie estimates, charts, Progress changes,
completed-history correction, persisted record tables, export-format changes,
social behavior, synchronization, authentication, backend endpoints, AI,
notifications, and dependency upgrades are excluded.

The repository owner approved the Stage 1 design and authorized staged
implementation on `feat/workout-personal-records` on 2026-08-12.
