# ADR 0018: Allow explicit correction of recorded sets in completed workouts

**Status:** Accepted

## Context

[ADR 0008](0008-historical-workout-session-snapshots.md) made a completed Workout
Session immutable history and closed with the note that "completed correction and
history browsing need a later lifecycle design".
[ADR 0010](0010-derived-workout-history-progress.md) built the read-only
`workout-history` capability on top of that immutability and derived every
summary at read time. [ADR 0017](0017-deterministic-workout-personal-records.md)
then derived personal records the same way, and observed that "a mis-logged set
now becomes a durable record claim, which raises the value of a later reviewed
correction capability".

That is the situation this decision resolves. A single mistyped set — 600 kg
instead of 60 kg — is now a durable record claim, an inflated load volume in
Progress, a line in every version-1 export, and something that survives restore
and replacement. The only remedy the product offers is erasing all local
information, which is disproportionate to a typing mistake and pushes people
toward keeping data they know is false.

Three properties of the merged repository shape the decision. The immutability
boundary is one line of application policy — the active-only status guard in
`WorkoutSessionMutationUseCases.mutate` — and not a schema constraint, a trigger,
or a domain rule. The `WorkoutSession` aggregate has no mutators at all; every
existing mutation reconstructs the aggregate through its constructors, which
already reject a completed session holding no actual sets. And nothing derived
from history is persisted, so a corrected fact needs no cache invalidation,
recomputation, or migration.

## Decision

Completed workout history remains authoritative, but authoritative no longer
means incapable of explicit correction. The product distinguishes a silent
rewrite, which stays forbidden, from an explicit user correction, which is now
allowed for actual set results only.

A silent rewrite is any change to completed history caused by something other
than a deliberate act on that specific record: a Catalog or Planner edit, a
Profile change, a migration, a background task, a derived reader, or a change of
unit preference. None of these may alter a completed workout, and none is
introduced here.

An explicit correction is a person opening a completed workout, choosing one
recorded set, changing or deleting it, confirming when the action destroys
information, and saving through a use case that exists for no other purpose. It
changes the stored historical fact because the person states the original entry
was wrong. It is never presented as a way to improve a result or claim a better
record.

Version 1 permits editing a recorded set, adding a missing set to an existing
completed session exercise, and deleting an erroneous set. Everything else about
a completed workout stays fixed: its identity, name, start and completion
instants, captured local date and offset, and every session exercise with its
captured name, logging mode, planned prescription, and source identifiers.
Exercises are neither added nor removed.

**Correct without an audit trail.** The corrected value overwrites the previous
one, the previous value is not retained, and nothing in the product claims
otherwise. Nutrition, hydration, and body weight corrections already work this
way, so this is the behavior the product already has rather than a new
concession.

**Leave `@fitness/domain` unchanged.** The aggregate already expresses a
corrected completed session through the same reconstruction its other mutations
use, and it already enforces the completion invariant, contiguous set positions,
unique set identifiers, the per-exercise set limit, and result compatibility with
the captured logging mode. Explicit domain tests pin that behavior so it is
intentional rather than incidental.

**Split ownership explicitly.** `workout-history` owns the correction workflow,
its outcomes, and its screens, because the person starts from completed history
and every read model a correction disturbs belongs there. `workout-session` keeps
ownership of writes to its own aggregate through one new repository method,
`correctCompleted`, which confirms the stored row is still completed with the
same start and completion instants and then rewrites only child rows. The
active-only guard on ordinary session mutation is untouched and `replace` keeps
its single active-session caller.

**Change nothing else.** No migration, index, trigger, column, table, tombstone,
or dependency. Export format version 1 is unchanged because a corrected export
carries the same fields with corrected values.

## Consequences

- A mistyped set can be fixed in place, and the disproportionate "delete
  everything" remedy stops being the only correction path.
- The original erroneous value is gone. The application cannot show what changed
  or when, and it must never imply that it can.
- Personal records, Progress, per-exercise history, the history list, and export
  all recompute from corrected history with nothing to invalidate, precisely
  because ADR 0010 and ADR 0017 persisted nothing.
- Deleting every set of one exercise truthfully removes that exercise from
  performed counts while its planned context remains visible in the workout.
- This amends the durability consequence of ADR 0008 and ADR 0010 in one narrow
  place: completed history is correctable, by explicit user action, for actual
  set results only. Every other reason a completed workout might change remains
  forbidden, and the snapshot rule that keeps Catalog and Planner out of history
  is strengthened rather than relaxed, because correction reads its labels,
  units, and validation from the captured snapshots.
- The completed detail screen now carries write controls, which slightly softens
  the "this workout is finished" signal. A dedicated correction screen,
  correction-specific wording, and the continued absence of any active-workout
  control keep the distinction visible.
- A later audit or revision model, completed exercise editing, and completed
  workout deletion remain unbuilt and unprejudiced.

## Alternatives considered

- **Keep completed history immutable and rely on erasure.** Rejected. Deleting
  every record of nutrition, hydration, workouts, and measurements to remove one
  wrong number is not a remedy, and it teaches people that wrong data is
  permanent.
- **Store correction metadata — a corrected timestamp, a revision counter, or a
  note.** Rejected. It requires a migration and an export-format decision, it
  creates new sensitive metadata, and it still does not preserve the original
  value, so it would buy the appearance of rigor rather than the substance.
- **Append-only revision history.** Rejected for this decision. Event history
  brings retention, reconstruction, export, restore, erasure, and synchronization
  policies that deserve their own review, and none of them is needed to fix a
  typing mistake offline.
- **Add `correctCompletedSet` to the `WorkoutSession` aggregate.** Rejected. The
  aggregate deliberately has no mutators, every other mutation reconstructs
  through its constructors, and a lifecycle-aware method would restate invariants
  the constructors already enforce while making a general mutation surface out of
  a narrow one.
- **Reuse the active-session `replace` method.** Rejected. It rewrites the parent
  name, status, and completion timestamp. A correction path that cannot touch a
  parent lifecycle column is stronger than one that is merely trusted not to.
- **A targeted `UPDATE workout_set` statement.** Rejected. It bypasses aggregate
  invariants, including the rule that a completed workout must retain performed
  work.
- **Edit-only, or edit-and-delete, for version 1.** Rejected. The active-session
  use cases already implement all three shapes, the aggregate already enforces
  the ordering and non-empty rules, and shipping without "add" would leave an
  omitted set uncorrectable for no saved effort.
- **Put correction in the `workout-session` screens.** Rejected. Active workout
  execution and historical correction are different acts, and sharing a screen
  would risk active-workout controls reaching completed records.
- **Full completed workout editing — name, times, exercises, lifecycle.**
  Rejected. Each of those changes what a completed workout means rather than what
  it recorded, and each needs its own historical-authority decision.
