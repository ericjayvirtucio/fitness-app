# Specification 0025: Completed session exercise removal

> Testing-policy note: automated simulator, sprint-suite, and regression-suite
> requirements in this historical specification were superseded by
> [ADR 0033](../docs/decisions/0033-risk-based-manual-device-testing.md).
> Use command-line Jest/Vitest checks plus risk-based manual device testing.

- Status: Approved
- Date: 2026-08-14

## Objective and scope

Let a person remove exactly one completed session exercise from a completed
Workout, so a wrongly recorded exercise can be removed without deleting the whole
workout and without leaving an empty exercise behind. Version 1 removes one
`workout_session_exercise` row with every `workout_set` row it owns, renumbers
the surviving exercises to contiguous positions while preserving their
identifiers and every captured snapshot, and writes it child-first inside one
exclusive transaction after an explicit destructive confirmation.

Everything derived from history — per-exercise history, personal records,
progress summaries, the performed-exercise list, and export — recomputes from the
remaining facts because none of it is persisted.

Adding an exercise to completed history, reordering completed exercises, editing
a captured exercise name, logging mode, or planned prescription, reverting a
completed workout to active, undo, trash, archive, soft deletion, tombstones,
deletion logs, audit history, retention scheduling, bulk or multi-select removal,
removing an exercise from an active session through this path, and any
export-format change are excluded.

## The problem

Specification 0023 made a completed workout correctable at the set level and
deliberately kept at least one performed set in it. Specification 0024 made one
whole completed workout deletable. Neither addresses a single wrongly recorded
exercise inside a workout that is otherwise correct: an exercise added by mistake
and never performed, an exercise belonging to somebody else's workout on a shared
device, the same exercise logged twice, or an exercise whose sets were all
corrected away.

The two remedies the product offers are both wrong for that case. Deleting the
exercise's sets one at a time is refused at the workout's last recorded set, and
otherwise leaves an empty session exercise that still displays its captured
planned context, still occupies a position, still ships in every version-1
export, and cannot be resolved by any action in the product. Deleting the whole
workout destroys correct work performed alongside it.

An empty completed session exercise is therefore a state the product can already
reach and cannot resolve. That is a durable correctness gap rather than a missing
feature, and it is a poor foundation for further derived claims.

## Historical authority

Completed history stays the sole authority for what is displayed, summarized,
ranked, and exported. Authoritative does not mean incapable of deliberate
owner-directed removal.

A **silent removal** is forbidden. No Exercise Catalog change, Workout Planner
change, Profile change, body-weight change, unit-preference change, migration,
background task, derived reader, retention assumption, failed correction, failed
deletion, failed export, failed restore, or application start may remove a
session exercise.

An **explicit removal** is what this specification adds: a person opens one
completed workout, chooses a control on one specific session exercise, reads
exactly what will disappear, and confirms an irreversible action.

The interface says "Remove This Exercise" and "Remove exercise from this
workout". It never says clean up, hide, archive, remove from view, or reset, and
it never implies that the exercise can be recovered, because it cannot.

## Removal authority

Removal affects exactly one `workout_session_exercise` row, the `workout_set`
rows it owns, and the stored `position` of the surviving exercises in the same
workout.

It does not affect the parent `workout_session` row, its status, its start or
completion instant, its captured local date or offset, any other completed
workout, an active workout, Exercise Catalog definitions, Workout Planner
records, the Profile, Goals, Nutrition, Hydration, body-weight history,
externally saved exports, or the schema and migration version. Nothing deleted
from the Catalog or the Planner is recreated or modified, because history reads
its own captured snapshots.

## The empty exercise

An exercise whose sets were all corrected away stays visible on the completed
detail as planned-but-unperformed context. Hiding it would be a silent removal
from the one screen that is authoritative about what the workout holds, and the
planned prescription it captured is a true fact about that workout.

Derived reads already exclude it correctly and are unchanged here. Performed
exercise counts and the performed-exercise list require an actual set through an
`EXISTS` or a join on `workout_set`, so an exercise with no recorded set has
never contributed to progress totals, per-exercise history, or personal records.
Export is the one reader that carries it, because export writes the aggregate.

The completed detail states plainly that such an exercise recorded nothing and
that it can be given a missing set or removed. Removal is the only way to resolve
it, and after this specification that is a real remedy rather than a dead end.

