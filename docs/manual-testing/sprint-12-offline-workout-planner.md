# Sprint 12 manual QA: Offline workout planner

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, app build, schema origin (fresh or upgraded from 7), and result
for every item. A failure blocks merge readiness; fix it, rerun relevant automated
checks, and repeat the affected items.

## Core workflow

| Check             | Steps                                                          | Expected result                                         | Why it matters                                               |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| Existing launch   | Launch an existing Sprint 11 installation and a fresh install. | Both reach the app without startup or migration errors. | Proves upgrade and clean initialization safety.              |
| Workout tab       | Open Workout.                                                  | Weekly plan and Exercise Library entry are clear.       | Preserves catalog access while introducing Planner.          |
| Week order        | Read every day from top to bottom.                             | Sunday through Saturday appears exactly once in order.  | Prevents locale and off-by-one scheduling defects.           |
| Monday workout    | Open Monday, name it Push Day, save, and reopen.               | Monday shows Push Day and the editor retains it.        | Verifies Rest-to-workout creation and persistence.           |
| Tuesday workout   | Create Pull Day on Tuesday.                                    | Tuesday independently shows Pull Day.                   | Proves weekday uniqueness and isolation.                     |
| Wednesday workout | Create Leg Day on Wednesday.                                   | Wednesday independently shows Leg Day.                  | Exercises another recurring-day write.                       |
| Thursday Rest     | Leave Thursday unchanged or convert it to Rest.                | Rest is explicit and is not an empty fake workout.      | Verifies the day-state model.                                |
| Empty workout     | Save a valid name with no exercises.                           | The named zero-exercise workout persists.               | Supports incremental planning without placeholder exercises. |
| Delete workout    | Change an existing empty workout to Rest and confirm.          | The workout disappears and Rest returns.                | Verifies deliberate aggregate deletion.                      |

## Prescriptions and ordering

| Check                 | Steps                                                                   | Expected result                                                       | Why it matters                                            |
| --------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| Weighted exercise     | Add Barbell Bench Press; enter 4 sets, 8 reps, 60 kg.                   | Only sets, reps, and planned weight appear and persist.               | Verifies resistance prescription semantics.               |
| Reps only             | Add Push-up and inspect fields.                                         | Sets and reps appear; weight, distance, and duration do not.          | Prevents irrelevant nullable-form behavior.               |
| Duration              | Add Plank; enter 3 sets and 45 seconds.                                 | Duration unit is explicit and 3 × 45 sec persists.                    | Verifies canonical Duration reuse.                        |
| Distance              | Add a distance-mode exercise and enter a target.                        | Sets and preferred distance unit appear without reps or duration.     | Verifies distance-only discrimination.                    |
| Distance + duration   | Add Treadmill in the combined mode; enter 1 set, 5 km, 30 minutes.      | Both applicable fields persist and no weight/reps fields appear.      | Verifies the combined prescription shape.                 |
| Assistance            | Add Assisted Pull-up; enter 3 × 8 with assistance.                      | The field says Assistance amount, not generic load.                   | Preserves distinct resistance meaning.                    |
| Optional resistance   | Clear resistance while retaining valid sets/reps and save.              | The plan saves without inventing zero load.                           | Distinguishes omitted targets from zero.                  |
| Invalid targets       | Try zero, negative, nonnumeric, nonfinite/pasted, and excessive values. | Save is blocked with safe field feedback.                             | Defends domain and storage integrity.                     |
| Multiple exercises    | Add at least three different exercises.                                 | All remain independent and ordered.                                   | Exercises aggregate child persistence.                    |
| Move controls         | Move the last exercise up twice, save, restart, and reopen.             | New order persists; unavailable moves are disabled.                   | Verifies atomic contiguous ordering.                      |
| Reorder accessibility | Read move controls with VoiceOver/TalkBack and operate them.            | Labels name the exercise and direction; focus remains understandable. | Ensures nonvisual ordering is usable.                     |
| Edit target           | Change Bench Press to 5 × 5 and save.                                   | Only that occurrence changes.                                         | Verifies stable child edit identity.                      |
| Remove exercise       | Remove one planned item and save.                                       | The workout persists without that item.                               | Verifies deliberate child removal.                        |
| Duplicate exercise    | Add Bench Press a second time, cancel once, then confirm.               | Cancel adds nothing; confirmation creates an independent occurrence.  | Allows unusual programming without accidental duplicates. |

## Destructive and catalog lifecycle

