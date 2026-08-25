# Specification 0026: Completed workout exercise addition

> Testing-policy note: automated simulator, sprint-suite, and regression-suite
> requirements in this historical specification were superseded by
> [ADR 0033](../docs/decisions/0033-risk-based-manual-device-testing.md).
> Use command-line Jest/Vitest checks plus risk-based manual device testing.

- Status: Approved
- Date: 2026-08-15

## Objective and scope

Let a person add exactly one session exercise, with the first set it recorded, to
a completed Workout, so work that was performed but never logged can be entered
where it happened instead of being invented as a second Workout that never took
place. Version 1 appends one `workout_session_exercise` row holding exactly one
`workout_set` row, captures the exercise name, logging mode, and source
identifier as a fresh snapshot at the moment of addition, captures no planned
prescription, and writes it child-first inside one exclusive transaction after an
explicit save.

Everything derived from history — per-exercise history, personal records,
progress summaries, the performed-exercise list, and export — recomputes from the
new facts because none of it is persisted.

Reordering completed exercises, inserting at a chosen position, editing a
captured exercise name, logging mode, or planned prescription, attaching a
planned prescription to an added exercise, creating a Catalog definition from
this screen, bulk addition, reverting a completed Workout to active, undo, audit
history, backdating a set to a different Workout, moving work between Workouts,
and any export-format change are excluded.

## The problem

Every corrective act the product offers subtracts. Specification 0023 made
recorded sets correctable and deletable, Specification 0024 made one whole
completed Workout deletable, and Specification 0025 made one completed session
exercise removable. The only additive act is "add a missing set", and it can only
reach an exercise the session already holds.

A person who finished a Workout before logging an exercise therefore has no
remedy inside that Workout. The workaround is to record a second Workout for work
that belongs to the first, and the product cannot detect it afterwards. That
inflates the completed Workout count and elapsed Workout time, splits one
session's evidence across two occurrences, and corrupts exactly the derived
claims Sprints 22 through 25 worked to keep honest.

Addition is also the last operation needed before the correction lifecycle is
complete, which matters before further derived features are built on top of it.

## Historical authority

Completed history stays the sole authority for what is displayed, summarized,
ranked, and exported. Authoritative does not mean incapable of deliberate
owner-directed extension.

A **silent addition** is forbidden. No Exercise Catalog change, Workout Planner
change, Profile change, migration, background task, derived reader, failed
correction, failed removal, failed deletion, failed export, failed restore,
failed replacement, or application start may add a session exercise.

An **explicit addition** is what this specification adds: a person opens one
completed Workout, chooses "Add Exercise To This Workout", selects a definition
from the Exercise Catalog, records what they performed, and saves.

The interface says "Add exercise to this workout" and "Record what you
performed". It never says restore, recover, sync, or fix, and it never implies
the application knows the work happened. It is the person's claim about their own
Workout, and the wording says so.

## The snapshot question

[ADR 0008](../docs/decisions/0008-historical-workout-session-snapshots.md)
requires history to snapshot an exercise's name, logging mode, and planned
prescription "when they enter the session", and forbids history from joining
mutable Catalog or Planner rows to interpret work it already recorded.

Addition respects both halves. It reads the Catalog for exactly one purpose: to
mint a **new** snapshot for an exercise entering the session at the moment the
person says it entered. No existing snapshot is re-read, re-derived, or
revalidated against current Catalog state, and no session row gains a foreign key.
This is the same act `WorkoutSessionMutationUseCases.addExercise` performs on an
active session; only the parent's status differs.

One consequence is stated rather than hidden: the captured name is the
definition's name **today**, while the work happened earlier. If the definition
was renamed after the Workout was completed, the added exercise carries today's
name, because that is the name the person selected and confirmed, and the product
must not claim to know what it was called then. Renaming or deleting the
definition afterwards never touches the captured snapshot — the source identifier
is non-relational provenance, exactly as it is for every other session exercise.
A definition deleted while the screen is open refuses the addition rather than
inventing a name.

[ADR 0021](../docs/decisions/0021-completed-workout-exercise-addition.md) records
what this decision adds to historical authority, because ADR 0018 stated that
exercises are neither added nor removed and ADR 0020 amended that for removal
only.

## Addition authority

Addition affects exactly one new `workout_session_exercise` row and the one
`workout_set` row it owns.

It does not affect any existing session exercise, its identifier, its position,
or any captured snapshot; the parent `workout_session` row, its status, its start
or completion instant, or its captured local date and offset; any other completed
Workout; an active Workout; Exercise Catalog definitions; Workout Planner
records; the Profile, Goals, Nutrition, Hydration, or body-weight history;
externally saved exports; or the schema and migration version.

## The first recorded set

