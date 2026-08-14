# ADR 0021: Allow explicit addition of one session exercise to a completed workout

**Status:** Accepted

## Context

[ADR 0008](0008-historical-workout-session-snapshots.md) made a completed Workout
Session immutable history and required each session exercise to snapshot its
name, logging mode, and planned prescription "when they enter the session",
keeping session rows free of foreign keys to the Catalog or the Planner.
[ADR 0010](0010-derived-workout-history-progress.md) and
[ADR 0017](0017-deterministic-workout-personal-records.md) derived every summary
and every personal record from that history at read time and persisted nothing.
[ADR 0018](0018-explicit-completed-workout-correction.md) split a forbidden
silent rewrite from an allowed explicit correction and stated that "exercises are
neither added nor removed".
[ADR 0019](0019-deliberate-completed-workout-deletion.md) made one whole
completed workout deletable.
[ADR 0020](0020-completed-session-exercise-removal.md) made one completed session
exercise removable, amended ADR 0018's sentence for removal, and left adding an
exercise to completed history explicitly "unbuilt and unprejudiced".

That is what this decision resolves. Every corrective act the product offers
subtracts: a correction can lower a number or delete a set, a removal drops an
exercise, a deletion drops a workout. The single additive act — adding a missing
set — can only reach an exercise the session already holds.

A person who finished a workout before logging an exercise therefore has no
remedy inside that workout. The available workaround is to record a second
workout for work that belongs to the first, and the product cannot detect that
afterwards. It inflates the completed workout count and elapsed workout time,
splits one session's evidence across two occurrences, and corrupts exactly the
derived claims ADR 0017 through ADR 0020 worked to keep honest. The asymmetry
also leaves the correction lifecycle incomplete, which is a poor foundation for
further derived features.

Three properties of the merged repository shape the decision. The aggregate
constructors already enforce contiguous exercise positions, unique identifiers,
the hundred-exercise limit, snapshot validity, and result compatibility with the
captured logging mode, so an addition expressed as reconstruction is validated
rather than trusted. `WorkoutSessionRepository.correctCompleted` already rewrites
the complete child set of a completed workout, child-first, under a verified
unchanged parent lifecycle, because the exclusive transaction runs with foreign
keys off and the declared `ON DELETE CASCADE` is inert there. And nothing derived
from history is persisted, so an added exercise needs no cache invalidation,
recomputation, or migration.

## Decision

Completed workout history remains authoritative. The product already
distinguishes a forbidden silent change from an allowed explicit one; this
decision adds a fourth explicit act to the three that exist, and the first that
adds rather than subtracts.

A **silent addition** is any addition of a session exercise caused by something
other than a deliberate act on that specific workout: a Catalog or Planner edit,
a Profile or unit-preference change, a migration, a background task, a derived
reader, a failed correction, removal, deletion, export, restore, or replacement,
or application startup. None of these may add a session exercise, and none is
introduced here.

An **explicit addition** is a person opening one completed workout, choosing "Add
Exercise To This Workout", selecting a definition from the Exercise Catalog,
recording what they performed, reading what will change, and saving. It appends
exactly one `workout_session_exercise` row holding exactly one `workout_set` row,
and changes nothing else.

**Capture a fresh snapshot, and say what that means.** ADR 0008 forbids history
from joining mutable source rows to interpret work it already recorded. Reading
the Catalog to mint a **new** snapshot for an exercise entering the session now
is a different act, and it is the act ADR 0008 mandates: snapshot when it enters
the session. No existing snapshot is re-read, re-derived, or revalidated, and no
session row gains a foreign key. This is what
`WorkoutSessionMutationUseCases.addExercise` already does on an active session;
only the parent's status differs.

The honest consequence is recorded rather than hidden: the captured name is the
definition's name today, while the work happened earlier. If the definition was
renamed after the workout was completed, the added exercise carries today's name,
because that is the name the person selected and confirmed, and the product must
not claim to know what it was called then. Later renaming or deletion of the
definition never touches the captured snapshot, exactly as for every other
session exercise. A definition deleted while the screen is open refuses the
addition rather than inventing a name.

**Require the first recorded set in the same action.** A completed workout never
gains an exercise that recorded nothing. That state was reachable and
unresolvable before ADR 0020, and re-manufacturing it through the one act meant
to make history more truthful would be a regression: it occupies a position,
contributes to no performed count, ships inside every version-1 export, and
asserts work the person never described. The requirement is structural — the
result is a required input and the exercise is only ever constructed holding one
set — rather than a validation that some later caller could skip.

**Append, because chronological insertion is underivable.** A `WorkoutSet`
carries no timestamp, so no stored fact orders one set against another inside a
workout. Appending also leaves every existing identifier, position, and snapshot
untouched, which is strictly less disturbance than a removal performs. Stored
order is therefore a stored order and not a chronological claim; it never was one,
since a planned workout's order is the plan's order rather than the order
performed, and the interface does not present it as one.

**Save explicitly rather than confirm destructively.** Addition destroys nothing.
The repository already treats its one additive act — adding a missing set — as an
explicit save with an explanatory card and no alert, and using a destructive alert
here would teach people that additive and destructive acts look alike, devaluing
the three real destructive confirmations on the same screen.

