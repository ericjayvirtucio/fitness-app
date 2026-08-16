# ADR 0019: Allow deliberate deletion of one completed workout

**Status:** Accepted

## Context

[ADR 0008](0008-historical-workout-session-snapshots.md) made a completed Workout
Session immutable history. [ADR 0010](0010-derived-workout-history-progress.md)
built the read-only `workout-history` capability on top of that immutability and
derived every summary at read time.
[ADR 0017](0017-deterministic-workout-personal-records.md) derived personal
records the same way. [ADR 0018](0018-explicit-completed-workout-correction.md)
then split a forbidden silent rewrite from an allowed explicit correction and
made recorded set results correctable, while closing with the note that
"completed workout deletion remain[s] unbuilt and unprejudiced".

That is the situation this decision resolves. Correction cannot empty a completed
workout, because completion already requires performed work and
`WorkoutSession.create` enforces it. A workout that never should have been
recorded — started and finished by accident, recorded twice, or performed by
somebody else on a shared device — therefore reduces to exactly one false set and
becomes permanent. It keeps inflating the completed workout count and elapsed
time, keeps contributing sets, repetitions, duration, distance, and load volume,
can hold a personal record, appears in per-exercise history, ships in every
version-1 export, and survives restore and replacement. The only remedy is
deleting all local information, which is the same disproportionate remedy ADR
0018 rejected for a mistyped set.

Three properties of the merged repository shape the decision. Deleting a session
aggregate is already implemented for active sessions as
`WorkoutSessionSqliteRepository.discard`, whose only lifecycle guard is the
`status = 'active'` predicate in its own SQL. Child rows must be deleted
explicitly, because the exclusive transaction runs on a connection with
`PRAGMA foreign_keys` off and the `ON DELETE CASCADE` declared on both child
tables is inert there. And nothing derived from history is persisted, so a
deleted workout needs no cache invalidation, recomputation, or migration.

## Decision

Completed workout history remains authoritative, but authoritative does not mean
incapable of deliberate owner-directed removal. The product distinguishes a
silent deletion, which stays forbidden, from an explicit deletion of exactly one
completed workout, which is now allowed.

A silent deletion is any removal of completed history caused by something other
than a deliberate act on that specific workout: a Catalog or Planner edit, a
Profile or body-weight change, a unit-preference change, a migration, a
background task, a derived reader, a retention rule, a failed correction, export,
or restore, or application startup. None of these may remove a completed workout,
and none is introduced here.

An explicit deletion is a person opening one completed workout, choosing a
control that says what it does, reading what will disappear, and confirming an
irreversible action. It removes exactly one `workout_session` row with the
`workout_session_exercise` and `workout_set` rows it owns, and nothing else.

**Delete permanently, with no undo, audit, or tombstone.** The workout is removed
from current local state and the application keeps no copy, no deletion record,
and no reason. An undo window would retain exactly the rows the person asked to
remove and would need an expiry clock, recovery after process death, and defined
behavior under export, restore, replacement, and erasure. A deletion log would
create new sensitive metadata, a migration, and an export decision while
restoring nothing. A tombstone is only meaningful against a peer that must learn
about the deletion, and there is no peer before cloud synchronization is
designed.

**Leave `@fitness/domain` unchanged.** Deletion removes an aggregate rather than
constructing a new domain value, so there is no invariant for a constructor to
enforce. `WorkoutSessionStatus` already supplies the only distinction the
operation needs. Adding a mutating method to a deliberately immutable aggregate
would be appearance rather than substance.

**Add `deleteCompleted` rather than widening `discard`.** `workout-history` owns
the workflow, its outcomes, its confirmation, and its navigation, because the
person starts from completed history and every read model the deletion disturbs
belongs there. `workout-session` keeps ownership of writes to its own aggregate
through one new repository method that confirms the stored row is completed with
the start and completion instants the screen loaded, deletes children before
parents, and verifies that no owned row survives before the transaction commits.
`discard` keeps its active-only guard and its single active-session caller.

