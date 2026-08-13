# Sprint 22 manual QA: Workout personal records

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the first
record, improvement, preservation, relaunch, and evidence behavior that the
Sprint 22 Maestro suite already automates.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture                        | How to produce it                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------- |
| Reps exercise                  | An Exercise Library entry using Reps only, performed in two completed workouts.   |
| Bodyweight exercise            | A Bodyweight + reps entry performed in one completed workout.                     |
| Loaded exercise                | A Weight + reps entry performed with several sets at different loads.             |
| Added-load exercise            | An Added weight + reps entry performed at two different added loads.              |
| Assisted exercise              | An Assistance + reps entry performed in one completed workout.                    |
| Duration exercise              | A Duration entry performed in two completed workouts.                             |
| Distance exercise              | A Distance entry performed in two completed workouts.                             |
| Distance and duration exercise | A Distance + duration entry performed twice, once shorter and faster.             |
| Mode-changed exercise          | A Reps only exercise performed, then edited to Weight + reps and performed again. |
| Long history                   | One exercise performed in twenty or more completed workouts.                      |

## Record semantics

| Check                     | Steps                                                               | Expected result                                                                                                       |
| ------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Single set, not a total   | Complete one workout with sets of 8, 12, and 6 repetitions.         | The record reads 12, never 26.                                                                                        |
| Heaviest load             | Perform the loaded exercise at increasing loads across workouts.    | Only "Heaviest recorded load in a set" appears, showing the largest single load.                                      |
| Added load stays separate | Compare the loaded and added-load exercises.                        | Added load reads "Heaviest recorded added load in a set". Neither value appears under the other exercise.             |
| No body mass is added     | Change the Profile weight, then reopen the bodyweight exercise.     | Nothing changes. No record includes body mass.                                                                        |
| Assisted work             | Open the assisted exercise.                                         | An explanation appears instead of a record. No value, no zero, no badge.                                              |
| Duration and distance     | Open the distance and duration exercise.                            | Both a longest distance and a longest duration appear, each from the workout that actually holds it.                  |
| No pace claim             | Inspect every record card.                                          | No pace, speed, one-repetition maximum, strength level, or score appears anywhere.                                    |
| Weaker later result       | Perform a clearly weaker set after a record.                        | The record and its date are unchanged.                                                                                |
| Equal later result        | Repeat a record-setting performance exactly.                        | The record keeps the earlier date and opens the earlier workout.                                                      |
| Mode change               | Open the mode-changed exercise.                                     | Records appear in separate groups labelled by how they were recorded. Loaded and unloaded results are never compared. |
| Planned targets ignored   | Plan a large target, perform a small set, and complete the workout. | The record shows what was performed.                                                                                  |
| Active workout ignored    | Start a workout with a large set and leave it active.               | No record changes until the workout is completed.                                                                     |

## Names, evidence, and navigation

| Check              | Steps                                                                         | Expected result                                                                                            |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Evidence link      | Open a record card.                                                           | The completed workout that set it opens, showing that set. Nothing is editable.                            |
| Set number         | Compare the card's set number with the workout detail.                        | They agree, counting from one.                                                                             |
| Rename             | Rename the exercise in the Library, then perform it again and reopen records. | The heading uses the newest recorded name, and older record cards state the name they were recorded under. |
| Deleted definition | Delete the exercise from the Library, then open Workout History.              | The exercise is still listed under its recorded name, and its records still open.                          |
| Back navigation    | Open a record's workout, then go back.                                        | The exercise screen returns with its records intact.                                                       |
| No identifiers     | Read every visible string and every error.                                    | No UUID or internal identifier appears.                                                                    |

## Units, accessibility, and presentation

| Check           | Steps                                              | Expected result                                                                                                          |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unit preference | Switch the Profile unit system and reopen records. | Values are rewritten in the new units. The record, its date, and its evidence are unchanged.                             |
| Rounding        | Inspect converted loads and distances.             | Values are rounded for reading. No long decimal tail appears.                                                            |
| VoiceOver       | Traverse the records section.                      | Every card is one element reading its category, value with units spoken as words, first recorded date, workout, and set. |
| TalkBack        | Repeat on Android.                                 | Same content and order.                                                                                                  |
| Headings        | Navigate by heading.                               | "Personal records" and "Performed sessions" are reachable headings in a sensible order.                                  |
| Dynamic Type    | Set the largest text size.                         | Nothing truncates or overlaps and the page never scrolls sideways.                                                       |
| Appearance      | Switch between light and dark.                     | Everything stays legible. No meaning depends on color.                                                                   |
| Wording         | Read every label.                                  | Records describe recorded data. No medical, coaching, or "best ever" claim appears.                                      |

## Failure, timing, and lifecycle

| Check            | Steps                                             | Expected result                                                                     |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Long history     | Open the long-history exercise.                   | Records appear promptly and match the largest recorded set.                         |
| Rapid navigation | Open and leave the screen repeatedly.             | No stale record from an earlier visit is shown.                                     |
| Offline          | Enable airplane mode and open records.            | Everything works unchanged. No network prompt or delay.                             |
| Timezone         | Change the device timezone and reopen records.    | Record dates are unchanged.                                                         |
| Relaunch         | Stop and relaunch the app.                        | Records are identical.                                                              |
| Export           | Export after setting records.                     | The file contains completed history only. No record or derived field appears in it. |
| Restore          | Restore that export into an empty installation.   | The same records reappear, derived from the restored history.                       |
| Replacement      | Replace the dataset with a different export.      | Records follow the replacement dataset only.                                        |
| Erasure          | Delete all local data, then open Workout History. | No exercise, no record, and no stale record content remains.                        |
