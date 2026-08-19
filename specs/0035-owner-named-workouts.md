# Specification 0035: Owner-named workouts

- Status: Approved
- Date: 2026-08-18

## Objective and scope

Let a person name the workout they performed, so their history is a record of
their training rather than a list of identical rows.

Every workout started empty is named the string literal `Workout`, and until now
nothing in the application could change that. A workout started from the plan
takes the plan's name; a workout started empty does not.

Version 1 adds one screen, one use case, one repository method, and two entry
controls. A workout of either status can be renamed by its owner. Nothing else
changes.

`@fitness/domain`, `apps/api`, every migration, user version 11, export format
version 1, the restore parser, local erasure, replacement restore, every other
reader contract, every other query, personal record calculation, correction,
removal, addition, deletion, the Exercise Catalog and its filtering, all three
pickers, and the Workout Planner are untouched. No stored result, set, exercise,
position, time, total, record, tie, or evidence link changes.

Editing a completed workout's times or date, reordering its exercises, notes,
tags, RPE, rest timers, set types, charts, Progress redesign, adherence, streaks,
coaching, starter Workout Plans, onboarding, localization, export format changes,
cloud synchronization, authentication, AI, notifications, and dependency upgrades
remain excluded.

## The gap this closes

`StartWorkoutSessionUseCase.executeEmpty` passes the literal `'Workout'` to the
shared `createSession` helper; `executePlanned` passes `details.workout.name` to
the same parameter. The name has always been a parameter. Only the empty path had
nothing to give it, and no workflow could revise it afterwards.

What that costs is already written into the repository:

- Workout History lists rows that differ only by date.
- A personal record announces its evidence as `in Workout`, which names nothing.
- The exercise performance screen announces `Open Workout, <date>, …`.
- Ten end-to-end assertions across two suites and one shared flow match the
  literal, because a constant is a stable matcher.

Nothing is wrong and nothing is unreachable. No recorded value is incorrect, no
total is miscalculated, and every workout can already be opened, corrected, added
to, and deleted. The application records whose workout it was and when, and
declines to let its owner say what it was.

This is one missing capability, not two. A better default name would reduce the
duplicate rows without letting anyone name anything; the default is a separate
product decision and stays out of scope. `PRODUCT.md` claimed the correction
lifecycle was complete with exercise addition. It was not: a workout's identity
was the one thing its owner still could not touch. That sentence is corrected.

## A name is owned, not observed

[ADR 0008](../docs/decisions/0008-historical-workout-session-snapshots.md)
decided that a completed workout captures what it observed, so that a later
catalog or plan edit cannot rewrite history. Every field that decision protects
is a snapshot of another aggregate's attribute: `exercise_name_snapshot`,
`logging_mode_snapshot`, and the planned prescription columns.

A session's own name is not another aggregate's attribute. The schema recorded
that distinction before this sprint: the column is `display_name`, not
`name_snapshot`, and both history readers project it through a live join rather
than reading a stored copy.

```sql
-- workout-history-sqlite-repository.ts
session.display_name AS session_name_snapshot
-- workout-personal-records-sqlite-reader.ts
session.display_name AS session_name_snapshot
```

`WorkoutHistoryListItem.nameSnapshot` and
`ExercisePersonalRecord.occurrence.sessionNameSnapshot` are therefore
projections, not stored snapshots, despite what their names suggest. No table
stores a session-name snapshot anywhere.

**Renaming a completed workout is permitted, and it changes what that workout's
personal records say their evidence is called.** Stated plainly, because it is
surprising: a record set months ago will report the name the workout has now.

That is the smaller of two surprises. Snapshotting the name at completion would
need a new column and a migration, and would produce a workout renamed `Leg Day`
whose record still reports `in Workout`, permanently and with no way to correct
it. A name identifies a workout; it does not describe a moment. Every surface
that shows a workout's name shows the same name.

Renaming is therefore **not correction**. Specification 0023 preserves everything
a completed workout captured, and a rename writes no recorded value, passes
through neither `correctCompleted` nor `replace`, and touches no child row.
[ADR 0025](../docs/decisions/0025-a-workout-name-is-its-owners-label.md) records
the decision and its alternatives.

## Ownership

**The domain is unchanged.** `WorkoutSession` keeps its private constructor and
its single `static create`, and gains no `withName` and no mutator of any kind.
The rename reconstructs the loaded aggregate:

```ts
const renamed = WorkoutSession.create({ ...stored, name: input.name });
```

That is how every other write in this feature already produces a changed session
— `rebuild` for exercises and sets, and `FinishWorkoutSessionUseCase` for
completion — so it duplicates no invariant at the call site and re-runs all of
them. A `withName` would have been this aggregate's first mutator and would still
have had to re-run the same validation.

