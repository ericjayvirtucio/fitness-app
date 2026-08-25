# Specification 0024: Deliberate completed workout deletion

> Testing-policy note: automated simulator, sprint-suite, and regression-suite
> requirements in this historical specification were superseded by
> [ADR 0033](../docs/decisions/0033-risk-based-manual-device-testing.md).
> Use command-line Jest/Vitest checks plus risk-based manual device testing.

- Status: Approved
- Date: 2026-08-14

## Objective and scope

Let a person deliberately delete exactly one completed Workout, so a workout
recorded entirely by mistake can be removed without erasing everything else
stored on the device. Version 1 deletes one completed `workout_session` row with
every session exercise and every actual set it owns, child-first, inside one
exclusive transaction, after an explicit destructive confirmation.

Everything derived from history — the history list, per-exercise history,
personal records, progress summaries, the performed-exercise list, and export —
recomputes from the remaining workouts because none of it is persisted.

Removing a single completed session exercise, deleting only planned context,
reverting a completed workout to active, undo, trash, archive, soft deletion,
tombstones, deletion logs, audit history, retention scheduling, bulk or
date-range deletion, deleting an active session through this path, and any
export-format change are excluded.

## The problem

Specification 0023 made a completed workout correctable but deliberately kept at
least one performed set in it, because completion already requires performed
work. A workout that never should have been recorded therefore reduces to one
false set and stays.

Such a workout inflates the completed workout count and elapsed workout time,
inflates performed exercise and actual set counts, contributes repetitions,
duration, distance, and eligible load volume, can hold a personal record, appears
in per-exercise history, ships inside every version-1 export, and survives
restore and replacement. The only remedy the product offers is deleting all local
information, which is not proportionate to one workout started by accident,
recorded twice, or performed by somebody else on a shared device.

## Historical authority

Completed history stays the sole authority for what is displayed, summarized,
ranked, and exported. Authoritative does not mean incapable of deliberate
owner-directed removal.

A **silent deletion** is forbidden. No Exercise Catalog change, Workout Planner
change, Profile change, body-weight change, unit-preference change, migration,
background task, derived reader, retention assumption, failed correction, failed
export, failed restore, or application start may remove a completed workout.

An **explicit deletion** is what this specification adds: a person opens one
completed workout, chooses a control that says what it does, reads what will
disappear, and confirms an irreversible action.

The interface says "Delete this workout" and "Delete workout". It never says
clean up, hide, archive, remove from view, or reset, and it never implies that
the workout can be recovered, because it cannot.

## Deletion authority

Deletion affects exactly one completed `workout_session` row, its
`workout_session_exercise` rows, and its `workout_set` rows.

It does not affect any other completed workout, an active workout, Exercise
Catalog definitions, Workout Planner records, the Profile, Goals, Nutrition,
Hydration, body-weight history, externally saved exports, or the schema and
migration version. Nothing deleted from the Catalog or the Planner is recreated
or modified, because history reads its own captured snapshots.

## No undo, no audit, no tombstone

The workout is removed permanently from current local state. The application
keeps no copy, no deletion record, no reason, and no before-deletion contents,
and nothing in the interface or documentation claims otherwise.

An undo window would have to retain exactly the rows the person asked to remove,
plus an expiry clock, recovery after process death, and defined behavior under
export, restore, replacement, and erasure. A deletion log would create new
sensitive metadata, a migration, and an export decision while restoring nothing.
A tombstone is only meaningful against a peer that must learn about the deletion,
and there is no peer before cloud synchronization is designed.
[ADR 0019](../docs/decisions/0019-deliberate-completed-workout-deletion.md)
records the reasoning.

## Architecture

```text
CompletedWorkoutScreen
  → destructive confirmation
  → DeleteCompletedWorkoutUseCase            (workout-history owns the workflow)
  → WorkoutSessionRepository.deleteCompleted (workout-session owns its aggregate)
  → one exclusive SQLite transaction
  → sets, then session exercises, then the session
  → refreshed Workout History
```

Workout History owns the workflow, its outcomes, its messages, the confirmation,
and the navigation, because the person starts from completed history and every
read model the deletion disturbs belongs to Workout History. Workout Session
keeps ownership of writes to its own aggregate through one explicitly named
repository method. Composition connects them. Presentation issues no SQL and
there is no generic history repository.

