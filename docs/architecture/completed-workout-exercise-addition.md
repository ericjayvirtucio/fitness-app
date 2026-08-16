# Completed workout exercise addition architecture

## Boundary and ownership

Addition is a write path that starts in completed history, reads the Exercise
Catalog once, and ends inside the Workout Session aggregate:

```text
CompletedWorkoutScreen
  → Add exercise to this workout
  → CompletedWorkoutExerciseAdditionScreen      (selection, then the first set)
  → AddCompletedWorkoutExerciseUseCase          (workout-history)
  → WorkoutSessionRepository.correctCompleted   (workout-session)
  → one exclusive SQLite transaction
  → completed session aggregate rebuilt with the new exercise appended
  → refreshed completed detail
```

`workout-history` owns the workflow, its outcome model, its messages, its screen,
and the refresh. A person starts from completed history, and every read model an
addition disturbs — completed detail, per-exercise history, personal records,
progress, performed exercises, export — belongs to that capability.

`workout-session` owns writes to its own aggregate. Composition connects them.
There is no generic history repository and presentation issues no SQL.

## What an addition writes

Exactly one new `workout_session_exercise` row at the last position, holding
exactly one `workout_set` row at position zero.

Untouched: every existing session exercise with its identifier, position, and
captured snapshots; the parent `workout_session` row with its status and lifecycle
instants; every other completed workout; the active workout; Exercise Catalog
definitions; Workout Planner records; the Profile, Goals, Nutrition, Hydration,
and body-weight history; externally saved export files; and the schema and
migration version.

## The Catalog dependency, and its limit

This is the first Workout History use case to read the Exercise Catalog. It does
so as one member of its transaction context:

```ts
type CompletedExerciseAdditionContext = Readonly<{
  catalog: ExerciseCatalogRepository;
  sessions: WorkoutSessionRepository;
}>;
```

The Catalog is read for exactly one purpose — minting a **new** snapshot for an
exercise entering the session at the moment the person says it entered. No
existing snapshot is re-read, re-derived, or revalidated against current Catalog
state, and no session row gains a foreign key.
[ADR 0008](../decisions/0008-historical-workout-session-snapshots.md) requires a
snapshot when an exercise enters a session and forbids history from joining
mutable source rows to interpret work already recorded; addition does the first
and not the second.

The consequence is stated rather than hidden: the captured name is the
definition's name today, while the work happened earlier. A definition renamed
after the workout was completed contributes today's name, because that is the name
the person selected. A definition deleted while the screen is open refuses the
addition rather than inventing a name.
[ADR 0021](../decisions/0021-completed-workout-exercise-addition.md) records the
decision.

## Why `correctCompleted` is reused

For the reasons [ADR 0020](../decisions/0020-completed-session-exercise-removal.md)
already recorded. The contract confirms the stored row is completed with the start
and completion instants the caller loaded, then rewrites the complete child set of
that workout from the passed aggregate, deleting every child before inserting any.
It holds no statement that can reach the parent row. A fourth method would be
identical in body and would duplicate the delete-before-insert ordering that
exists because the transaction connection runs with foreign keys off.

What the rebuilt aggregate holds is application policy, and it lives in the
`workout-history` use case for addition exactly as it does for correction and
removal: the repository contract validates lifecycle, not intent. Its
documentation names all three callers.

## Why the domain is unchanged

`WorkoutSession` has no mutators. Addition reconstructs the aggregate the way
every other mutation does, and the constructors already enforce everything it
needs:

| Rule                                                        | Enforced by                     |
| ----------------------------------------------------------- | ------------------------------- |
| Exercise positions are contiguous from zero                 | `WorkoutSession.create`         |
| Exercise identifiers are unique                             | `WorkoutSession.create`         |
| At most one hundred exercises                               | `WorkoutSession.create`         |
| Status and lifecycle instants are carried through untouched | `WorkoutSession.create`         |
| The captured snapshot is valid and the name is bounded      | `WorkoutSessionExercise.create` |
| The result matches the captured logging mode                | `WorkoutSessionExercise.create` |
| Set positions stay contiguous and identifiers unique        | `WorkoutSessionExercise.create` |

The rebuilt session is spread from the loaded one, so no lifecycle field and no
existing snapshot has a path to change. A mistake in the appended position fails
the whole transaction rather than writing a duplicate or a gap.

## The first recorded set

An added exercise always holds at least one recorded set, captured in the same
action. The result is a required input and the exercise is only ever constructed
holding exactly one set, so no code path can produce an empty added exercise.

A completed workout gaining an exercise that recorded nothing would re-create
precisely the state
[removal](completed-session-exercise-removal.md) closed, and would assert work the
person never described.

## Transaction shape

One exclusive transaction per addition:

1. Validate the session and definition identifiers.
2. Reload the session inside the transaction.
3. Refuse if it is missing or no longer completed.
4. Refuse if its start or completion instant differs from the loaded one.
5. Refuse if the workout already holds the maximum number of exercises, before
   the Catalog is read.
6. Read the selected definition; refuse if it is gone.
7. Build the first set, then the new exercise at the next position holding it.
8. Rebuild the aggregate with the exercise appended.
9. Persist through `correctCompleted`.
10. Commit.

Children are deleted before their parents and inserted parents-first, because the
transaction connection runs with foreign keys off and cannot enable them once the
transaction has begun, so `ON DELETE CASCADE` would leave orphaned rows that no
read path can see. Deleting all children before re-inserting them also means
`UNIQUE(workout_session_id, position)` is never transiently violated.

Either the whole addition commits or the previous completed history survives
untouched, with neither the exercise nor its set written. A refusal writes nothing
at all.

## Position and identity

The added exercise takes the last position and nothing is renumbered. Every
existing exercise keeps its identifier, captured name, logging mode, planned
prescription, source identifiers, and every set it owns, and child rows are
rewritten with the same identifier values, so identity survives the
delete-and-reinsert.

Chronological insertion is underivable rather than deferred: a `WorkoutSet`
carries no timestamp, so no stored fact orders one set against another inside a
workout. Stored order is a stored order and not a chronological claim, and the
interface never presents it as one.

Both exercise limits are enforced: the use case refuses at
`workoutSessionPolicy.maximumExercises`, the aggregate rejects more than one
hundred, and `CHECK (position BETWEEN 0 AND 99)` backs both. Display order comes
from the stored position, and every read orders by exercise position then set
position. No identifier reaches the interface, an error, or a log.

## Stale state without new schema

The screen submits the start and completion instants it loaded, and the use case
compares them against the stored row inside the transaction, so a screen left open
through a correction, a removal, a deletion, a restore, or a replacement refuses
rather than appending to whatever aggregate now holds that identifier.

The refusals are: the workout is no longer available, it is no longer completed
history, the workout changed since the screen opened, the exercise is no longer in
the exercise library, the entered values do not match how the exercise is
recorded, and the workout already holds the most exercises it can keep. One
further fixed sentence covers an addition that could not be saved. Every message
is fixed and safe.

Duplicate submission matters more here than for the other completed-history acts.
A second removal finds its target gone and refuses; a second addition would append
a second exercise, because nothing about an addition is idempotent. The screen
guards the call, the control is disabled while a write is in flight, and success
leaves the screen immediately.

## Derived behavior

Nothing derived is persisted, so there is nothing to invalidate.

The workout's actual set count, performed exercise count, repetitions, duration,
distance, and eligible recorded load volume recompute. The completed workout count
and elapsed workout time do not change, because only children changed, and Workout
History keeps its keyset pagination stable.

Personal records recompute on the next read: the added result may establish or
replace a record, with evidence pointing at this workout. The occurrence appears
in per-exercise history at the workout's **captured** date rather than today's,
and an exercise never performed before joins the performed-exercise list and
becomes eligible for the picker's recents.

Export includes the added work in format version 1 with no contract change,
restore parses an older export unchanged, replacement restores it atomically, and
erasure removes history like any other.

## Experience and accessibility

The completed workout screen carries one entry point, in its own section after the
exercise list and before "Delete this workout", so the additive act sits above the
destructive one. A workout already holding the maximum shows a sentence instead of
a control.

Selection and the first recorded set live on one screen, because the exercise and
its set are one write. The picker is the one the active workout already uses, with
wording of its own and no way to create a Catalog definition. The screen states
what will change before anything is saved, and saves explicitly: nothing is
destroyed, so a destructive confirmation would be disproportionate and would
devalue the three real ones on the neighbouring screen.

After a successful addition the detail refreshes in place with the new exercise
last, a polite announcement confirms what happened, and focus stays in the detail.
A refusal keeps the screen and preserves the entered values. Addition is
unreachable from every active workout screen, and the completed detail still
carries no finish, discard, resume, or reorder control.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, external service, or new
dependency. All SQL is parameter-bound. No exercise name, result, date,
identifier, or addition is logged, no hidden backup is written, and no addition
reason is stored.

A completed aggregate holds at most one hundred exercises of one hundred sets, so
one addition is a bounded child rewrite in a short transaction — the same work a
set correction already does — plus one indexed Catalog read. Derived reads stay
constant-query. No index, migration, background worker, or persisted summary was
added, and the schema stays at user version 11.

No undo, audit trail, or provenance flag exists. An added exercise is an ordinary
session exercise from the moment it is written, and the application never claims
to know that the work happened — it records the person's claim.
