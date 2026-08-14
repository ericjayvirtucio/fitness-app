# ADR 0020: Allow removal of one completed session exercise

**Status:** Accepted

## Context

[ADR 0008](0008-historical-workout-session-snapshots.md) made a completed Workout
Session immutable history. [ADR 0010](0010-derived-workout-history-progress.md)
and [ADR 0017](0017-deterministic-workout-personal-records.md) derived every
summary and every personal record from it at read time and persisted nothing.
[ADR 0018](0018-explicit-completed-workout-correction.md) split a forbidden
silent rewrite from an allowed explicit correction and made recorded set results
correctable, stating that "exercises are neither added nor removed".
[ADR 0019](0019-deliberate-completed-workout-deletion.md) made one whole
completed workout deletable and explicitly deferred "deletion to a single
completed session exercise" because it "raises separate questions about surviving
planned context, exercise renumbering, and emptying a workout".

Those questions are what this decision answers. ADR 0018 left one state
reachable and unresolvable: deleting every set of an exercise "truthfully removes
that exercise from performed counts while its planned context remains visible in
the workout". Nothing in the product can then remove that empty exercise. It
still occupies a position, still displays its captured planned prescription, and
still ships inside every version-1 export, because export writes the aggregate
rather than a performed-set projection.

The same gap covers exercises that were never correctable in the first place: one
added to a session by mistake and never performed, one belonging to somebody
else's workout on a shared device, and the same exercise logged twice. Each
reduces to the same two bad remedies — an empty exercise that cannot be removed,
or deleting a whole workout containing correct work.

Three properties of the merged repository shape the decision. The aggregate
constructors already enforce contiguous exercise positions, unique exercise
identifiers, and the rule that a completed session retains at least one actual
set, so a removal expressed as reconstruction is validated rather than trusted.
`WorkoutSessionRepository.correctCompleted` already rewrites the complete child
set of a completed workout, child-first, under a verified unchanged parent
lifecycle, because the exclusive transaction runs with foreign keys off and the
declared `ON DELETE CASCADE` is inert there. And nothing derived from history is
persisted, so a removed exercise needs no cache invalidation, recomputation, or
migration.

## Decision

Completed workout history remains authoritative. The product already
distinguishes a forbidden silent change from an allowed explicit one; this
decision adds a third explicit act to the two that exist, alongside correcting a
recorded set and deleting a whole workout.

A **silent removal** is any removal of a session exercise caused by something
other than a deliberate act on that specific exercise: a Catalog or Planner edit,
a Profile or body-weight change, a unit-preference change, a migration, a
background task, a derived reader, a retention rule, a failed correction,
deletion, export, or restore, or application startup. None of these may remove a
session exercise, and none is introduced here.

An **explicit removal** is a person opening one completed workout, choosing a
control on one specific session exercise, reading what will disappear, and
confirming an irreversible action. It removes exactly one
`workout_session_exercise` row with the `workout_set` rows it owns, renumbers the
surviving exercises of that workout, and changes nothing else.

**Keep the parent workout intact and refuse to empty it.** The parent row, its
status, and its start and completion instants are never written. A removal that
would leave the workout with no recorded set is refused in words on the exercise
it applies to, and points at deleting the whole workout instead — the remedy ADR
0019 built. This is the same rule Sprint 23 applied to the last recorded set,
reached from a different direction.

**Keep an empty exercise visible until it is removed.** An exercise whose sets
were all corrected away stays on the completed detail as planned-but-unperformed
context. Hiding it would be a silent removal from the one screen that is
authoritative about what a workout holds, and the captured planned prescription
is a true fact about that workout. The detail says the exercise recorded nothing
and offers both remedies: add a missing set, or remove it.

**Reuse `correctCompleted` rather than adding a third repository method.** The
contract already performs precisely this write, and the failure mode that
justified splitting `deleteCompleted` from `discard` has no analogue here.
`discard`'s only lifecycle guard was the `status = 'active'` predicate in its own
SQL, so widening it would have armed the active workout screen; `correctCompleted`
already proves the stored row is completed with the loaded start and completion
instants, and holds no statement that can reach the parent row at all. A new
method would be identical in body and would duplicate the delete-before-insert
ordering that exists because foreign keys are off inside the transaction.
Duplicating that ordering is the risk worth avoiding. What may change and what may
not is application policy, and it lives in the workout-history use case for
removal exactly as it lives there for correction: the repository contract
validates lifecycle, not intent.