**The rule is the one the domain and the schema already share.**
`workoutSessionPolicy.maximumNameLength` is 80 and
`workout_session.display_name` already carries
`CHECK (length(trim(display_name)) BETWEEN 1 AND 80)`. **No migration is needed**,
the `CHECK` is neither widened nor relaxed, and the schema stays at user version 11.

**One use case serves both statuses.** `RenameWorkoutSessionUseCase` lives in
`workout-session/application` beside the aggregate and the repository it writes
through. Splitting it by status would have duplicated a guard that differs only
in the value it compares.

**One repository method serves both statuses.** `rename(id, name, expected)`
issues one guarded `UPDATE` against the parent row.
`WorkoutSessionRepository.replace` was unusable: it deletes and reinserts every
child row, so renaming through it would rewrite every recorded set to change a
label. `deleteCompleted` and `discard` stay split because destruction must never
reach the wrong lifecycle; a rename destroys nothing and carries the status it
expects as a bound predicate.

**Naming composes its own root.** `createWorkoutNameUseCases` builds the session
repository alone. Neither the Workout Session nor the Workout History root can
load the other's workout, and widening either would hand an unrelated screen a
reader it has no reason to hold.

## Concurrency and the error model

The lifecycle guard is `WorkoutSessionLifecycle`: the status, the start instant,
and the completion instant the screen actually loaded — never a route parameter.
It is compared inside the transaction and repeated as a bound predicate on the
statement that writes, so a workout finished, discarded, deleted, restored, or
replaced since the screen opened is refused rather than renamed.

When two surfaces show the same workout and one renames it, the second refuses
with `changed` if its lifecycle moved, and otherwise renames from the name it
loaded. The last rename wins; nothing is merged and nothing else is written.

| Case                                     | Outcome                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Empty, whitespace only, or over 80 chars | Refused `invalid-name`. Nothing written. The entered value is kept on screen. |
| Workout no longer exists                 | Refused `not-found`. Nothing written.                                         |
| Identifier is not an identifier          | Refused `not-found` before the transaction opens.                             |
| Status changed since the screen opened   | Refused `changed`. Nothing written.                                           |
| Lifecycle instants moved                 | Refused `changed`. Nothing written.                                           |
| Guarded write matches no row             | Refused `changed`. Nothing written.                                           |
| Write fails                              | The transaction raises; the stored workout is exactly as it was.              |
| Submitted twice                          | The second press is ignored while a write is in flight.                       |

Fixed sentences, in `workout-rename-messages.ts`. None interpolates a name, a
value, a date, an identifier, SQL, a table name, a path, or a stack trace:

- `changed` — `This workout changed since this screen opened. Open it again before renaming it.`
- `invalid-name` — `Enter a workout name of 1 to 80 characters.`
- `not-found` — `This workout is no longer available.`
- write failure — `This workout could not be renamed. Nothing was changed.`

## User-facing behavior

One new screen, at `/workout-session/[id]/name`, reached from the active workout
and from completed history. Both entries push; both return with `router.back()`,
and both screens reload on focus, so a renamed workout is showing its new name
before the person sees it again.

New visible strings:

| String                                                                                                                                     | Where                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `Rename workout`                                                                                                                           | naming screen heading       |
| `This changes what this workout is called everywhere it appears, including its personal records. No recorded set, total, or time changes.` | naming screen explanation   |
| `Workout name`                                                                                                                             | field label, as the Planner |
| `Save Name`                                                                                                                                | naming screen               |
| `Cancel`                                                                                                                                   | naming screen               |
| `Workout unavailable` / `This workout is no longer available.` / `Go Back`                                                                 | naming screen, workout gone |
| `Rename This Workout`                                                                                                                      | both entry controls         |

No existing visible string changes. An empty workout is still called `Workout`
until its owner renames it.

New accessible names:

| Element                      | Announced                                      |
| ---------------------------- | ---------------------------------------------- |
| Active workout entry control | `Rename this workout, Morning workout`         |
| Completed workout entry      | `Rename this workout, Workout, August 8, 2026` |
| Naming screen                | `Rename workout`                               |
| Name field                   | `Workout name`                                 |

The completed entry control matches the wording of its siblings
`Add an exercise to this workout, …` and `Delete this workout, …`.

No existing accessible name's **shape** changes. Nine names interpolate a session
name and now interpolate the chosen one instead of the constant — that is the
point of the sprint, not a regression:

