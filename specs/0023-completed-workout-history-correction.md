# Specification 0023: Completed workout history correction

- Status: Approved
- Date: 2026-08-13

## Objective and scope

Let a person deliberately correct an actual set recorded inside a completed
Workout, so a single input mistake stops being permanent. Version 1 covers three
operations inside an existing completed session exercise: edit a recorded set,
add a missing set, and delete an erroneous set. The completed workout keeps its
identity, its lifecycle instants, and every captured snapshot.

Everything derived from history — personal records, progress summaries,
per-exercise history, the history list, and export — recomputes from the
corrected facts because none of it is persisted.

Correcting the workout name, its start or completion instant, its captured local
date or offset, the captured exercise name, the captured logging mode, the
planned prescription snapshot, or any source identifier is excluded, as are
adding or removing a session exercise, deleting or reopening a completed
workout, merging or splitting workouts, and any audit, revision, or tombstone
model.

## The problem

Someone means to record 60 kg for 8 repetitions and records 600 kg. The workout
is finished. The false value appears in completed history, inflates recorded load
volume in Progress, becomes a heaviest-load personal record, ships inside a
version-1 export, and survives restore and replacement. The only way to remove it
today is deleting every piece of local information, which is not a proportionate
remedy for a typing mistake.

## Historical authority

Completed history stays the sole authority for what is displayed, summarized,
ranked, and exported. Correction does not change that; it changes a recorded
fact, once, because the person says the original entry was wrong.

The product distinguishes two things that must never be confused.

A **silent rewrite** is forbidden. No Exercise Catalog edit, Planner edit,
Profile change, migration, background task, derived reader, or current unit
preference may alter a completed workout.

An **explicit correction** is what this specification adds. The person opens a
completed workout, chooses one recorded set, changes or deletes it, confirms when
the action destroys information, and saves through a use case that exists for no
other purpose.

Correction never rejoins the current Exercise Catalog, the current Workout
Planner, the Profile, or the recorded body weight. Every label, unit, and
validation rule comes from the snapshots the completed workout already carries,
so a workout whose exercise definition or planned workout was deleted is still
fully correctable.

The interface says "Correct recorded set", "Edit recorded result", "Add missing
set", and "Delete recorded set". It never says improve, personal best, upgrade,
or rewrite, because correction fixes what was recorded and is not a way to claim
a better performance.

## What may change and what may not

Only the actual set results of an existing completed session exercise may change.

These remain exactly as captured: session identifier, session name, start
instant, completion instant, captured local calendar date, captured UTC offset,
session exercise identifier, captured exercise name, captured logging mode,
planned prescription snapshot, source exercise definition identifier, source
planned exercise identifier, source planned workout identifier, and source
weekday. Exercises are never added to or removed from a completed workout.

## No audit trail

Correction overwrites the recorded value. The previous value is not retained, and
the application cannot show what changed or when. Nothing in the interface,
documentation, or stored data claims otherwise.

That is deliberate. Nutrition entries, hydration entries, and body weight
check-ins already correct in place with no audit row, so this is the behavior the
product already has. Storing a corrected timestamp or revision counter would need
a migration and an export-format decision while still not preserving the original
value, and a full revision log would drag in retention, export, restore,
erasure, and synchronization policies that belong to their own review.
[ADR 0018](../docs/decisions/0018-explicit-completed-workout-correction.md)
records the reasoning.

## Correction rules

**Edit** keeps the set identifier and its position and replaces only the result.

**Add** appends one set with a newly generated identifier at the next position
inside an existing completed session exercise. An exercise already holding one
hundred sets rejects the addition.

**Delete** removes one set and renumbers the survivors to contiguous positions
while preserving their identifiers.

A correction may leave a session exercise with no sets, which then reads as
planned but unperformed context. It may not leave the completed workout with no
actual sets at all, because completion already requires performed work; that
attempt is refused with a plain sentence and nothing is written. No session
exercise and no completed workout is ever deleted as a side effect.

Display order always comes from the stored set position, never from database row
order. Identifiers never appear in the interface, an error, or a log.

## Logging-mode validation