**Change nothing else.** No migration, index, trigger, column, table, tombstone,
or dependency. Export format version 1 is unchanged, because an omitted workout
changes no field.

## Consequences

- A workout recorded entirely by mistake can be removed, and the disproportionate
  "delete everything" remedy stops being the only path for it.
- The workout is gone. The application cannot restore it, cannot show that it
  existed, and must never imply that it can.
- Personal records, Progress, per-exercise history, the history list, the
  performed-exercise list, and export all recompute from the remaining workouts
  with nothing to invalidate, precisely because ADR 0010 and ADR 0017 persisted
  nothing.
- This amends the durability consequence of ADR 0008, ADR 0010, and ADR 0018 in
  one narrow place: one completed workout may be removed by explicit user action.
  Every other reason a completed workout might disappear remains forbidden.
- Restoring or replacing with an older export can truthfully bring the workout
  back, because that file is a record of a past moment. Documentation says so
  rather than implying that deletion reaches saved files.
- The completed detail screen now carries a second destructive control. Placing
  it in its own section after the workout content, with wording that names the
  whole workout, keeps it distinct from correcting one recorded set.
- Sprint 23's explanation that the final recorded set cannot be deleted stops
  being a dead end and now points at deleting the workout instead.
- `DiscardWorkoutSessionUseCase` ran its statements outside any transaction,
  which this decision deliberately did not change. Completed deletion did not
  inherit that shape: it runs inside `runExclusive` like every other write to
  authoritative history. **Settled.** The separate change this consequence
  anticipated was made in
  [Specification 0028](../../specs/0028-atomic-active-workout-lifecycle.md):
  discard now runs inside one exclusive transaction through the narrow
  `WorkoutSessionTransactionContext`, and it asserts `status = 'active'` on the
  statement that deletes the session as well as on the lookup, so the "widening
  `discard`" hazard this decision reasoned about no longer depends on a predicate
  three statements away from the write. Nothing about the decision itself
  changes: `discard` and `deleteCompleted` remain separate, and completed history
  remains unreachable from the active workout screen.

## Alternatives considered

- **Keep completed history undeletable and rely on erasure.** Rejected for the
  same reason ADR 0018 rejected it for a mistyped set: erasing nutrition,
  hydration, workouts, and measurements to remove one false workout is not a
  remedy, and it teaches people that wrong data is permanent.
- **Widen `discard` to accept any status.** Rejected. It erases the lifecycle
  distinction between abandoning an active workout and deleting history; because
  the guard lives only in that method's SQL, widening it would make the active
  workout screen's discard control capable of deleting completed records; it ran
  outside a transaction at the time of this decision; and the name states no
  lifecycle policy. Specification 0028 settled the transaction point without
  disturbing any of the others.
- **A generic `deleteById` on the session repository.** Rejected. A delete
  contract with no lifecycle policy is one call site away from removing an active
  workout, and the policy would then live in whichever caller remembered it.
- **Soft deletion behind a flag.** Rejected. Every read path would need a filter
  that a future reader can forget, export would need a decision about hidden
  rows, and the workout would still be on the device — which fails the shared
  device case outright.
- **Delete from the history list by swipe.** Rejected. It invites accidental
  destruction of authoritative history and offers no room to state what
  disappears.
- **A dedicated confirmation screen or a typed confirmation phrase.** Rejected.
  One workout is far narrower than the whole-installation deletion that earns a
  dedicated screen, and a typed phrase adds keyboard, localization, and cognitive
  cost without adding deliberation. The destructive alert already used for
  recorded-set and weight check-in deletion is proportionate.
- **Extend deletion to a single completed session exercise.** Rejected for this
  decision. It raises separate questions about surviving planned context, exercise
  renumbering, and emptying a workout, and none of them is needed to remove a
  workout that should not exist.
- **Store a deletion audit row, an undo window, or a tombstone.** Rejected as
  described in the decision.