**Reuse `correctCompleted` rather than adding a fourth repository method.** The
reasoning of ADR 0020 applies unchanged: the contract already performs precisely
this write, it holds no statement that can reach the parent row, its lifecycle
guard is the one an addition needs, and a new method would be identical in body
while duplicating the delete-before-insert ordering that exists because foreign
keys are off inside the transaction. Duplicating that ordering is the risk worth
avoiding. What the rebuilt aggregate holds is application policy and lives in the
`workout-history` use case, exactly as it does for correction and removal: the
repository contract validates lifecycle, not intent. Its documentation is
corrected in the same change to name three callers. Renaming it was rejected
again, for the reason ADR 0020 gave.

**Let the Catalog into one Workout History workflow, and no further.** The
addition use case takes an `ExerciseCatalogRepository` as one member of its
transaction context, for one purpose. No history read model gains a Catalog
dependency, and no captured snapshot is ever reinterpreted through it.

**Leave `@fitness/domain` unchanged.** The aggregate already expresses a
completed workout holding one more exercise through the reconstruction every
other mutation uses, and its constructors already reject a position gap, a
duplicate identifier, more than one hundred exercises, an invalid snapshot, and a
result that does not match the captured logging mode. Adding a mutating method to
a deliberately immutable aggregate would be appearance rather than substance.

**Add permanently, with no undo, audit, or provenance flag.** The added exercise
is an ordinary session exercise from the moment it is written. Marking it as
"added later" would create new sensitive metadata, a migration, and an
export-format decision, and would invite every derived reader to treat it as less
true than the work beside it. The person states it happened; the product records
it or refuses.

**Change nothing else.** No migration, index, trigger, column, table, or
dependency. Export format version 1 is unchanged, because an added exercise
carries the same fields as any other.

## Consequences

- Work that was performed but never logged can be entered where it happened, and
  recording a second workout that never took place stops being the only remedy.
  The correction lifecycle is complete: a completed workout's recorded results,
  its exercises, and the workout itself can each be explicitly corrected, reduced,
  extended, or deleted by their owner.
- The application has no evidence the work happened. It records the person's
  claim, and the interface must never imply more than that.
- The captured name of an added exercise reflects the Catalog at the moment of
  addition, not at the moment of the workout. This is the first place in the
  product where a snapshot's instant and its workout's instant differ, and it is
  stated in the interface's wording and in the specification rather than being
  left for a reader to discover.
- Personal records, Progress, per-exercise history, the performed-exercise list,
  and export all recompute from the new facts with nothing to invalidate,
  precisely because ADR 0010 and ADR 0017 persisted nothing. The completed workout
  count and elapsed workout time are unaffected, because only children changed.
- This amends ADR 0018 in the one place ADR 0020 left open: its statement that
  exercises are neither added nor removed now holds for correction only.
- `correctCompleted` now has three callers with different product intents. Its
  documented purpose stays the mechanical guarantee it actually provides.
- Unlike every other completed-history act, an addition is not idempotent: a
  repeated submission would append a second exercise rather than refuse. The
  screen guards the call and disables the control while a write is in flight, and
  that guard is a correctness control rather than a courtesy.
- The completed detail carries an additive control beside three destructive ones.
  Section placement above the deletion section, explicit wording, an explanatory
  screen, and the continued absence of any active-workout control keep them apart.

## Alternatives considered

- **Reuse the active-session `addExercise` use case.** Rejected. Its guard admits
  active sessions only, it persists through `replace`, which rewrites the parent
  name, status, and completion timestamp, and it creates the exercise with no
  sets. A history path that cannot touch a parent lifecycle column is stronger
  than one trusted not to.
- **Add a narrow `addCompletedExercise` repository contract.** Rejected as
  described in the decision: identical body, duplicated write ordering, and no
  safety property `correctCompleted` does not already hold.
- **Create the exercise first and let the person add sets afterwards.** Rejected.
  It is two writes with an empty added exercise in between, and it re-creates the
  unresolvable state ADR 0020 closed if the second write never happens.
- **Insert the exercise at a chosen or chronological position.** Rejected.
  Chronological insertion is underivable because no set carries a timestamp, and a
  chosen position would renumber existing exercises to express an ordering the
  product cannot substantiate.
- **Capture a planned prescription for the added exercise.** Rejected. No plan
  prescribed it, and inventing one would be a false historical claim.
- **Copy the snapshot from an earlier occurrence of the same definition.**
  Rejected. It would make history interpret history to guess a name, and it has no
  answer when the definition was never performed before.
- **Refuse the addition when the Catalog definition was renamed since the
  workout.** Rejected. The person is naming what they performed; a rename is not
  evidence they are wrong, and the refusal would block the motivating case on a
  detail the product cannot adjudicate.
- **Mark added exercises with a provenance flag.** Rejected. New sensitive
  metadata, a migration, and an export decision, in exchange for inviting derived
  readers to discount work the person says is real.
- **A destructive-style confirmation alert.** Rejected. Nothing is destroyed, and
  the repository's own additive act already saves explicitly.
- **Bulk addition.** Rejected for this decision. It adds no capability that
  repeating one deliberate act does not already provide, and it multiplies the
  full-workout rule across a selection.