`deleteCompleted` is a separate contract from the active-session `discard`.
Reusing `discard` would erase the lifecycle distinction between abandoning an
active workout and deleting history, and because its only guard is the
`status = 'active'` predicate in its own SQL, widening that predicate would make
the active workout screen's discard control capable of deleting completed
records. `deleteCompleted` states its lifecycle policy in its name, confirms the
stored row is completed inside the transaction, and leaves `discard` unchanged
with its single active-session caller.

`@fitness/domain` is unchanged. Deletion removes an aggregate rather than
constructing a new domain value, so there is no invariant for a constructor to
enforce; `WorkoutSessionStatus` already supplies the only distinction the
operation needs, and repository and application lifecycle checks carry the rest.
Adding a mutating method to a deliberately immutable aggregate for this case
would be appearance rather than substance.

## Transaction and verification

Every deletion runs inside one exclusive transaction:

1. Validate the session identifier.
2. Reload the stored session inside the transaction.
3. Refuse if it is missing.
4. Refuse if it is not completed.
5. Refuse if its start or completion instant differs from what the screen loaded.
6. Read and hold the identifiers of the owned session exercises.
7. Delete the actual sets owned by those session exercises.
8. Delete the session exercises.
9. Delete the session row, guarded on its identifier and completed status.
10. Verify the parent row is gone, no session exercise remains for the session,
    and no set remains for any held session exercise identifier.
11. Commit.

Children are deleted before their parents because the transaction connection runs
with foreign keys off and cannot enable them once the transaction has begun, so
the `ON DELETE CASCADE` declared on both child tables would leave orphaned rows
that no read path can see. Every child table is deleted explicitly and every
statement is parameter-bound.

A failure at any step rolls back everything and the complete prior aggregate
survives. Success is reported only when the parent and all owned children are
verified gone.

## Stale state

The completed detail may stay open while other local data changes. The screen
submits the start and completion instants it loaded, and the use case compares
them against the stored row inside the transaction.

An already-deleted, erased, or replaced-away workout is refused as no longer
available, which is a safe and understandable outcome rather than an error. A row
that is unexpectedly active is refused as no longer completed history. Lifecycle
instants that differ from the loaded ones are refused as changed rather than
deleting whatever aggregate now holds that identifier. A second submission finds
nothing to delete, and the control stays disabled while a deletion is in flight.
Nothing is added to the schema to make this possible.

Restoring an older export can reintroduce the same identifier with the same
instants, which the comparison cannot distinguish. That is accepted: it is the
workout the confirmation named.

## Confirmation and experience

The completed detail stays historical. A clearly separated section after the
workout content carries a heading, one short passage — the completed workout and
all of its recorded sets are removed, progress and personal records may change,
nothing else is deleted, and the action cannot be undone — and one full-width
destructive control labelled in words.

Choosing it opens a destructive platform alert naming the workout and its
captured date, restating what disappears, offering a destructive "Delete Workout"
action and a neutral "Cancel". This is the confirmation the repository already
uses for recorded-set and weight check-in deletion. A dedicated confirmation
screen is disproportionate for one aggregate and a typed confirmation phrase adds
keyboard, localization, and cognitive cost without adding deliberation. Deletion
is never a swipe gesture and never an icon alone. The alert names no identifier
and no recorded value.

After a successful deletion the person is returned to Workout History with the
deleted detail replaced rather than pushed over, so Back cannot reopen it. The
history list, summary, and performed exercises reload, an accessible confirmation
is announced, and no other completed workout is opened automatically. When the
deleted workout was the last one, history shows its existing textual empty state.

Because a whole workout can now be deleted, the completed detail no longer
presents the final recorded set as a dead end: it explains that a completed
workout keeps at least one recorded set and points at deleting the workout
instead.

## Errors

The refusals are: the workout is no longer available, it is no longer completed
history, and it changed since the screen opened. One further fixed sentence
covers a deletion that could not be saved. Each message is fixed; none exposes
SQL, a table name, an identifier, an exercise name, a recorded value, a date, an
internal path, or a stack trace. A refusal reloads the detail, because the usual
reason one arrives is that the screen is showing something history no longer
holds. A recoverable failure leaves the loaded detail visible and usable.

## Derived behavior

Nothing derived is persisted, so nothing is invalidated, decremented, or
recomputed in the background.