## No undo, no audit, no tombstone

The exercise and its recorded sets are removed permanently from current local
state. The application keeps no copy, no removal record, no reason, and no
before-removal contents, and nothing in the interface or documentation claims
otherwise. The reasoning is the reasoning of
[ADR 0019](../docs/decisions/0019-deliberate-completed-workout-deletion.md) and
is unchanged by narrowing the target from a workout to one of its exercises;
[ADR 0020](../docs/decisions/0020-completed-session-exercise-removal.md) records
what this decision adds.

## Architecture

```text
CompletedWorkoutScreen
  → destructive confirmation
  → RemoveCompletedWorkoutExerciseUseCase      (workout-history owns the workflow)
  → WorkoutSessionRepository.correctCompleted  (workout-session owns its aggregate)
  → one exclusive SQLite transaction
  → completed session aggregate reconstruction without that exercise
  → refreshed completed detail
```

Workout History owns the workflow, its outcomes, its messages, the confirmation,
and the refresh, because the person starts from completed history and every read
model the removal disturbs belongs to Workout History. Workout Session keeps
ownership of writes to its own aggregate. Composition connects them. Presentation
issues no SQL and there is no generic history repository.

Removal reuses the existing `correctCompleted` contract rather than adding a
third repository method. That contract already performs exactly this write: it
confirms the stored row is still completed with the same start and completion
instants, then rewrites the complete child set of that workout from the passed
aggregate, deleting every child before inserting any. It has no statement that
can reach the parent row, so the failure mode that justified splitting
`deleteCompleted` from `discard` — a lifecycle guard weak enough to arm an
active-workout screen — has no analogue here. A new method would duplicate the
delete-before-insert ordering that exists specifically because foreign keys are
off inside the exclusive transaction, and duplicating that ordering is the real
risk. What may change and what may not is application policy, and it lives in the
use case for removal exactly as it lives in the use case for correction: the
repository contract validates lifecycle, not intent.

The contract's documentation is corrected in the same change, because a contract
whose stated purpose no longer matches its use is a defect. It now states that it
rewrites the complete child set of a completed workout under a verified unchanged
parent lifecycle, and names both of its callers.

`@fitness/domain` is unchanged. The aggregate already expresses a completed
workout without one of its exercises through the same reconstruction every other
mutation uses, and its constructors already enforce every rule removal needs:

| Rule                                                                 | Enforced by                     |
| -------------------------------------------------------------------- | ------------------------------- |
| Exercise positions are contiguous from zero                          | `WorkoutSession.create`         |
| Exercise identifiers are unique                                      | `WorkoutSession.create`         |
| A completed session must retain at least one actual set              | `WorkoutSession.create`         |
| Status, start, and completion instants are carried through untouched | `WorkoutSession.create`         |
| Snapshots are revalidated on every reconstruction                    | both constructors               |
| Set positions stay contiguous and identifiers unique                 | `WorkoutSessionExercise.create` |

Domain tests pin the exercise-position rules so they are intentional rather than
incidental. No production domain code changes.

## Transaction and verification

Every removal runs inside one exclusive transaction:

1. Validate the session identifier.
2. Validate the session exercise identifier.
3. Reload the stored session inside the transaction.
4. Refuse if it is missing.
5. Refuse if it is not completed.
6. Refuse if its start or completion instant differs from what the screen loaded.
7. Locate the target exercise; refuse if it is gone.
8. Refuse if removing it would leave the workout with no recorded set, before
   anything is written.
9. Rebuild the surviving exercises at contiguous positions, preserving their
   identifiers, their captured snapshots, and every set they own.
10. Rebuild the session from the loaded one, so no lifecycle field can change.
11. Persist through `correctCompleted`, which deletes every `workout_set` row of
    the workout, then every `workout_session_exercise` row, then inserts the
    survivors and their sets.
12. Commit.

Children are deleted before their parents because the transaction connection runs
with foreign keys off and cannot enable them once the transaction has begun, so
the `ON DELETE CASCADE` declared on both child tables would leave orphaned rows
that no read path can see. Deleting every child before inserting any also means
`UNIQUE(workout_session_id, position)` is never transiently violated while
survivors are renumbered. Every statement is parameter-bound.