A corrected result is built by the same domain constructor active set logging
uses, from the captured logging mode. Repetitions are positive integers.
Resistance, added load, and assistance are positive canonical masses; assistance
is never reinterpreted as ordinary resistance and body mass is never inferred or
added. Duration is a positive canonical duration, distance a positive canonical
length, and distance-and-duration requires both. The captured logging mode itself
cannot change, and a result of the wrong shape for it is rejected by the domain
before anything is written.

Values are entered and displayed in the current unit preference and stored in
canonical units. That is presentation only and is not a rejoin of current
settings into history.

## Architecture

```text
CompletedWorkoutScreen
  → CompletedWorkoutSetCorrectionScreen
  → CorrectCompletedWorkoutSetUseCase        (workout-history owns the workflow)
  → WorkoutSessionRepository.correctCompleted (workout-session owns its aggregate)
  → one exclusive SQLite transaction
  → completed session aggregate reconstruction
  → derived readers recompute
```

Workout History owns the correction workflow, its outcomes, and its screens,
because the person starts from completed history and every read model the
correction disturbs belongs to Workout History. Workout Session keeps ownership
of writes to its own aggregate through one explicitly named repository method.
Composition connects them. Presentation issues no SQL and there is no generic
history repository.

The `WorkoutSession` aggregate is unchanged. It already expresses a corrected
completed session through the reconstruction its other mutations use, and it
already enforces every rule correction needs: the status and completion instant
are carried through untouched, a completed session must retain at least one
actual set, set positions must be contiguous and identifiers unique, and each
result must match the captured logging mode. Adding a mutating method for this
one case would weaken a deliberately immutable aggregate to restate rules it
already holds.

`correctCompleted` is a separate contract from the active-session `replace`. It
verifies that the stored row is still completed with the same start and
completion instants and then rewrites only the child rows, so no correction path
can touch a parent lifecycle column. Specification 0025 reuses that same
guarantee for completed session exercise removal, so the contract now has two
callers; which children the rebuilt aggregate holds stays application policy in
each use case. The active-only lifecycle guard on ordinary
session mutation is untouched, and ordinary active-workout screens cannot reach
completed records.

## Transaction and stale state

Every correction runs inside one exclusive transaction that reloads the session
before deciding anything. Children are deleted before their parents and inserted
parents-first, because the transaction connection runs with foreign keys off and
cascade deletes would otherwise orphan rows no read path can see. Either the
whole correction commits or the previous completed history survives intact.

The screen submits the canonical values it loaded for the target set. If the
stored set no longer matches them, the correction is refused as changed rather
than silently overwriting a newer fact. Nothing is added to the schema to make
that possible.

The refusals are: the workout no longer exists, it is no longer completed, the
exercise is gone, the set is gone, the set changed, the correction would empty
the workout, the exercise already holds the maximum number of sets, the entered
values are invalid, and the correction could not be saved. Each message is fixed
and safe; none exposes SQL, a path, an identifier, an exercise name, a recorded
value, a date, or a stack trace. A recoverable failure keeps the entered values
and the loaded completed detail on screen.

## Derived behavior

Personal records hold no cache, so the next read derives the new truth: an
overstated record disappears, the next eligible result takes its place or no
record is claimed, an improved corrected value becomes the record, and the
Sprint 22 earliest-occurrence tie rule is unchanged. Assistance remains
unsupported. Evidence continues to point at the corrected workout and set. The
correction screen performs no record comparison and shows no record messaging.

Progress recomputes actual set counts, repetitions, duration, distance, eligible
recorded load volume, performed exercise counts, and the per-day breakdown. The
completed workout count and elapsed workout time do not change, because only
children were corrected. Deleting every set of one exercise truthfully removes
that exercise from performed counts and from the performed-exercise list. No
progress summary is persisted and no progress formula changes.

Export carries the corrected current history in format version 1 with no contract
change, because the exported set already consists of an identifier, a position,
and a result. The removed or prior value simply is not present. Restore parses a
corrected export unchanged, replacement restores it atomically, and erasure
removes corrected history like any other.