An added exercise carries at least one recorded set, captured in the same action.

A completed Workout that gained an exercise recording nothing would recreate
precisely the state Specification 0025 closed: a row that occupies a position,
displays no result, contributes to no performed count, and ships inside every
version-1 export. It would also assert work the person never described. The
requirement is structural rather than validated — the result is a required input
and the exercise is only ever constructed holding exactly one set — so no code
path can produce an empty added exercise.

## Architecture

```text
CompletedWorkoutScreen
  → Add exercise to this workout
  → CompletedWorkoutExerciseAdditionScreen
      → exercise selection (ExercisePicker)
      → first recorded set (WorkoutSetForm)
      → explicit save
  → AddCompletedWorkoutExerciseUseCase          (workout-history owns the workflow)
  → WorkoutSessionRepository.correctCompleted   (workout-session owns its aggregate)
  → one exclusive SQLite transaction
  → completed session aggregate rebuilt with the new exercise appended
  → refreshed completed detail
```

Workout History owns the workflow, its outcomes, its messages, and the refresh,
because the person starts from completed history and every read model the
addition disturbs belongs to Workout History. Workout Session keeps ownership of
writes to its own aggregate. Composition connects them. Presentation issues no
SQL and there is no generic history repository.

Addition reuses the existing `correctCompleted` contract rather than adding a
fourth repository method, for the reasons
[ADR 0020](../docs/decisions/0020-completed-session-exercise-removal.md) already
recorded for removal: the contract already confirms the stored row is still
completed with the same start and completion instants and then rewrites the
complete child set of that Workout, deleting every child before inserting any; it
holds no statement that can reach the parent row; and a new method would
duplicate the delete-before-insert ordering that exists specifically because
foreign keys are off inside the exclusive transaction. Duplicating that ordering
is the real risk. What the rebuilt aggregate holds is application policy, and it
lives in the use case for addition exactly as it lives there for correction and
removal: the repository contract validates lifecycle, not intent.

The contract's documentation is corrected in the same change, because a contract
whose stated purpose no longer matches its use is a defect. It now names three
callers.

The Exercise Catalog enters a Workout History use case for the first time, as one
transaction-context member on one workflow, for one purpose. Composition wires
`ExerciseCatalogSqliteRepository` into the addition runner and a
`BrowseExercisesUseCase` for the picker. No history read model gains a Catalog
dependency, and no captured snapshot is ever reinterpreted through it.

`@fitness/domain` is unchanged. The aggregate already expresses a completed
Workout holding one more exercise through the same reconstruction every other
mutation uses, and its constructors already enforce every rule addition needs:

| Rule                                                                 | Enforced by                     |
| -------------------------------------------------------------------- | ------------------------------- |
| Exercise positions are contiguous from zero                          | `WorkoutSession.create`         |
| Exercise identifiers are unique                                      | `WorkoutSession.create`         |
| At most one hundred exercises                                        | `WorkoutSession.create`         |
| Status, start, and completion instants are carried through untouched | `WorkoutSession.create`         |
| The captured snapshot is valid and the name is bounded               | `WorkoutSessionExercise.create` |
| The result matches the captured logging mode                         | `WorkoutSessionExercise.create` |
| Set positions stay contiguous and identifiers unique                 | `WorkoutSessionExercise.create` |

## Transaction and verification

Every addition runs inside one exclusive transaction:

1. Validate the session identifier.
2. Validate the exercise definition identifier.
3. Reload the stored session inside the transaction.
4. Refuse if it is missing.
5. Refuse if it is not completed.
6. Refuse if its start or completion instant differs from what the screen loaded.
7. Refuse if the Workout already holds the maximum number of exercises, before
   the Catalog is read and before anything is written.
8. Read the selected definition from the Exercise Catalog; refuse if it is gone.
9. Build the first recorded set at position zero.
10. Build the new session exercise at the next position, holding that one set,
    with the freshly captured name, logging mode, and source definition
    identifier, no planned prescription, and no source planned exercise.
11. Rebuild the session from the loaded one with the new exercise appended, so no
    lifecycle field and no existing snapshot can change.
12. Persist through `correctCompleted`, which deletes every `workout_set` row of
    the Workout, then every `workout_session_exercise` row, then inserts every
    exercise and its sets in stored order.
13. Commit.

Children are deleted before their parents because the transaction connection runs
with foreign keys off and cannot enable them once the transaction has begun, so
the `ON DELETE CASCADE` declared on both child tables would leave orphaned rows
that no read path can see. Deleting every child before inserting any also means
`UNIQUE(workout_session_id, position)` is never transiently violated. Every
statement is parameter-bound.

