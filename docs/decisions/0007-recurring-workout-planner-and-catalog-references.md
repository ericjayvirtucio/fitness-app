# ADR 0007: Recurring workout planner and catalog references

- Status: Accepted
- Date: 2026-08-05

## Context

The Exercise Catalog now needs to support a mutable recurring weekly plan. Plans
must remain distinct from future historical Workout Sessions, preserve exercise
order and logging-mode-specific targets, and prevent dangling catalog references
without introducing cloud deletion machinery.

## Decision

Model one recurring Sunday-first week. Missing workout rows represent explicit
Rest states in the application projection. Give workouts and planned exercises
UUID identities and persist one ordered child collection per workout.

Keep planned prescriptions as a closed discriminated domain union mapped to one
strictly constrained child table. Reference current Exercise Definitions from
plans so mutable future intent reflects catalog renames. Restrict deletion and
logging-mode changes while an Exercise Definition is referenced. Future Workout
Sessions must independently snapshot historically stable exercise context.

Replace a workout aggregate atomically through the existing transaction runner.
Use accessible move controls instead of a drag-and-drop dependency. Defer
calendar scheduling, multi-week programs, copy-to-day, Planner recents, sessions,
analytics, and synchronization.

## Consequences

- The weekly read is small, deterministic, and completely offline.
- Rest requires no placeholder database record.
- Catalog renames update current plans without rewriting Planner rows.
- Users must remove plan references before deleting or changing the logging mode
  of an exercise.
- Aggregate replacement performs more writes than targeted child updates but
  makes ordering and rollback behavior simple and reliable at weekly-plan scale.
- Completed sessions cannot use Planner joins as historical truth.

## Alternatives considered

Persisting seven day rows, using weekday as workout identity, snapshotting full
catalog definitions into plans, cascading catalog deletion, invalidating targets
after a mode edit, soft deletion, a generic schedule engine, per-prescription
tables, drag-and-drop, and a global draft store were rejected as unnecessary,
destructive, ambiguous, or disproportionate to the approved workflow.