| Check                 | Steps                                                                 | Expected result                                                 | Why it matters                                      |
| --------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| Workout to Rest       | Choose Change to Rest on a populated workout.                         | Confirmation names the workout impact before deletion.          | Prevents accidental plan loss.                      |
| Cancel Rest           | Cancel that confirmation.                                             | Workout and all targets remain unchanged.                       | Confirms cancellation is safe.                      |
| Confirm Rest          | Repeat and confirm.                                                   | Workout children are removed atomically and the day shows Rest. | Verifies owned-child cleanup without partial state. |
| Rest to workout       | Open the Rest day, configure a new workout, and save.                 | A fresh independent workout is created.                         | Verifies reversible day-state transitions.          |
| Catalog rename        | Rename an exercise referenced by a plan.                              | The plan shows the new name with the same target.               | Confirms mutable plan reference semantics.          |
| Referenced delete     | Attempt to delete a referenced definition.                            | Deletion is blocked and affected day/workout is named.          | Prevents dangling references and silent cascades.   |
| Referenced mode edit  | Attempt to change its logging mode.                                   | Edit is blocked and affected plan usage is explained.           | Prevents prescription reinterpretation.             |
| Non-mode catalog edit | Change muscle group, notes, or valid equipment without changing mode. | Edit succeeds and the plan remains valid.                       | Ensures protection is no broader than necessary.    |
| Unreferenced delete   | Remove all plan occurrences, then delete the definition.              | Hard deletion succeeds.                                         | Confirms the retained catalog lifecycle.            |

## Persistence, units, offline, and regressions

| Check              | Steps                                                                       | Expected result                                                         | Why it matters                                 |
| ------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| Restart            | Force-close and relaunch after configuring the week.                        | Names, targets, duplicates, and order persist.                          | Proves durable local storage.                  |
| Airplane mode      | Enable airplane mode and view/create/edit/remove/reorder plans.             | Every Planner and picker operation succeeds.                            | Confirms no network dependency.                |
| Cold offline start | Terminate offline, then relaunch.                                           | Migration gate and weekly plan load normally.                           | Verifies offline startup availability.         |
| Metric units       | Select metric profile units and edit weight/distance targets.               | UI uses kg/km; saved meaning remains correct.                           | Verifies canonical conversion presentation.    |
| Imperial units     | Select imperial profile units and reopen the same targets.                  | UI uses lb/mi with equivalent values; saving does not drift materially. | Prevents duplicate or lossy unit semantics.    |
| Light mode         | Exercise overview, picker, editor, errors, and confirmations in light mode. | Text, borders, focus, and states remain legible.                        | Verifies semantic theme use.                   |
| Dark mode          | Repeat in dark mode.                                                        | Content remains legible without color-only state.                       | Verifies dark semantic roles.                  |
| Large Dynamic Type | Use the largest practical text size.                                        | Content scrolls; labels/actions are not clipped.                        | Verifies scalable layouts.                     |
| VoiceOver          | Complete create, target edit, reorder, removal, and Rest cancellation.      | Names, states, units, errors, and outcomes are announced.               | Verifies iOS screen-reader usability.          |
| TalkBack           | Repeat on Android where available.                                          | Semantics and focus remain understandable.                              | Verifies Android screen-reader usability.      |
| Keyboard           | Navigate and edit with hardware keyboard where available.                   | Focus order is logical and all actions are operable.                    | Verifies non-touch interaction.                |
| iOS                | Complete the principal workflow on iOS.                                     | Persistence, keyboard, alerts, and accessibility behave correctly.      | Covers native SQLite and platform UI behavior. |
| Android            | Complete it on Android where available.                                     | Behavior matches approved semantics.                                    | Covers the second supported native platform.   |
| Exercise Catalog   | Search, favorite, create, edit, and delete an unreferenced exercise.        | Existing catalog behavior remains intact.                               | Guards the directly modified capability.       |
| Hydration          | Log, edit, delete, and restart with hydration data.                         | Hydration remains correct.                                              | Guards migration and persistence regressions.  |
| Nutrition          | Log and edit diary/catalog items and restart.                               | Nutrition remains correct.                                              | Guards shared persistence initialization.      |
| Profile            | Load, edit, and save profile/unit preference.                               | Profile remains correct and Planner follows preference.                 | Guards the unit-source capability.             |
| Goals              | Load and edit Goals & Energy.                                               | Existing calculations and storage remain correct.                       | Guards broader mobile regression.              |