Aggregate reconstruction is the verification: a wrong position, a duplicate
identifier, an incompatible result, or a lost set fails construction and aborts
the transaction rather than writing a bad row. A failure at any step rolls back
everything and the complete prior aggregate survives, so neither the exercise nor
its set exists. A refusal writes nothing at all.

## Position, order, and identity

The added exercise takes the last position. Every existing exercise keeps its
identifier, its position, its captured name, logging mode, planned prescription
snapshot, source identifiers, and every set it owns. Nothing is renumbered, which
is strictly less disturbance than a removal performs.

Insertion by time is not deferred, it is underivable: a `WorkoutSet` carries no
timestamp, so no stored fact orders one set against another inside a Workout.
Stored order is therefore a stored order and not a chronological claim, and the
interface never presents it as one. This is unchanged by addition — a planned
Workout's order was always the plan's order rather than the order performed.

Both limits are enforced. The use case refuses at
`workoutSessionPolicy.maximumExercises`, the aggregate rejects more than one
hundred exercises, and `CHECK (position BETWEEN 0 AND 99)` backs both. Display
order comes from the stored position, and every read orders by exercise position
then set position. No identifier reaches the interface, an error, or a log.

## Stale state

The completed detail and the addition screen may stay open while other local data
changes. The screen submits the start and completion instants it loaded, and the
use case compares them against the stored row inside the transaction.

An already-deleted, erased, or replaced-away Workout is refused as no longer
available. A row that is unexpectedly active is refused as no longer completed
history. Lifecycle instants that differ from the loaded ones are refused as
changed, rather than appending to whatever aggregate now holds that identifier. A
definition deleted from the Catalog while the picker was open is refused as no
longer in the exercise library.

Duplicate submission needs more care here than it did for removal. A second
removal finds its target gone and refuses; a second addition would happily append
a second exercise, because nothing about an addition is idempotent. The save
control is therefore disabled while a write is in flight, the screen guards the
call itself, and success leaves the screen immediately. Restoring an older export
can reintroduce the same identifiers with the same instants, which the comparison
cannot distinguish; that is accepted, as it is for removal.

## Refusing a full workout

A Workout already holding the maximum number of exercises cannot accept another.
The completed detail states that in words in place of the control, rather than
showing a control that looks available and does nothing, and the same sentence is
the refusal a stale screen receives.

## Confirmation and experience

Addition changes authoritative history but destroys nothing, so it saves
explicitly instead of asking for a destructive confirmation. That is the
treatment the repository already gives the one additive act it has — adding a
missing set — and using a destructive alert here would teach people that additive
and destructive acts look alike, devaluing the three real destructive
confirmations on the neighbouring screen.

The completed detail carries one entry point, in its own section after the
exercise list and before "Delete this workout", so the additive act sits above
the destructive one. The addition screen states what will change before anything
is saved: this Workout will hold the exercise and the set being entered now,
personal records and progress may change, the Workout stays completed, and the
exercises already in it keep their recorded sets and captured details.

Selection and the first recorded set live on one screen. The existing add-set
route is keyed by a session exercise identifier that does not exist yet, and
creating the exercise first and its set afterwards would be two writes with an
empty exercise in between. The picker is the one the active Workout already uses,
with wording of its own; it offers no way to create a Catalog definition.

After a successful addition the completed detail refreshes in place with the new
exercise last, because the Workout still exists and navigating away from it would
be wrong. A refusal keeps the screen, announces one fixed sentence politely, and
preserves the entered values.

The completed detail stays historical. It gains no finish, discard, resume, or
reorder control, and addition is unreachable from every active Workout screen.

## Errors

The refusals are: the Workout is no longer available, it is no longer completed
history, the Workout changed since the screen opened, the exercise is no longer
in the exercise library, the entered values do not match how the exercise is
recorded, and the Workout already holds the most exercises it can keep. One
further fixed sentence covers an addition that could not be saved. Each message
is fixed; none exposes SQL, a table name, an identifier, an exercise name, a
recorded value, a date, an internal path, or a stack trace.

## Derived behavior

Nothing derived is persisted, so nothing is invalidated, incremented, or
recomputed in the background.

The exercise appears last on the completed detail with its recorded set. The
Workout's actual set count, performed exercise count, repetitions, duration,
distance, and eligible recorded load volume recompute. The completed Workout
count and elapsed Workout duration do not change, because only children changed,
and Workout History keeps its keyset pagination stable because no session row is
written.

Personal records recompute on the next read: the added result may establish or
replace a record, with evidence pointing at this Workout and its captured start
instant. The earliest-occurrence tie rule and the unsupported treatment of
assistance are unchanged.

The occurrence appears in per-exercise history at the Workout's **captured**
date rather than today's, which is the entire point of the sprint. An exercise
never performed before joins the performed-exercise list and becomes eligible for
the picker's recents.

