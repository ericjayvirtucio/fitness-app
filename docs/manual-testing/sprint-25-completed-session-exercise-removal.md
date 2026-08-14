# Sprint 25 manual QA: Completed session exercise removal

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the offered
control, cancellation, single removal, progress recomputation, record
recomputation, only-exercise refusal, and relaunch behavior that the Sprint 25
Maestro suite already automates.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture                | How to produce it                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Three-exercise workout | One completed workout holding three exercises, each with recorded sets.                                                             |
| Duplicated exercise    | One completed workout holding the same catalog exercise twice.                                                                      |
| Emptied exercise       | A completed workout where every set of one exercise was corrected away, beside a performed one.                                     |
| Only exercise          | A completed workout holding exactly one exercise.                                                                                   |
| Only performing        | A completed workout where one exercise holds every recorded set and the others hold none.                                           |
| Record-setting work    | A completed exercise holding the best recorded result, with a weaker result in another workout.                                     |
| Only evidence          | A completed exercise holding the only performed sets of one catalog definition.                                                     |
| Deleted definition     | A completed workout whose Exercise Library definition is deleted afterwards.                                                        |
| Deleted planned source | A completed workout started from a plan whose planned workout is deleted afterwards.                                                |
| Every logging mode     | Completed workouts covering reps, weight + reps, bodyweight, added weight, assistance, duration, distance, and distance + duration. |
| Active workout         | A workout in progress, left unfinished.                                                                                             |
| Export file            | An export created before a removal, kept for the restore and replacement checks.                                                    |

## Removal behavior

| Check                  | Steps                                                                                                        | Expected result                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| One among several      | Remove the middle exercise of the three-exercise fixture.                                                    | Only that exercise and its sets disappear. The other two keep their names, planned context, and sets.       |
| Surviving order        | Reopen the same workout after that removal.                                                                  | The survivors are listed in their original order and their set numbering is unchanged.                      |
| Duplicated exercise    | Remove one of two identically named exercises.                                                               | The one named by the confirmation goes and the other keeps its own recorded sets.                           |
| Emptied exercise       | Remove the exercise whose sets were all corrected away.                                                      | It disappears with its planned context, and no recorded result anywhere changes.                            |
| Only exercise          | Open the only-exercise fixture.                                                                              | The removal control is replaced by a sentence pointing at deleting the whole workout.                       |
| Only performing        | Try to remove the exercise holding every recorded set.                                                       | The same refusal in words, while the exercises holding nothing stay removable.                              |
| Deleted definition     | Remove an exercise from the deleted-definition fixture.                                                      | The removal succeeds and the Exercise Library is not changed or repopulated.                                |
| Deleted planned source | Remove an exercise from the deleted-planned-source fixture.                                                  | The removal succeeds and the Workout Planner is untouched.                                                  |
| Every logging mode     | Remove one exercise in each logging-mode fixture.                                                            | Each removal states the right recorded set count and leaves the other modes untouched.                      |
| Both unit systems      | Repeat one removal with metric and then with imperial preferences.                                           | Displayed values follow the preference; nothing stored or removed differs.                                  |
| Cancellation           | Open the confirmation and cancel.                                                                            | The exercise, its sets, and every derived value are unchanged.                                              |
| Duplicate request      | Confirm a removal, then immediately try the same removal again.                                              | Only one removal happens. The second attempt finds the control disabled or reports the exercise gone.       |
| Active session refused | With an active workout in progress, look for completed-removal paths on it.                                  | The active workout screen offers its own remove control only, and completed history is unreachable from it. |
| Nothing else removed   | After each removal, review Exercise Library, Planner, Profile, Goals, Nutrition, Hydration, and body weight. | Every one is unchanged.                                                                                     |

## Confirmation and copy

