# Completed session exercise removal architecture

## Boundary and ownership

Removal is a write path that starts in completed history and ends inside the
Workout Session aggregate:

```text
CompletedWorkoutScreen
  → destructive confirmation
  → RemoveCompletedWorkoutExerciseUseCase       (workout-history)
  → WorkoutSessionRepository.correctCompleted   (workout-session)
  → one exclusive SQLite transaction
  → completed session aggregate reconstruction without that exercise
  → refreshed completed detail
```

`workout-history` owns the workflow, its outcome model, its messages, the
confirmation, and the refresh. A person starts from completed history, and every
read model a removal disturbs — completed detail, per-exercise history, personal
records, progress, performed exercises, export — belongs to that capability.

`workout-session` owns writes to its own aggregate. Composition connects the two.
There is no generic history repository and presentation issues no SQL.

## What a removal removes

Exactly one `workout_session_exercise` row, the `workout_set` rows it owns, and
the stored `position` of the surviving exercises in the same workout.

Untouched: the parent `workout_session` row with its status and lifecycle
instants, every other completed workout, the active workout, Exercise Catalog
definitions, Workout Planner records, the Profile, Goals, Nutrition, Hydration,
body-weight history, externally saved export files, and the schema and migration
version. History reads its own captured snapshots, so nothing deleted from the
Catalog or the Planner is recreated or modified.

## Why `correctCompleted` is reused

`correctCompleted` already performs this write. It confirms the stored row is
completed with the start and completion instants the caller loaded, then rewrites
the complete child set of that workout from the passed aggregate, deleting every
child before inserting any.

The failure mode that justified splitting `deleteCompleted` from `discard` has no
analogue here. `discard`'s only lifecycle guard is the `status = 'active'`
predicate in its own SQL, so widening it would make the active workout screen
capable of deleting completed history. `correctCompleted` holds no
statement that can reach the parent row at all, and its lifecycle guard is
already the one a removal needs.

A third method would be identical in body and would duplicate the
delete-before-insert ordering that exists because the transaction connection runs
with foreign keys off. Duplicating that ordering is the risk worth avoiding.
Which children the rebuilt aggregate holds is application policy, and it lives in
the `workout-history` use case for removal exactly as it lives there for
correction: the repository contract validates lifecycle, not intent.

The contract's documentation states that mechanical guarantee and names both
callers, so no reader has to infer the boundary from a call site.
[ADR 0020](../decisions/0020-completed-session-exercise-removal.md) records the
decision.

## Why the domain is unchanged

`WorkoutSession` has no mutators. Removal reconstructs the aggregate the way
every other mutation does, and the constructors already enforce everything it
needs:

| Rule                                                           | Enforced by                     |
| -------------------------------------------------------------- | ------------------------------- |
| Exercise positions are contiguous from zero                    | `WorkoutSession.create`         |
| Exercise identifiers are unique                                | `WorkoutSession.create`         |
| A completed session must retain at least one actual set        | `WorkoutSession.create`         |
| Status and lifecycle instants are carried through untouched    | `WorkoutSession.create`         |
| Surviving set positions stay contiguous and identifiers unique | `WorkoutSessionExercise.create` |
| Snapshots are revalidated on every reconstruction              | both constructors               |

The rebuilt session is spread from the loaded one, so no lifecycle field and no
surviving snapshot has a path to change. A renumbering mistake fails the whole
transaction rather than writing a position gap.

## Transaction shape

One exclusive transaction per removal:

1. Validate the session and exercise identifiers.
2. Reload the session inside the transaction.
3. Refuse if it is missing or no longer completed.
4. Refuse if its start or completion instant differs from the loaded one.
5. Refuse if the exercise is no longer part of the workout.
6. Refuse if removing it would leave no recorded set, before anything is written.
7. Renumber the survivors and rebuild the aggregate.
8. Persist through `correctCompleted`.
9. Commit.

Children are deleted before their parents and inserted parents-first, because the
transaction connection runs with foreign keys off and cannot enable them once the
transaction has begun, so `ON DELETE CASCADE` would leave orphaned rows that no
read path can see. Deleting all children before re-inserting them also means
`UNIQUE(workout_session_id, position)` is never transiently violated while
survivors are renumbered.