The next version-1 export includes the added work with no contract change.
Externally saved exports are unchanged, and restoring or replacing with an older
export truthfully drops it. Local erasure and safe replacement are unchanged.

## Accessibility

Screens use the design-system public API, native heading roles, Dynamic Type,
minimum touch targets, and vertical layout that does not scroll horizontally. The
entry point carries an explicit text label naming the Workout and its captured
date. The selected exercise is named in text before its set form. No meaning
depends on an icon or a color. Validation errors are announced and associated
with the field that produced them by the shared set form. The full-workout
refusal is text rather than a dead control. After an addition the detail
announces the change politely and focus stays on valid completed detail content.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, external service, or new
dependency. All SQL is parameter-bound. No exercise name, result, date,
identifier, or addition is logged, no hidden backup is written, and no addition
reason is stored. QA uses synthetic data only.

A completed aggregate holds at most one hundred exercises of one hundred sets, so
one addition is a bounded child rewrite inside a short transaction — the same
work a set correction already does — plus one indexed Catalog read. Derived reads
stay constant-query. No index, background worker, or persisted summary is added.

## Migration and dependencies

None. The schema stays at user version 11 and no column, table, trigger, index,
or constraint is added or removed. No dependency changes.

## Verification and completion

Application tests cover a successful addition and its appended position,
preserved existing identifiers, positions, and snapshots, a snapshot captured
from the selected definition at that moment, no planned prescription captured, a
result incompatible with the captured logging mode refused, a non-repetition
logging mode accepted, an addition beyond the maximum refused without reading the
Catalog, a missing Workout, an active Workout, a missing definition, invalid
identifiers, stale lifecycle instants, a repeated submission appending rather
than replacing, and history preserved after a failed write.

Persistence tests run on a real SQLite engine and cover the appended exercise and
its set, untouched existing rows, a snapshot captured from the definition as it
stands at that moment, an untouched parent row and lifecycle instants, other
Workouts unchanged, absent orphan rows, child-first write order with no parent
write, bound parameters, rollback after a forced child delete failure, rollback
after a forced insert failure, the full-Workout refusal writing nothing, a
definition deleted mid-flow refused, stale lifecycle refused, recomputed progress
with an unchanged Workout count and elapsed time, a record claimed from the added
evidence, a new occurrence at the captured date, the performed-exercise list
joined, and an unchanged schema version.

Presentation tests cover the entry point appearing only when completed history
offers it, the full-Workout refusal stated in words, the picker reaching the
Catalog, the first recorded set required, the explanation of what changes,
changing the selection without adding anything, a successful addition with its
submitted lifecycle and result, a refusal keeping the entered values, a safe
failure message, and a single submission while a write is in flight.

Sprint 26 adds a Maestro suite that completes a Workout, verifies the completed
detail offers addition and stays historical, cancels an addition, adds an
exercise with one recorded set and verifies it appears last, verifies progress
and personal records follow the added evidence, corrects and removes the added
exercise, and survives a relaunch, and it enters the stable regression suite.
Merge readiness requires:

```bash
./scripts/qa.sh sprint 26 --platform ios
./scripts/qa.sh regression --platform ios
```

Addition to a Workout holding several exercises, addition of an exercise already
present in the same Workout, addition using a definition renamed after the
Workout was completed, a definition deleted mid-flow, every logging mode, both
unit systems, export, restore, replacement, and erasure after an addition, stale
correction, removal, and deletion screens, interrupted transactions, large
Dynamic Type, VoiceOver, TalkBack, and keyboard behavior remain targeted manual
QA.

## Explicit exclusions

Reordering completed exercises; inserting at a chosen position; editing a
captured exercise name, logging mode, or planned prescription; attaching a
planned prescription to an added exercise; creating Catalog definitions from
completed history; bulk or multi-select addition; reverting a completed Workout
to active; undo; trash; archive; audit history; backdating a set to a different
Workout; moving work between Workouts; export format version 2; migrations; new
personal record categories; charts; Progress redesign; authentication; backend
endpoints; AI; notifications; cloud synchronization; and dependency upgrades are
excluded.

The repository owner approved the Stage 1 design and authorized staged
implementation on `feat/completed-workout-exercise-addition` on 2026-08-15.

## Amendment: the consequence card announces its contents

The card stating what the addition changes carries an `accessibilityLabel`, which
makes it one accessibility element, so its paragraph reached no screen reader. Its
accessible name now carries the paragraph it renders. No displayed value or
sentence changed. See [Specification 0034](0034-announced-card-contents.md) and
[ADR 0024](../docs/decisions/0024-labelled-containers-announce-their-contents.md).