| Surface                                                   | Before                       | After                        |
| --------------------------------------------------------- | ---------------------------- | ---------------------------- |
| `WorkoutHistoryScreen` card                               | `Open Workout, …`            | `Open Leg Day, …`            |
| `ExercisePerformanceHistoryScreen` card                   | `Open Workout, …`            | `Open Leg Day, …`            |
| `describePersonalRecord`                                  | `… in Workout, set 1`        | `… in Leg Day, set 1`        |
| `CompletedWorkoutScreen` add, delete, and rename controls | `…, Workout, August 8, 2026` | `…, Leg Day, August 8, 2026` |
| `CompletedWorkoutScreen` deletion alert title             | `Delete Workout?`            | `Delete Leg Day?`            |

**No labelled card gained a control.** Both entry controls sit outside every
`Card`: the completed one between the subheading and the summary card, the active
one among the whole-workout actions above `Finish Workout`. Sprint 34's guarantee
— 56 card usages, 20 labelled, none containing an interactive child — still holds
and is asserted.

The active control is deliberately not under the heading beside the name it
changes. It was, and the first QA run proved that wrong: the extra row pushed the
set form down far enough that the iOS number pad covered `Save Set`, so all four
Sprint 35 scenarios failed while recording a set, before reaching anything about
naming. Everything above the exercise cards is now byte-identical to what it was,
so the most-used control on the most-used screen sits exactly where it did.
Proximity to the name lost to the recording path, which is the same trade this
sprint refused to make when it declined to ask for a name at start.

## Experience and accessibility

The naming screen is one heading, one explanation, one field, and two buttons, in
a keyboard-aware `Screen`. Focus order follows render order. Both buttons keep
the minimum touch target from `AppButton`; the field keeps it from `TextField`.

A workout name is user-authored free text. It is rendered only through `AppText`
and interpolated only into template literals that become `accessibilityLabel`
strings and one `Alert.alert` title. React Native renders text as text: no
surface parses it as markup, and none uses it as a format string, a selector, or
a query fragment. It never reaches SQL except as a bound parameter, and it never
appears in a refusal sentence.

The field caps entry at 80 characters, matching the domain policy and the schema
`CHECK`, so the length rule is stated by the control rather than discovered by
refusal. Punctuation, emoji, and right-to-left text are stored and rendered
unchanged; length is counted in JavaScript string units by both the domain and
SQLite's `length()`.

At the largest accessible text size an 80-character name wraps and grows taller.
No `numberOfLines` exists anywhere in the application, and no changed surface
constrains height, so nothing truncates.

Interpolating an 80-character name lengthens an announced sentence: the Workout
History card's name reaches roughly 95 characters. Both screen readers interrupt
an utterance on the next swipe, which bounds the cost.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, or dependency. Every value the
rename writes is a bound parameter. No name is logged. Nothing is backed up
anywhere.

The rename is one `SELECT` and one `UPDATE` inside one transaction, on the parent
row only. No read path gains a query or a render: every surface that shows a name
already projected `display_name`, and the naming screen's single read is on a
write path a person opened deliberately.

## Data lifecycle

Export carries `name: session.name` for a completed session and therefore carries
the chosen name. **The export format does not change**: no field is added,
removed, or retyped, and the format stays at version 1. An export taken before a
rename holds the old name, as it holds every other value at the moment it was
taken.

Restore, local erasure, and replacement restore are untouched and read the
renamed workout exactly as they read any other. Correction, removal, addition,
and deletion are untouched; each keeps its own lifecycle guard, and a rename
changes none of the instants those guards compare.

Personal records, their categories, values, ordering, ties, and evidence links
are unchanged. Only the projected name inside a record's sentence changes, as
decided above.

## Verification and completion

Domain, unchanged and proven so: the use case's field-by-field assertion shows a
rename preserves the identifier, status, both instants, the local date, the UTC
offset, both plan sources, and every exercise, set, position, and result.

Application: a rename writes the trimmed name and nothing else; names at 1, 80,
and 81 characters and one that is whitespace only; a missing workout, an invalid
identifier, a status that moved, instants that moved, and a guarded write that
matches no row are each refused with nothing written; a failed write leaves the
stored workout exactly as it was.

Infrastructure: one guarded `UPDATE`, its lifecycle predicate repeated on the
write, no statement touching `workout_set` or `workout_session_exercise`, and
nothing written when no row matches.

Presentation: the screen opens on the name the workout has, guards with the
lifecycle it loaded, states each refusal in its fixed sentence while keeping the
entered value, ignores a repeated submission while a write is in flight, and
offers only a way back when the workout is gone. Both entry controls announce the
name and date they display and appear only where a route offers them.

Regression: the full suite passes unmodified. The only pre-existing files changed
for this specification are repository fakes, which gained the new method.

## Explicit exclusions

Changing the default name for an empty workout; asking for a name when a workout
starts; naming a planned workout differently from the Planner's existing field; a
lint rule forbidding a control inside a labelled `Card`; unit tests for the four
untested Nutrition screens; removing the stale worktree.
