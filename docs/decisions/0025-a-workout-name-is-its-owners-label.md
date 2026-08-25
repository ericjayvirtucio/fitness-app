# ADR 0025: Treat a workout's name as its owner's label, and let a rename reach its personal records

**Status:** Accepted

**Bounds:** [ADR 0008](0008-historical-workout-session-snapshots.md), which
decided what a completed workout captures, by naming one attribute it does not
capture.

## Context

Every workout started empty was named the string literal `'Workout'`, and no
workflow could change it. A workout started from the plan took the plan's name.
The asymmetry was invisible in the code and unmissable in the product: history
listed rows that differed only by date, and a personal record announced its
evidence as `in Workout`.

Letting an owner fix that raises a question ADR 0008 appears to have already
answered. That decision protects what a completed workout observed, so a later
catalog or plan edit cannot rewrite history. If a completed workout's name is
part of what it captured, renaming one is forbidden.

Every field ADR 0008 protects is a snapshot of another aggregate's attribute:
`exercise_name_snapshot`, `logging_mode_snapshot`, and the planned prescription
columns. Each is copied at capture precisely because the aggregate it came from
can change underneath it.

A session's own name is not another aggregate's attribute. The schema had already
recorded that: the column is `display_name`, not `name_snapshot`, and both
history readers project it through a live join.

```sql
session.display_name AS session_name_snapshot
```

So `WorkoutHistoryListItem.nameSnapshot` and
`ExercisePersonalRecord.occurrence.sessionNameSnapshot` are projections. No table
stores a session-name snapshot. The field names say otherwise and are wrong.

That makes the consequence unavoidable rather than optional: with the existing
schema, renaming a completed workout changes what its personal records say their
evidence is called, including records set months earlier.

## Decision

**A workout's name is a label its owner chooses, not a fact the workout
observed.** ADR 0008 does not reach it. A workout of either status may be renamed
by its owner.

**A rename is not correction.** Specification 0023 preserves everything a
completed workout captured, and a rename writes no recorded value. It passes
through neither `correctCompleted` nor `replace`, and touches no child row.
[ADR 0018](0018-explicit-completed-workout-correction.md) governs changes to what
a workout recorded; this is not one.

**A rename changes what every surface says, including personal record evidence,
and this is accepted and documented rather than hidden.** A record set months ago
reports the name its workout has now.

**A rename writes the name and nothing else.** One guarded `UPDATE` on the parent
row. `replace` deletes and reinserts every child row, so renaming through it
would rewrite every recorded set to change a label.

**A rename is guarded by the lifecycle the screen loaded** — status, start
instant, completion instant — compared inside the transaction and repeated as a
bound predicate on the write, so a workout finished, deleted, restored, or
replaced since the screen opened is refused.

**The aggregate gains no mutator.** The rename reconstructs through
`WorkoutSession.create({ ...stored, name })`, which is how every other write in
the feature already produces a changed session.

**The default name for an empty workout does not change.** Naming is a capability;
defaulting is a separate product decision.

## Consequences

A person can say what their training was, and every surface agrees on the answer:
history, the completed workout, the exercise performance screen, both control
labels, the deletion alert, personal record evidence, and export.

The surprise is real and is stated in the product: the naming screen says the
change reaches personal records, before the person saves.

The retired end-to-end harness had ten assertions matching the literal
`Workout`, because a constant was a stable matcher. The default remains
unchanged, but device checks for renaming must verify the user-provided name
rather than depend on that default.

The `Snapshot` suffix on the two projected fields remains misleading. Renaming
them is a wide, mechanical change across readers, models, export mapping, and
fixtures, with no behavioral effect; it is left for a sprint that can afford it,
and this ADR is the record of what those names actually mean.

No migration, no column, no index, no `CHECK` change, no dependency, and no
export format change. The schema stays at user version 11.

## Alternatives considered

**Forbid renaming a completed workout.** Consistent with a strict reading of ADR
0008 and cheap to implement. Rejected: it would let an owner name only a workout
they are still performing, which is the moment they know least about it, and
would leave every historical row called `Workout` forever.

**Snapshot the name at completion into a new column.** Keeps a record's evidence
frozen at the instant it was set. Rejected: it needs a migration, and it produces
the worse surprise — a workout renamed `Leg Day` whose record permanently reports
`in Workout`, with no way to reconcile the two. Both surprises are defensible;
this one is unfixable.

**Give `WorkoutSession` a `withName`.** The obvious move. Rejected: it would be
this aggregate's first mutator, it would still have to re-run every invariant, and
reconstruction through `create` is the pattern the feature already uses in three
places.

**Change the default name to something derived from the date or weekday.** Would
remove the duplicate-row problem with no rename at all. Rejected as out of scope:
it grants no capability, it is a product decision about defaults rather than about
ownership, and it would rewrite ten working assertions for no behavioral gain.

**Ask for a name when a workout starts.** Rejected: it adds a step to the most-used
action in the product to solve a problem a rename already solves.

**Fold the rename into the Workout Session or Workout History root.** Rejected:
neither can load the other's workout, and widening either would hand an unrelated
screen a reader it has no reason to hold.
