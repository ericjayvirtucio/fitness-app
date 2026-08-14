# Completed workout deletion architecture

## Boundary and ownership

Deletion is a write path that starts in completed history and ends inside the
Workout Session aggregate:

```text
CompletedWorkoutScreen
  → destructive confirmation
  → DeleteCompletedWorkoutUseCase             (workout-history)
  → WorkoutSessionRepository.deleteCompleted  (workout-session)
  → one exclusive SQLite transaction
  → sets, then session exercises, then the session
  → derived readers recompute at their next read
```

`workout-history` owns the workflow, its outcome model, its messages, the
confirmation, and the navigation. A person starts from completed history, and
every read model a deletion disturbs — history list, completed detail,
per-exercise history, personal records, progress, performed exercises, export —
belongs to that capability.

`workout-session` owns writes to its own aggregate. It exposes exactly one new
method for this, and Workout History depends on that contract rather than on SQL.
Composition connects the two. There is no generic history repository and
presentation issues no SQL.

## What a deletion removes

Exactly one completed `workout_session` row, the `workout_session_exercise` rows
that reference it, and the `workout_set` rows those exercises own.

Untouched: every other completed workout, the active workout, Exercise Catalog
definitions, Workout Planner records, the Profile, Goals, Nutrition, Hydration,
body-weight history, externally saved export files, and the schema and migration
version. History reads its own captured snapshots, so nothing deleted from the
Catalog or the Planner is recreated or modified.

## Why the domain is unchanged

Correction had to construct a corrected aggregate, so the constructors could
enforce its rules. Deletion constructs nothing — it removes an aggregate — so
there is no value for a constructor to validate and no invariant a domain method
could hold that the lifecycle checks do not.

`WorkoutSessionStatus` already supplies the only distinction the operation needs:
active sessions are abandoned through `discard`, completed sessions are deleted
through `deleteCompleted`. The status is checked in the application use case and
again in the repository, both inside the transaction. `WorkoutSession` keeps its
deliberate absence of mutators.

## Why `deleteCompleted` is separate from `discard`

`discard` removes an active session. Its only lifecycle guard is the
`status = 'active'` predicate in its own `SELECT`, so widening that predicate
would not merely rename a concept: it would make the active workout screen's
discard control capable of removing completed history, because that screen calls
the same use case with whatever identifier it holds.

`deleteCompleted` therefore states its lifecycle policy in its name, confirms the
stored row is completed with the start and completion instants the caller loaded,
and refuses anything else. `discard` keeps its guard and its single
active-session caller, and completed history is unreachable from active-workout
screens.

The two operations share mechanics rather than policy: both delete children
through the same private child-first helper.

## Transaction shape

One exclusive transaction per deletion:

1. Validate the session identifier.
2. Reload the session inside the transaction.
3. Refuse if it is missing.
4. Refuse if it is not completed.
5. Refuse if its start or completion instant differs from the loaded one.
6. Hold the identifiers of the owned session exercises.
7. Delete the `workout_set` rows owned by those exercises.
8. Delete the `workout_session_exercise` rows for the session.
9. Delete the `workout_session` row, guarded on identifier and completed status.
10. Verify no parent row, no session exercise, and no owned set remains.
11. Commit.

Children are deleted before their parents. The transaction connection runs with
foreign keys off and cannot enable them once the transaction has begun, so the
`ON DELETE CASCADE` declared on `workout_session_exercise` and `workout_set`
would leave orphaned rows that no read path can see. Every child table is deleted
explicitly.

The exercise identifiers are captured before step 7 so the orphan check in step
10 is exact: once the parent is gone, an orphaned set can no longer be found by
joining back to the session.

Either the whole deletion commits or the complete prior aggregate survives
untouched. Success is reported only after verification passes.

## Stale state without new schema

The completed detail submits the start and completion instants it loaded. The use
case compares them against the stored row inside the transaction, so a screen
left open through another deletion, a restore, or a replacement cannot delete
whatever aggregate now holds that identifier. This needs no timestamp, revision
column, or version counter.

The refusals are: the workout is no longer available, it is no longer completed
history, and it changed since the screen opened. One further fixed sentence
covers a deletion that could not be saved. Every message is fixed and safe. A
refusal reloads the detail, because the usual reason one arrives is that the
screen is showing something history no longer holds.

An already-missing workout is a refusal, not an error: the person wanted it gone
and it is gone. A restored older export can reintroduce the same identifier with
the same instants, which the comparison cannot distinguish; that is accepted,
because it is the workout the confirmation named.

## Derived behavior

Nothing derived is persisted, so there is nothing to invalidate and no value is
decremented by hand.

The history list drops the workout. Keyset pagination stays stable because the
cursor is a captured date, a start instant, and an identifier, and no surviving
row is renumbered. Opening the deleted detail directly reports it as unavailable.

Personal records recompute on the next read: a record established by the deleted
workout moves to the next eligible result, or no record is claimed. Evidence
cannot point at the deleted session because its rows are gone. The
earliest-occurrence tie rule and the unsupported treatment of assistance are
unchanged.

Progress recomputes the completed workout count, elapsed workout duration,
performed exercise count, actual set count, repetitions, duration, distance,
eligible recorded load volume, and the per-day breakdown. Unlike a correction,
the completed workout count and elapsed time do change, because the parent row is
gone.

An exercise performed only in the deleted workout leaves the performed-exercise
list and per-exercise history. A deleted current Catalog definition is never
recreated.

Export omits the workout from the next version-1 export with no contract change.
Externally saved exports are unchanged, and restoring or replacing with an older
export may truthfully bring the workout back. Erasure and safe replacement are
unchanged.

## Experience and accessibility

The completed detail stays historical. A separate section after the workout
content carries a heading, one short passage stating that the workout and all of
its recorded sets are removed, that progress and personal records may change,
that nothing else is deleted, and that the action cannot be undone, and one
full-width destructive control labelled in words.

The confirmation is a destructive platform alert naming the workout and its
captured date, with a destructive "Delete Workout" action and a neutral "Cancel".
Deletion is never a swipe gesture and never an icon alone, and the alert carries
no identifier and no recorded value.

Success replaces the detail route with Workout History rather than pushing over
it, so Back cannot reopen a deleted workout. History reloads on focus and
announces the deletion politely, focus lands on valid history content, and the
existing textual empty state appears when the deleted workout was the last one.

Because a whole workout can now be deleted, the final-recorded-set explanation
points at deleting the workout instead of ending the conversation.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, external service, or new
dependency. All SQL is parameter-bound. No exercise name, result, date,
identifier, or deletion is logged, no hidden backup is written, and no deletion
reason is stored.

A completed aggregate holds at most one hundred exercises of one hundred sets, so
one deletion is four bounded writes and three verification reads inside a short
transaction, served by `workout_session_exercise_order` and `workout_set_order`.
Derived reads stay constant-query. No index, migration, background worker, or
persisted summary was added, and the schema stays at user version 11.

There is no undo, no trash, no audit trail, and no tombstone. The workout is gone
and the application never claims otherwise.
[ADR 0019](../decisions/0019-deliberate-completed-workout-deletion.md) records
why.
