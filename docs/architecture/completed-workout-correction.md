# Completed workout correction architecture

## Boundary and ownership

Correction is a write path that starts in completed history and ends inside the
Workout Session aggregate:

```text
CompletedWorkoutScreen
  → CompletedWorkoutSetCorrectionScreen
  → CorrectCompletedWorkoutSetUseCase          (workout-history)
  → WorkoutSessionRepository.correctCompleted  (workout-session)
  → one exclusive SQLite transaction
  → completed session aggregate reconstruction
  → derived readers recompute at their next read
```

`workout-history` owns the workflow, its outcome model, and its screens. A person
starts from completed history, and every read model a correction disturbs —
history list, completed detail, per-exercise history, personal records, progress,
export — belongs to that capability.

`workout-session` owns writes to its own aggregate. It exposes exactly one new
method for this, and Workout History depends on that contract rather than on
SQL. Composition connects the two. There is no generic history repository and
presentation issues no SQL.

## What a correction may change

Only the actual set results of an existing completed session exercise. Removing
a whole session exercise is a separate workflow with its own use case and its own
confirmation; see
[completed session exercise removal](completed-session-exercise-removal.md).

Unchanged by construction: the session identifier, name, status, start instant,
completion instant, captured local calendar date, captured UTC offset, source
planned workout identifier, and source weekday; and for every exercise its
identifier, position, captured name, captured logging mode, planned prescription
snapshot, source exercise definition identifier, and source planned exercise
identifier. Exercises are never added or removed.

The correction reads its labels, units, and validation rules from those captured
snapshots and never from the current Exercise Catalog, Workout Planner, Profile,
or recorded body weight. A completed workout whose exercise definition or planned
workout was deleted is therefore fully correctable, and nothing deleted is
recreated.

## Why the domain is unchanged

`WorkoutSession` has no mutators. Every existing mutation reconstructs the
aggregate through its constructors, and those constructors already enforce
everything a correction needs:

| Rule                                                                         | Enforced by                     |
| ---------------------------------------------------------------------------- | ------------------------------- |
| Status stays `completed` and the completion instant is at or after the start | `WorkoutSession.create`         |
| A completed session must retain at least one actual set                      | `WorkoutSession.create`         |
| Set positions are contiguous from zero and identifiers are unique            | `WorkoutSessionExercise.create` |
| A result must match the captured logging mode                                | `WorkoutSessionExercise.create` |
| At most one hundred sets per exercise                                        | `WorkoutSessionExercise.create` |
| Snapshots are revalidated on every reconstruction                            | both constructors               |

Correction builds the corrected aggregate by spreading the loaded one, so no code
path exists that could change a lifecycle field or a snapshot. Adding a mutating
method to express this one case would open a general mutation surface in order to
restate rules the constructors already hold.

## Why `correctCompleted` is separate from `replace`

`replace` updates the parent row's name, status, and completion timestamp before
rewriting children. It is correct for an active session and wrong as a correction
path, because a correction must not be able to touch a parent lifecycle column at
all.

`correctCompleted` therefore confirms that the stored row is still completed with
the same start and completion instants, and then rewrites only child rows. The
active-only lifecycle guard on ordinary session mutation is untouched, `replace`
keeps its single active-session caller, and active-workout screens cannot reach
completed records.

The contract's guarantee is mechanical rather than product-shaped: it rewrites
the complete child set of a completed workout under a verified unchanged parent
lifecycle. Completed session exercise removal depends on the same guarantee, so
the method has two callers whose product intents differ while their write is
identical. Which children the rebuilt aggregate holds stays application policy
inside each `workout-history` use case.

## Transaction shape

One exclusive transaction per correction:

1. Reload the session inside the transaction.
2. Refuse if it is missing or no longer completed.
3. Locate the target exercise, and the target set for an edit or a delete.
4. Compare the canonical values the screen loaded against what is stored.
5. Reconstruct through the domain constructors; refuse on any rejection.
6. Persist through `correctCompleted`.
7. Commit.

Children are deleted before their parents and inserted parents-first. The
transaction connection runs with foreign keys off and cannot enable them once the
transaction has begun, so `ON DELETE CASCADE` would leave orphaned
`workout_session_exercise` and `workout_set` rows that no read path can see.
Deleting all children before re-inserting them also means the
`UNIQUE(workout_session_exercise_id, position)` constraint is never transiently
violated while positions are renumbered.