The contract's documentation is corrected in the same change. It now states that
it rewrites the complete child set of a completed workout under a verified
unchanged parent lifecycle, and it names both callers. Renaming the method was
considered and rejected: ADR 0018 names it in accepted text, and rewriting an
accepted decision to chase a rename is worse drift than an accurate doc comment
plus this record.

**Leave `@fitness/domain` unchanged.** The aggregate already expresses a workout
without one of its exercises through the reconstruction every other mutation
uses, and its constructors already reject a position gap, a duplicate identifier,
and a completed workout with no actual set. Domain tests pin the exercise-position
rules so they are intentional rather than incidental. Adding a mutating method to
a deliberately immutable aggregate would be appearance rather than substance.

**Remove permanently, with no undo, audit, or tombstone.** The reasoning of ADR
0019 applies unchanged when the target narrows from a workout to one of its
exercises: an undo window would retain exactly the rows the person asked to
remove and would need an expiry clock, recovery after process death, and defined
behavior under export, restore, replacement, and erasure; a removal log would
create new sensitive metadata, a migration, and an export decision while
restoring nothing; and a tombstone is only meaningful against a peer that does
not exist before cloud synchronization is designed.

**Change nothing else.** No migration, index, trigger, column, table, or
dependency. Export format version 1 is unchanged, because an omitted exercise
changes no field.

## Consequences

- A wrongly recorded exercise can be removed without destroying the correct work
  performed beside it, and an empty completed session exercise stops being a
  reachable state the product cannot resolve.
- The exercise and its recorded sets are gone. The application cannot restore
  them, cannot show that they existed, and must never imply that it can.
- Surviving exercises are renumbered, so a stored position is not a stable
  external reference to an occurrence. Nothing in the product treated it as one:
  every read orders by position, and identity is carried by identifier.
- Personal records, Progress, per-exercise history, the performed-exercise list,
  and export all recompute from the remaining facts with nothing to invalidate,
  precisely because ADR 0010 and ADR 0017 persisted nothing. The completed workout
  count and elapsed workout time are unaffected, because only children change.
- This amends ADR 0018 in one narrow place: its statement that exercises are
  neither added nor removed now holds for correction only. Adding an exercise to
  completed history remains unbuilt and unprejudiced.
- `correctCompleted` now has two callers with different product intents. Its
  documented purpose is stated as the mechanical guarantee it actually provides,
  so no reader has to infer the boundary from a caller.
- The completed detail carries a third destructive control. Per-exercise
  placement, wording that names the captured exercise and its position, and the
  continued absence of any active-workout control keep the three apart.

## Alternatives considered

- **Add a narrow `removeCompletedExercise` repository contract.** Rejected as
  described in the decision: identical body, duplicated write ordering, and no
  safety property that `correctCompleted` does not already hold.
- **Rename `correctCompleted` to name the mechanism.** Rejected. More honest, but
  it drifts the accepted text of ADR 0018 for no behavioral gain. The doc comment
  and this record carry the same information.
- **Reuse the active-session `removeExercise` use case.** Rejected. It persists
  through `replace`, which rewrites the parent name, status, and completion
  timestamp, and its guard admits active sessions only. A history path that cannot
  touch a parent lifecycle column is stronger than one trusted not to.
- **A targeted `DELETE` plus `UPDATE ... position` statements.** Rejected. It
  bypasses the aggregate invariants, and renumbering in place can transiently
  violate `UNIQUE(workout_session_id, position)` that the existing
  delete-then-insert order never violates.
- **Remove empty exercises automatically after a correction.** Rejected outright.
  That is a silent removal performed by a failed-to-be-deliberate act, and it
  would delete captured planned context the person never asked to lose.
- **Hide empty exercises from the completed detail.** Rejected. It leaves the row
  stored and exported while telling the person it is gone, which is the worst of
  both states.
- **Allow removal only for exercises with no recorded sets.** Rejected. It solves
  the tidiest case and leaves the motivating ones — an exercise logged twice, or
  somebody else's exercise on a shared device — reachable only by deleting sets
  one at a time until the workout's last recorded set refuses.
- **A dedicated confirmation screen or a typed confirmation phrase.** Rejected.
  One child aggregate is far narrower than the whole-installation deletion that
  earns a dedicated screen, and the destructive alert already used for
  recorded-set, weight check-in, and whole-workout deletion is proportionate.
- **Multi-select or bulk removal.** Rejected for this decision. It multiplies the
  emptying rule across a selection and adds no capability that repeating one
  deliberate act does not already provide.
