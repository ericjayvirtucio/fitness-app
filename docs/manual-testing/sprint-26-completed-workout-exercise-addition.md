# Sprint 26 manual QA: Completed workout exercise addition

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the offered
entry point, cancellation, single addition, appended order, progress
recomputation, record recomputation, and relaunch behavior that the Sprint 26
Maestro suite already automates.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture              | How to produce it                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| One-exercise workout | One completed workout holding a single exercise with recorded sets.                                                                           |
| Several-exercise     | One completed workout holding three exercises, each with recorded sets.                                                                       |
| Already present      | A completed workout holding an exercise you will add a second time.                                                                           |
| Renamed definition   | A completed workout, whose Exercise Library definition is renamed afterwards.                                                                 |
| Deletable definition | An Exercise Library definition you can delete while the addition screen is open on another device screen or after backgrounding.              |
| Never performed      | An Exercise Library definition that no completed workout has ever used.                                                                       |
| Full workout         | A completed workout holding the maximum number of exercises.                                                                                  |
| Every logging mode   | Exercise Library definitions covering reps, weight + reps, bodyweight, added weight, assistance, duration, distance, and distance + duration. |
| Active workout       | A workout in progress, left unfinished.                                                                                                       |
| Export file          | An export created before an addition, kept for the restore and replacement checks.                                                            |

## Addition behavior

| Check                  | Steps                                                                                                         | Expected result                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| One-exercise workout   | Add an exercise with one recorded set to the one-exercise fixture.                                            | It appears last. The original exercise keeps its name, planned context, sets, and order.                              |
| Several exercises      | Add an exercise to the three-exercise fixture.                                                                | It appears fourth. The first three are unchanged in name, order, planned context, and recorded sets.                  |
| Already present        | Add an exercise the workout already holds.                                                                    | Both appear, each with its own recorded sets. Neither is merged into the other.                                       |
| Renamed definition     | Rename a definition in the Exercise Library, then add it to a workout completed before the rename.            | The added exercise carries the current name. The exercises already in the workout keep the names they captured.       |
| Deleted mid-flow       | Open the addition screen, delete that definition from the Exercise Library, then save.                        | A fixed sentence says the exercise is no longer in your library. Nothing is added and the entered values remain.      |
| Never performed        | Add a definition no workout has ever used.                                                                    | It is added, and it then appears in the performed-exercise list and in the picker's recents.                          |
| Full workout           | Open the full-workout fixture.                                                                                | A sentence replaces the entry point saying the workout already holds the most exercises it can keep. No dead control. |
| Every logging mode     | Add one exercise in each logging-mode fixture.                                                                | Each form asks for that mode's fields only, and each recorded result is stored and displayed correctly.               |
| Wrong values           | Enter values that do not fit the selected mode, or leave the field empty.                                     | The set form refuses with its own message, announces it, and nothing is added.                                        |
| Both unit systems      | Repeat one addition with metric and then with imperial preferences.                                           | Entry and display follow the preference; the stored canonical value is the same for equivalent input.                 |
| Cancellation           | Open the addition screen, select an exercise, then cancel.                                                    | Nothing is added, the workout is unchanged, and the detail is exactly as it was.                                      |
| Change the selection   | Select an exercise, then choose a different one before saving.                                                | The form follows the new selection's logging mode and nothing is added until you save.                                |
| Duplicate request      | Save, then immediately try to save again.                                                                     | Exactly one exercise is added. The control is unavailable while the write is in flight.                               |
| Active session refused | With an active workout in progress, look for completed-addition paths on it.                                  | The active workout screen offers its own Add Exercise only, and completed history is unreachable from it.             |
| Correct afterwards     | Correct, add a set to, and then remove the exercise you added.                                                | It behaves exactly like any other completed session exercise.                                                         |
| Nothing else changed   | After each addition, review Exercise Library, Planner, Profile, Goals, Nutrition, Hydration, and body weight. | Every one is unchanged.                                                                                               |

## Confirmation and copy