## Experience and accessibility

Each recorded set on the completed workout screen offers "Correct recorded set"
and "Delete recorded set", and each exercise offers "Add missing set". Editing
and adding open a dedicated correction screen, so the completed detail stays
visibly historical and never resembles an active workout: it has no finish,
discard, add-exercise, or remove-exercise control.

The correction screen separates three things — the planned target as captured,
the result as currently recorded, and the editable fields — and states in one
short passage that correction changes what was recorded, that records and
progress may change, that the workout stays completed, and that the captured
exercise and plan context are unchanged. Saving is explicit. Deleting is
confirmed. Deletion that would empty the workout is refused in words rather than
by a control that quietly does nothing.

Screens use the design-system public API, native heading roles, Dynamic Type,
minimum touch targets, and vertical layout that does not scroll horizontally or
depend on a table. Controls carry full accessible labels naming the set and the
captured exercise; no meaning depends on an icon or a color. Units are spoken as
words. Validation errors are associated with their field and announced. Returning
from a correction shows refreshed detail.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, external service, or new
dependency. All SQL is parameter-bound. No exercise name, result, date,
identifier, or correction is logged, and no before-and-after value is recorded
anywhere. No medical or coaching interpretation is offered. QA uses synthetic data
only.

A completed aggregate holds at most one hundred exercises of one hundred sets, so
one correction is a bounded child rewrite inside a short transaction. Derived
reads stay constant-query. No index, background worker, or persisted summary is
added.

## Migration and dependencies

None. The schema stays at user version 11 and no column, table, trigger, or
constraint is added. No dependency changes.

## Verification and completion

Domain tests cover corrected completed reconstruction, unchanged lifecycle and
snapshot fields, rejected incompatible results, preserved identity and position
on edit, deterministic position on add, renumbering on delete, the refusal to
empty a completed workout, the set-count limit, and immutability of the source
aggregate.

Application tests cover success for all three operations, a missing workout, a
workout that is not completed, a missing exercise, a missing set, a changed set,
invalid input, duplicate submission, injected identifier generation, preserved
history after failure, and safe error translation.

Persistence tests run on a real SQLite engine and cover bound parameters,
child-first replacement, absent orphans, preserved set identifiers, deterministic
positions, rollback under a forced failure, unchanged parent columns, unchanged
snapshots, an unchanged schema version, and reconstruction after correction.

Derived tests cover a disappearing overstated record, the next eligible result
becoming the record, a corrected result becoming the record, a deleted
record-setting set, stable ties, corrected progress totals, an unchanged
completed workout count, and corrected export contents.

Presentation tests cover the entry points, the mode-specific form, the displayed
recorded value, validation, save and cancel, delete confirmation, blocked final
set deletion, failure and retry, accessible labels, and refreshed detail.

Sprint 23 adds a Maestro suite that corrects an overstated set, verifies the
corrected detail, verifies the false record changes, adds a missing set, deletes
an erroneous set, refuses to delete the final performed set, survives relaunch,
and opens the record evidence, and it enters the stable regression suite. Merge
readiness requires:

```bash
./scripts/qa.sh sprint 23 --platform ios
./scripts/qa.sh regression --platform ios
```

Every logging mode, both unit systems, deleted Catalog and Planner context,
export and restore after correction, replacement, erasure, stale screens,
interrupted transactions, large Dynamic Type, VoiceOver, TalkBack, and keyboard
behavior remain targeted manual QA.

## Explicit exclusions

Editing the workout name, start instant, completion instant, captured local date,
captured UTC offset, captured exercise name, captured logging mode, planned
prescription snapshot, or any source identifier; adding an exercise to history;
removing a session exercise; deleting a completed workout; reverting a completed
workout to active; merging or splitting workouts; audit trails, correction
reasons, revision history, and tombstones; export format version 2; migrations;
new personal record categories; charts; Progress redesign; synchronization;
authentication; backend endpoints; AI; notifications; and dependency upgrades are
excluded.

The repository owner approved the Stage 1 design and authorized staged
implementation on `feat/completed-workout-correction` on 2026-08-13.