| Check               | Steps                                                          | Expected result                                                                                                                       |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Names the exercise  | Open the confirmation.                                         | It names the captured exercise, states how many recorded sets go, says the rest of the workout is kept, and says it cannot be undone. |
| Counts truthfully   | Open it for exercises with one, several, and no recorded sets. | The count matches what the detail shows, and the no-set case says no recorded result is lost.                                         |
| No recovery claimed | Read every removal surface.                                    | Nothing offers undo, trash, archive, restore, or a hidden copy, and nothing says the action is reversible.                            |
| Honest verbs        | Read every removal surface.                                    | It says remove. It never says clean up, hide, archive, remove from view, or reset.                                                    |
| Nothing sensitive   | Read the confirmation and any failure.                         | No identifier, recorded value, exercise name, file path, or SQL appears in a failure message.                                         |
| Empty-exercise copy | Open a workout holding an exercise with no sets.               | It says the exercise recorded nothing and offers both adding a missing set and removing it.                                           |

## Derived behavior

| Check                | Steps                                                            | Expected result                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workout totals       | Compare the completed detail before and after a removal.         | The actual set count follows the survivors and the workout time is unchanged.                                                                     |
| Progress             | Compare Day, Week, and Month summaries before and after.         | Sets, performed exercises, repetitions, duration, distance, and volume follow the remaining facts, and the completed workout count does not move. |
| Personal records     | Remove the record-setting exercise.                              | The record becomes the next eligible result and its evidence opens work that still exists.                                                        |
| No successor         | Remove the only-evidence exercise.                               | No record is claimed for that definition, and it leaves the performed-exercise list.                                                              |
| Per-exercise history | Open the performance history of a removed exercise's definition. | The removed occurrence is gone and the remaining ones are unchanged.                                                                              |
| Export after removal | Create an export after a removal.                                | The file omits the exercise and its sets and still declares format version 1.                                                                     |

## Data lifecycle

| Check                 | Steps                                                                            | Expected result                                                                          |
| --------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Older export restored | Erase local data, then restore the pre-removal export.                           | The removed exercise returns, because that file truthfully contains it.                  |
| Older export replaced | Replace local data with the pre-removal export.                                  | The same, in one all-or-nothing operation.                                               |
| Local erasure         | Erase all local data after a removal.                                            | Erasure behaves exactly as before; the removal left nothing behind for it to find.       |
| Relaunch              | Remove an exercise, force-quit, and relaunch.                                    | It is still gone, the survivors keep their order, and no confirmation message reappears. |
| Stale correction      | Open a correction screen, remove that exercise elsewhere, then save.             | The correction is refused in a plain sentence and nothing is written.                    |
| Stale deletion        | Open a completed detail, delete that workout elsewhere, then remove an exercise. | The removal is refused as no longer available and nothing is written.                    |
| Interrupted removal   | Force-quit during the confirmation, and again immediately after confirming.      | Either the whole exercise survives or the whole exercise is gone. Never a partial one.   |

## Accessibility

| Check              | Steps                                          | Expected result                                                                                                                                    |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver          | Reach and operate removal with VoiceOver only. | The control announces which exercise it removes, the alert is reachable, Cancel reads as neutral, and the destructive action reads as destructive. |
| TalkBack           | Repeat on Android.                             | The same, with no unlabelled control.                                                                                                              |
| Duplicate names    | Read two identically named exercises aloud.    | Their removal controls are distinguishable, because each names its displayed position.                                                             |
| Focus after remove | Remove with a screen reader running.           | Focus stays on valid completed detail content and the confirmation is announced.                                                                   |
| Dynamic Type       | Set the largest accessible text size.          | Each exercise card, its explanation, and its control stay readable with no clipping and no horizontal scrolling.                                   |
| Keyboard           | Attach a hardware keyboard.                    | Every removal control is reachable and shows a visible focus state.                                                                                |
| No icon-only       | Inspect the removal surfaces.                  | Nothing depends on an icon or a color alone, and there is no swipe-to-remove.                                                                      |

## Privacy and platform

| Check          | Steps                                     | Expected result                                                       |
| -------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| Offline        | Remove with airplane mode on.             | Everything behaves identically; no request is attempted.              |
| No logging     | Watch the device log during a removal.    | No exercise name, recorded value, date, identifier, or SQL is logged. |
| No permission  | Remove on a fresh install.                | No new permission prompt appears.                                     |
| No hidden copy | Inspect the app sandbox after a removal.  | No backup, trash, or export file was written by the removal.          |
| Synthetic only | Review every artifact produced during QA. | It contains synthetic data only.                                      |