A failure at any step rolls back everything and the complete prior aggregate
survives. A refusal writes nothing at all.

## Position and identity

Surviving exercises are rebuilt in their existing order at positions zero
upwards. Their identifiers, captured names, captured logging modes, planned
prescription snapshots, source exercise definition identifiers, and source
planned exercise identifiers are carried through by reconstruction from the
loaded aggregate, and every set they own keeps its identifier, position, and
result. Child rows are rewritten with the same identifier values, so identity
survives the delete-and-reinsert.

A gap is impossible rather than merely avoided: the aggregate rejects an exercise
whose position is not its index, so a renumbering mistake fails the whole
transaction instead of writing a hole. Display order comes from the stored
position, and every read already orders by exercise position then set position.
No identifier reaches the interface, an error, or a log.

## Stale state

The completed detail may stay open while other local data changes. The screen
submits the start and completion instants it loaded, and the use case compares
them against the stored row inside the transaction.

An already-removed exercise is refused as no longer part of the workout. An
already-deleted, erased, or replaced-away workout is refused as no longer
available. A row that is unexpectedly active is refused as no longer completed
history. Lifecycle instants that differ from the loaded ones are refused as
changed rather than removing an exercise from whatever aggregate now holds that
identifier. A second submission finds the exercise gone, and the control stays
disabled while a removal is in flight. Nothing is added to the schema to make
this possible.

A set correction performed elsewhere can leave the confirmation's recorded set
count one behind what is stored. The target is the exercise identifier, so the
wrong exercise can never be removed and the stated count is the only thing that
can be stale. That is accepted rather than fixed with a second fingerprint.

Restoring an older export can reintroduce the same identifiers with the same
instants, which the comparison cannot distinguish. That is accepted: it is the
exercise the confirmation named.

## Refusing to empty the workout

A completed workout keeps at least one recorded set, because completion already
requires performed work and `WorkoutSession.create` enforces it. A removal that
would leave the workout with no recorded set is therefore refused before anything
is written.

This covers two cases with one rule: removing the only exercise, and removing the
only exercise that recorded anything. The completed detail states the refusal in
words on the exercise it applies to and points at deleting the whole workout
instead. It is never expressed as a control that silently does nothing.

## Confirmation and experience

The completed detail stays historical. It gains no finish, discard, add-exercise,
or reorder control, and removal is unreachable from every active workout screen.

Each session exercise carries one removal control after its recorded sets and its
"Add Missing Set" control, labelled in words and never as an icon or a swipe.
Choosing it opens a destructive platform alert naming the captured exercise. The
alert states how many recorded sets disappear, that progress and personal records
may change, that the rest of the workout is kept, and that the action cannot be
undone, and it offers a destructive "Remove Exercise" action beside a neutral
"Cancel". This is the confirmation the repository already uses for recorded-set
deletion, weight check-in deletion, and completed workout deletion. A dedicated
confirmation screen is reserved for whole-installation erasure and is
disproportionate for one child aggregate; a typed confirmation phrase adds
keyboard, localization, and cognitive cost without adding deliberation. The alert
names no identifier and no recorded value.

After a successful removal the completed detail refreshes in place with the
surviving exercises renumbered, because the workout still exists and navigating
away from it would be wrong. An accessible confirmation is announced politely and
focus stays within the detail.

## Errors

The refusals are: the workout is no longer available, it is no longer completed
history, the exercise is no longer part of the workout, the workout changed since
the screen opened, and the workout would be left with no recorded set. One
further fixed sentence covers a removal that could not be saved. Each message is
fixed; none exposes SQL, a table name, an identifier, an exercise name, a
recorded value, a date, an internal path, or a stack trace. A refusal reloads the
detail, because the usual reason one arrives is that the screen is showing
something history no longer holds.

## Derived behavior

Nothing derived is persisted, so nothing is invalidated, decremented, or
recomputed in the background.

The exercise disappears from the completed detail. The workout's actual set
count, performed exercise count, repetitions, duration, distance, and eligible
recorded load volume recompute. The completed workout count and elapsed workout
duration do not change, because only children changed. Workout History keeps the
workout and its keyset pagination stays stable, because no session row is
renumbered.