Either the whole correction commits or the previous completed history survives
untouched.

## Set identity and ordering

Editing keeps the set identifier and its position and replaces only the result.
Adding mints one new identifier at the next position. Deleting removes one set and
renumbers the survivors to contiguous positions while preserving their
identifiers. Child rows are rewritten with the same identifier values, so identity
survives the delete-and-reinsert.

Display order comes from the stored position, and every read already orders by
exercise position then set position. No identifier reaches the interface, an
error, or a log.

## Stale state without new schema

The correction screen submits the canonical values it loaded for the target set.
The use case compares them against the stored row inside the transaction and
refuses the correction as changed if they differ, so a screen left open while
another correction happened cannot silently overwrite the newer fact. This needs
no timestamp, revision column, or version counter.

The refusals are: the workout no longer exists, it is no longer completed, the
exercise is gone, the set is gone, the set changed, the correction would empty the
workout, the exercise is full, the entered values are invalid, and the correction
could not be saved. Every message is fixed and safe. A recoverable failure keeps
the entered values and the loaded completed detail visible.

## Derived behavior

Nothing derived is persisted, so there is nothing to invalidate.

Personal records recompute on the next read: an overstated record disappears, the
next eligible result takes its place or no record is claimed, and an improved
corrected value becomes the record. The earliest-occurrence tie rule and the
unsupported treatment of assistance are unchanged, and evidence keeps pointing at
the corrected workout and set. The correction screen performs no record
comparison and shows no record messaging.

Progress recomputes actual set counts, repetitions, duration, distance, eligible
recorded load volume, performed exercise counts, and the per-day breakdown. The
completed workout count and elapsed workout time do not change, because only
children were corrected. Deleting every set of one exercise truthfully removes
that exercise from performed counts while its planned context stays visible, and
that exercise can then be
[removed from the workout](completed-session-exercise-removal.md).

Export carries corrected values in format version 1 with no contract change,
restore parses a corrected export unchanged, replacement restores it atomically,
and erasure removes corrected history like any other.

## Experience and accessibility

Each recorded set on the completed workout screen offers "Correct recorded set"
and "Delete recorded set"; each exercise offers "Add missing set". Editing and
adding open a dedicated screen so the completed detail stays visibly historical,
without a finish, discard, resume, or reorder control. The removal and
add-exercise controls it does carry act on completed history alone, never on an
active workout, and adding opens its own screen for the same reason correction
does.

The correction screen separates the planned target as captured, the result as
currently recorded, and the editable fields, and states plainly that correction
changes what was recorded, that records and progress may change, that the workout
stays completed, and that captured exercise and plan context are unchanged.
Saving is explicit; deleting is confirmed; deletion that would empty the workout
is refused in words that point at
[deleting the whole workout](completed-workout-deletion.md) instead.

Controls carry full accessible labels naming the set and the captured exercise.
Units are spoken as words, validation errors are associated with their field and
announced, nothing depends on color or an icon, and the vertical layout survives
large Dynamic Type without horizontal scrolling.

The consequence card is one accessibility element, so its accessible name carries
the paragraph it displays rather than only the title `What this correction
changes` — the sentence a person is asked to accept was otherwise unspoken. The
summary card on the completed detail carries its actual set count and workout time
by the same rule. See
[Specification 0034](../../specs/0034-announced-card-contents.md) and
[ADR 0024](../decisions/0024-labelled-containers-announce-their-contents.md).

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, external service, or new
dependency. All SQL is parameter-bound. No exercise name, result, date,
identifier, or correction is logged, and no before-and-after value is recorded.

A completed aggregate holds at most one hundred exercises of one hundred sets, so
one correction is a bounded child rewrite in a short transaction — the same work
`replace` already does on every active set edit. Derived reads stay
constant-query. No index, migration, background worker, or persisted summary was
added, and the schema stays at user version 11.

No audit trail exists. The previous value is not retained and the application
never claims it is. [ADR 0018](../decisions/0018-explicit-completed-workout-correction.md)
records why.