| Check                | Steps                                        | Expected result                                                                                                                 |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| States what changes  | Open the addition screen.                    | It says the workout will hold what you are entering now, records and progress may change, and existing exercises are unchanged. |
| Honest about claims  | Read every addition surface.                 | It asks you to record what you performed. Nothing implies the application knows the work happened.                              |
| Honest verbs         | Read every addition surface.                 | It says add and record. It never says restore, recover, sync, or fix.                                                           |
| No destructive alert | Save an addition.                            | It saves explicitly. No destructive confirmation appears, because nothing is destroyed.                                         |
| Nothing sensitive    | Trigger each refusal you can reach.          | No identifier, recorded value, exercise name, date, file path, or SQL appears in any message.                                   |
| First set required   | Try to reach a save without recording a set. | There is no path that adds an exercise without a recorded set.                                                                  |

## Derived behavior

| Check                 | Steps                                                                     | Expected result                                                                                            |
| --------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Workout counts        | Compare the detail summary before and after an addition.                  | Actual set and performed exercise counts rise. The completed workout count and workout time do not change. |
| Progress              | Open Progress for the period holding the workout, before and after.       | Sets, repetitions, duration, distance, and load volume recompute. The completed workout count is the same. |
| Personal records      | Add a result better than any recorded for that exercise.                  | The record follows the added evidence and opens this workout as proof.                                     |
| Per-exercise history  | Open the added exercise's history.                                        | The occurrence appears under the workout's own date, not today's.                                          |
| Performed list        | Open the performed-exercise list after adding a never-performed exercise. | It is listed under the name that was captured.                                                             |
| Export                | Export after an addition and read the file.                               | The added exercise and its set are present in the same version-1 shape as any other.                       |
| Older export restored | Restore the pre-addition export into an empty installation.               | The addition is absent, because that file was written before it. Nothing claims otherwise.                 |
| Replacement           | Replace local data using the pre-addition export.                         | The dataset matches the file exactly and the addition is gone.                                             |
| Erasure               | Erase all local data after an addition.                                   | Nothing remains, and no hidden copy of the added work survives.                                            |
| Relaunch              | Force-quit and reopen after an addition.                                  | The added exercise, its set, and every derived value are exactly as they were.                             |

## Interruption and stale state

| Check                   | Steps                                                                                    | Expected result                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Stale addition screen   | Open the addition screen, delete that workout elsewhere, then save.                      | A fixed sentence says the workout is no longer available. Nothing is written.          |
| Stale detail            | Add an exercise, then act on a correction, removal, or deletion screen opened before it. | Each refuses safely, states why in one fixed sentence, and reloads rather than acting. |
| Backgrounded mid-save   | Background the app immediately after saving.                                             | On return the exercise is either fully present with its set or entirely absent.        |
| Interrupted transaction | Force-quit during a save if you can reproduce it.                                        | No exercise without a set, no set without an exercise, and no partial workout.         |
| Screen dismissed        | Navigate away while a save is in flight.                                                 | The write completes or rolls back; the app does not crash or warn about state updates. |

## Accessibility

| Check          | Steps                                                | Expected result                                                                                 |
| -------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| VoiceOver      | Reach the entry point, the picker, and the set form. | Every control is reachable and announced with a label naming what it does and to which workout. |
| TalkBack       | Repeat on Android.                                   | The same, with headings announced as headings.                                                  |
| Announcement   | Complete an addition with a screen reader running.   | The result is announced politely and focus stays on valid completed detail content.             |
| Dynamic Type   | Set the largest text size and repeat one addition.   | Nothing is clipped or unreachable, and the page does not scroll horizontally.                   |
| Keyboard       | Use an external keyboard on the addition screen.     | Fields and controls are reachable in a sensible order and the save control can be activated.    |
| No colour-only | Review every state.                                  | No meaning depends on colour or an icon alone.                                                  |

## Privacy and safety

| Check          | Steps                                                    | Expected result                                                       |
| -------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| No network     | Put the device in airplane mode and repeat one addition. | It behaves identically. Nothing waits on a network.                   |
| No logging     | Watch device logs during an addition.                    | No exercise name, recorded value, date, identifier, or SQL is logged. |
| No hidden copy | Inspect the app container after an addition.             | No backup, journal, or audit file describing the addition exists.     |
| Synthetic data | Review everything entered during this pass.              | No real person's training history or measurements were used.          |