Either the whole removal commits or the previous completed history survives
untouched. A refusal writes nothing at all.

## Position and identity

Survivors keep their identifiers, their captured names, logging modes, planned
prescriptions, and source identifiers, and every set they own keeps its
identifier, position, and result. Child rows are rewritten with the same
identifier values, so identity survives the delete-and-reinsert.

Display order comes from the stored position, and every read orders by exercise
position then set position. No identifier reaches the interface, an error, or a
log. A stored position is not a stable external reference to an occurrence,
because a removal renumbers the survivors.

## Stale state without new schema

The completed detail submits the start and completion instants it loaded, and the
use case compares them against the stored row inside the transaction, so a screen
left open through another removal, a deletion, a restore, or a replacement
refuses rather than acting on whatever aggregate now holds that identifier.

The refusals are: the workout is no longer available, it is no longer completed
history, the exercise is no longer part of the workout, the workout changed since
the screen opened, and the workout would be left with no recorded set. One
further fixed sentence covers a removal that could not be saved. Every message is
fixed and safe. A refusal reloads the detail, because the usual reason one
arrives is that the screen is showing something history no longer holds.

A set correction elsewhere can leave the confirmation's recorded set count one
behind what is stored. The target is the exercise identifier, so the wrong
exercise can never be removed; only the stated count can be stale.

## The empty exercise

An exercise whose sets were all corrected away stays visible as
planned-but-unperformed context, and the detail says it recorded nothing and can
be given a missing set or removed. Derived reads already exclude it: performed
counts and the performed-exercise list require an actual set through an `EXISTS`
or a join on `workout_set`. Export is the one reader that carries it, because
export writes the aggregate, so removal is what drops it from the next export.

## Derived behavior

Nothing derived is persisted, so there is nothing to invalidate.

The workout's actual set count, performed exercise count, repetitions, duration,
distance, and eligible recorded load volume recompute. The completed workout
count and elapsed workout time do not change, because only children changed, and
Workout History keeps the workout with its keyset pagination stable.

Personal records recompute on the next read: a record established by a removed
set moves to the next eligible result, or no record is claimed. The occurrence
leaves per-exercise history, and an exercise performed only there leaves the
performed-exercise list.

Export omits the removed exercise in format version 1 with no contract change,
restore parses an older export unchanged, replacement restores it atomically, and
erasure removes remaining history like any other.

## Experience and accessibility

Each exercise on the completed workout screen offers "Remove This Exercise" after
its recorded sets and its "Add Missing Set" control. The control carries a full
accessible label naming the captured exercise and its displayed position, so
duplicate exercise names inside one workout stay distinguishable. Choosing it
opens the destructive alert the repository already uses for recorded-set, weight
check-in, and whole-workout deletion, naming the exercise, stating how many
recorded sets disappear, and offering a destructive action beside a neutral
Cancel.

The exercise that holds the only recorded sets in the workout shows a sentence
instead of a control, pointing at
[deleting the whole workout](completed-workout-deletion.md).

After a successful removal the detail refreshes in place with the survivors
renumbered, a polite announcement confirms what happened, and focus stays in the
detail. Removal is unreachable from every active workout screen, and the
completed detail still carries no finish, discard, resume, or reorder control.
The one addition it offers is
[completed workout exercise addition](completed-workout-exercise-addition.md),
which is completed history's own act and never an active-workout control.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, external service, or new
dependency. All SQL is parameter-bound. No exercise name, result, date,
identifier, or removal is logged, no hidden backup is written, and no removal
reason is stored.

A completed aggregate holds at most one hundred exercises of one hundred sets, so
one removal is a bounded child rewrite in a short transaction — the same work a
set correction already does. Derived reads stay constant-query. No index,
migration, background worker, or persisted summary was added, and the schema
stays at user version 11.

No undo, trash, audit trail, or tombstone exists. The exercise and its recorded
sets are gone and the application never claims otherwise.