Personal records recompute on the next read: a record established by a removed
set moves to the next eligible result, or no record is claimed. Evidence can
never point at removed rows. The earliest-occurrence tie rule and the unsupported
treatment of assistance are unchanged.

The occurrence disappears from per-exercise history, and an exercise performed
only there leaves the performed-exercise list. A deleted current Catalog
definition is never recreated.

Export omits the removed exercise from the next version-1 export with no contract
change. Externally saved exports are unchanged, and restoring or replacing with
an older export may truthfully bring the exercise back because that file contains
it. Local erasure and safe replacement are unchanged.

## Accessibility

Screens use the design-system public API, native heading roles, Dynamic Type,
minimum touch targets, and vertical layout that does not scroll horizontally. The
removal control carries an explicit text label naming the captured exercise and
its displayed position, so duplicate exercise names inside one workout stay
distinguishable. No meaning depends on an icon or a color, and Cancel is neutral.
The refusal that protects the last recorded set is text, announced with the
content it belongs to. After a removal the confirmation is announced politely and
focus stays on valid completed detail content.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, external service, or new
dependency. All SQL is parameter-bound. No exercise name, result, date,
identifier, or removal is logged, no hidden backup is written, and no removal
reason is stored. QA uses synthetic data only.

A completed aggregate holds at most one hundred exercises of one hundred sets, so
one removal is a bounded child rewrite inside a short transaction — the same work
a set correction already does — served by existing indexes. Derived reads stay
constant-query. No index, background worker, or persisted summary is added.

## Migration and dependencies

None. The schema stays at user version 11 and no column, table, trigger, index,
or constraint is added or removed. No dependency changes.

## Verification and completion

Domain tests pin that an exercise position gap is rejected and that survivors of
a removal keep their identifiers at contiguous positions.

Application tests cover a successful removal and its renumbering, removing the
only exercise refused, a removal that would leave no recorded set refused, a
missing workout, an active workout, a missing exercise, an invalid identifier,
stale lifecycle instants, duplicate submission, safe error translation, and
history preserved after a failed write.

Persistence tests run on a real SQLite engine and cover child-first write order,
absent cascade reliance, preserved surviving identifiers, contiguous surviving
positions from zero, untouched captured snapshots, an untouched parent row and
lifecycle instants, other workouts left unchanged, absent orphan rows, bound
parameters, rollback after a forced child failure, rollback after a forced insert
failure, a refusal that writes nothing, recomputed progress and personal records,
and an unchanged schema version.

Presentation tests cover the control appearing on each removable exercise, the
confirmation naming the exercise and its recorded set count, cancellation
preserving everything, success refreshing the detail in place, the emptying
refusal stated in words rather than by a dead control, the empty-exercise
explanation, a disabled repeated request, a safe failure message, and accessible
labels. Dynamic Type is served by the design system and verified in manual QA, as
it is for correction and deletion.

Sprint 25 adds a Maestro suite that completes a workout with two exercises,
verifies the completed detail offers removal and stays historical, cancels a
removal, removes one exercise and keeps the other with its recorded sets,
verifies progress and personal records, refuses to remove the only exercise in
words, and survives a relaunch, and it enters the stable regression suite. Merge
readiness requires:

```bash
./scripts/qa.sh sprint 25 --platform ios
./scripts/qa.sh regression --platform ios
```

Removing an exercise whose sets were all corrected away, removal from a workout
whose Catalog definition or Planner source was deleted, every logging mode, both
unit systems, export, restore, replacement, and erasure after removal, stale
correction and deletion screens, interrupted transactions, large Dynamic Type,
VoiceOver, TalkBack, and keyboard behavior remain targeted manual QA.

## Explicit exclusions

Adding an exercise to completed history; reordering completed exercises; editing
a captured exercise name, logging mode, or planned prescription; deleting only
planned context; reverting a completed workout to active; undo; trash; archive;
soft deletion; tombstones; removal logs; audit history; retention scheduling;
automatic cleanup; bulk, multi-select, and date-range removal; cloud deletion;
synchronization; removing an exercise from an active session through this path;
export format version 2; migrations; new personal record categories; charts;
Progress redesign; authentication; backend endpoints; AI; notifications; and
dependency upgrades are excluded.

The repository owner approved the Stage 1 design and authorized staged
implementation on `feat/completed-session-exercise-removal` on 2026-08-14.
