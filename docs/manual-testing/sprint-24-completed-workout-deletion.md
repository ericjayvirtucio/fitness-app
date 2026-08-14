# Sprint 24 manual QA: Completed workout deletion

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the offered
control, cancellation, single deletion, progress recomputation, record
recomputation, relaunch, and empty-history behavior that the Sprint 24 Maestro
suite already automates.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture                | How to produce it                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Several workouts       | Three completed workouts on different days, each holding recorded sets.                                |
| Corrected workout      | A completed workout whose recorded set was corrected first.                                            |
| Record-setting workout | A completed workout holding the best recorded result for one exercise, with a weaker result elsewhere. |
| Only evidence          | A completed workout holding the only performed sets of one exercise.                                   |
| Deleted definition     | A completed workout whose Exercise Library definition is deleted afterwards.                           |
| Deleted planned source | A completed workout started from a plan whose planned workout is deleted afterwards.                   |
| Multi-exercise workout | A completed workout with two exercises, each holding several recorded sets.                            |
| Active workout         | A workout in progress, left unfinished.                                                                |
| Export file            | An export created before a deletion, kept for the restore and replacement checks.                      |

## Deletion behavior

| Check                  | Steps                                                                                                         | Expected result                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| One among several      | Delete the middle workout of the three-workout fixture.                                                       | Only that workout disappears. The other two keep their names, dates, exercises, sets, and durations.       |
| Multi-exercise workout | Delete the multi-exercise fixture.                                                                            | Every exercise and every set goes with it, in one action, with no partial state at any point.              |
| Corrected workout      | Delete the corrected fixture.                                                                                 | It deletes like any other; correction history plays no part.                                               |
| Deleted definition     | Delete the deleted-definition fixture.                                                                        | The deletion succeeds and the Exercise Library is not changed or repopulated.                              |
| Deleted planned source | Delete the deleted-planned-source fixture.                                                                    | The deletion succeeds and the Workout Planner is untouched.                                                |
| Final workout          | Delete the last remaining completed workout.                                                                  | History shows its textual empty state and Progress reports no completed workouts in the period.            |
| Cancellation           | Open the confirmation and cancel.                                                                             | The workout, its sets, and every derived value are unchanged.                                              |
| Duplicate request      | Confirm deletion, then immediately try to delete again.                                                       | Only one deletion happens. The second attempt either finds the control disabled or reports it unavailable. |
| Active session refused | With an active workout in progress, confirm no completed-deletion path reaches it.                            | The active workout screen offers discard only, and completed deletion is unreachable from it.              |
| Nothing else deleted   | After each deletion, review Exercise Library, Planner, Profile, Goals, Nutrition, Hydration, and body weight. | Every one is unchanged.                                                                                    |

## Confirmation and copy

| Check               | Steps                                  | Expected result                                                                                                                    |
| ------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Names the workout   | Open the confirmation.                 | It names the workout and states that its recorded sets go, that records and progress may change, and that nothing else is deleted. |
| No recovery claimed | Read every deletion surface.           | Nothing offers undo, trash, archive, restore, or a hidden copy, and nothing says the action is reversible.                         |
| Honest verbs        | Read every deletion surface.           | It says delete. It never says clean up, hide, archive, remove from view, or reset.                                                 |
| Nothing sensitive   | Read the confirmation and any failure. | No identifier, recorded value, exercise name, file path, or SQL appears.                                                           |
| Final-set wording   | Reduce a workout to one recorded set.  | The explanation points at deleting the whole workout instead of ending the conversation.                                           |

## Derived behavior

| Check                 | Steps                                                             | Expected result                                                                                            |
| --------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Progress              | Compare Day, Week, and Month summaries before and after.          | Counts, elapsed time, sets, repetitions, duration, distance, and volume all follow the remaining workouts. |
| Personal records      | Delete the record-setting fixture.                                | The record becomes the next eligible result and its evidence opens a workout that still exists.            |
| No successor          | Delete the only-evidence fixture.                                 | No record is claimed for that exercise, and the exercise leaves the performed list.                        |
| Per-exercise history  | Open the performance history of an exercise in a deleted workout. | The deleted occurrence is gone and the remaining ones are unchanged.                                       |
| Export after deletion | Create an export after deleting a workout.                        | The file omits it and still declares format version 1.                                                     |

## Data lifecycle

| Check                 | Steps                                                                       | Expected result                                                                      |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Older export restored | Erase local data, then restore the pre-deletion export.                     | The deleted workout returns, because that file truthfully contains it.               |
| Older export replaced | Replace local data with the pre-deletion export.                            | The same, in one all-or-nothing operation.                                           |
| Local erasure         | Erase all local data after a deletion.                                      | Erasure behaves exactly as before; deletion left nothing behind for it to find.      |
| Relaunch              | Delete a workout, force-quit, and relaunch.                                 | It is still gone and no confirmation message reappears.                              |
| Deep link             | Open a deleted workout's detail route directly.                             | It reports the workout as unavailable and offers a way back to history.              |
| Stale correction      | Open a correction screen, delete the workout elsewhere, then save.          | The correction is refused in a plain sentence and nothing is written.                |
| Back after deletion   | Delete a workout and use Back or the system back gesture.                   | The deleted detail never reappears.                                                  |
| Interrupted deletion  | Force-quit during the confirmation, and again immediately after confirming. | Either the whole workout survives or the whole workout is gone. Never a partial one. |

## Accessibility

| Check              | Steps                                           | Expected result                                                                                                                          |
| ------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver          | Reach and operate deletion with VoiceOver only. | The control announces what it deletes, the alert is reachable, Cancel reads as neutral, and the destructive action reads as destructive. |
| TalkBack           | Repeat on Android.                              | The same, with no unlabelled control.                                                                                                    |
| Focus after delete | Delete with a screen reader running.            | Focus lands on valid history content and the confirmation is announced.                                                                  |
| Dynamic Type       | Set the largest accessible text size.           | The section, its explanation, and the control stay readable with no clipping and no horizontal scrolling.                                |
| Keyboard           | Attach a hardware keyboard.                     | The control is reachable and shows a visible focus state.                                                                                |
| No icon-only       | Inspect the deletion surfaces.                  | Nothing depends on an icon or a color alone, and there is no swipe-to-delete.                                                            |

## Privacy and platform

| Check          | Steps                                     | Expected result                                                      |
| -------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Offline        | Delete with airplane mode on.             | Everything behaves identically; no request is attempted.             |
| No logging     | Watch the device log during a deletion.   | No workout name, recorded value, date, identifier, or SQL is logged. |
| No permission  | Delete on a fresh install.                | No new permission prompt appears.                                    |
| No hidden copy | Inspect the app sandbox after a deletion. | No backup, trash, or export file was written by the deletion.        |
| Synthetic only | Review every artifact produced during QA. | It contains synthetic data only.                                     |