Workout History drops the workout from its list. Keyset pagination stays stable
because no surviving row is renumbered. Opening the deleted detail directly
reports it as unavailable, and the occurrence leaves per-exercise history.

Personal records recompute on the next read: a record established by the deleted
workout moves to the next eligible result, or no record is claimed. Evidence can
never point at the deleted session because its rows are gone. The
earliest-occurrence tie rule and the unsupported treatment of assistance are
unchanged.

Progress recomputes the completed workout count, elapsed workout duration,
performed exercise count, actual set count, repetitions, duration, distance,
eligible recorded load volume, and the per-day breakdown. An exercise performed
only in the deleted workout leaves the performed-exercise list, and a deleted
current Catalog definition is never recreated.

Export omits the workout from the next version-1 export with no contract change.
Externally saved exports are unchanged, and restoring or replacing with an older
export may truthfully bring the workout back because that file contains it. Local
erasure and safe replacement are unchanged.

## Accessibility

Screens use the design-system public API, native heading roles, Dynamic Type,
minimum touch targets, and vertical layout that does not scroll horizontally. The
destructive control carries an explicit text label and a destructive role where
the platform supports one; no meaning depends on an icon or a color. Cancel is
neutral. The confirmation is understandable without knowing the navigation
context. After deletion, focus lands on valid history content and the
confirmation is announced politely.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, external service, or new
dependency. All SQL is parameter-bound. No exercise name, result, date,
identifier, or deletion is logged, no hidden backup is written, and no deletion
reason is stored. QA uses synthetic data only.

A completed aggregate holds at most one hundred exercises of one hundred sets, so
one deletion is four bounded writes and three verification reads inside a short
transaction, all served by existing indexes. Derived reads stay constant-query.
No index, background worker, or persisted summary is added.

## Migration and dependencies

None. The schema stays at user version 11 and no column, table, trigger, index,
or constraint is added or removed. No dependency changes.

## Verification and completion

Application tests cover a successful deletion, an active session refused, a
missing workout, an already-deleted workout, an invalid identifier, stale
lifecycle instants, duplicate submission, safe error translation, and history
preserved after a failed write.

Persistence tests run on a real SQLite engine and cover child-first deletion
order, absent cascade reliance, deletion confined to the selected aggregate,
other workouts left unchanged, absent orphan rows, bound parameters, rollback
after a forced child failure, rollback after a forced parent failure, the
lifecycle status checked inside the transaction, and an unchanged schema version.

Derived tests cover a workout leaving history, a decreasing completed count,
recomputed progress totals, a record-setting deletion selecting the next eligible
result, no eligible successor producing no record, a disappearing per-exercise
occurrence, an exercise performed only there leaving the list, and an export that
omits the workout.

Presentation tests cover the control appearing only on completed detail, the
confirmation wording, cancellation preserving the workout, success returning to
refreshed history, the empty history state after deleting the last workout,
failure keeping the detail visible, a disabled repeated request, accessible
labels, and Dynamic Type.

Sprint 24 adds a Maestro suite that opens a completed workout, cancels a
deletion, deletes one of two workouts, verifies history, progress, and personal
records, survives a relaunch, and reaches the empty state, and it enters the
stable regression suite. Merge readiness requires:

```bash
./scripts/qa.sh sprint 24 --platform ios
./scripts/qa.sh regression --platform ios
```

Deleting a corrected workout, a record-setting workout, and a workout whose
Catalog definition or Planner source was deleted; export, restore, replacement,
and erasure after deletion; deep links to a deleted workout; stale correction
screens; interrupted transactions; large Dynamic Type; VoiceOver; TalkBack; and
keyboard behavior remain targeted manual QA.

## Explicit exclusions

Removing one completed session exercise; deleting only planned context; reverting
a completed workout to active; undo; trash; archive; soft deletion; tombstones;
deletion logs; audit history; retention scheduling; automatic cleanup; bulk,
multi-select, and date-range deletion; delete-all-workouts; cloud deletion;
synchronization; deleting an active session through this path; deleting a session
as a side effect of set correction; export format version 2; migrations; new
personal record categories; charts; Progress redesign; authentication; backend
endpoints; AI; notifications; and dependency upgrades are excluded.

The repository owner approved the Stage 1 design and authorized staged
implementation on `feat/completed-workout-deletion` on 2026-08-14.
