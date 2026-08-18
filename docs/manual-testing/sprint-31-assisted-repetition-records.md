# Sprint 31 manual QA: assisted and load-bearing repetition records

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the assisted
record appearing, being beaten with less assistance, being preserved by more, the
tie credited to the earlier session, the relaunch, or the evidence link that the
Sprint 31 Maestro suite already automates.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture                | How to produce it                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Starter assisted       | Add the starter exercises and use "Assisted Pull-up" — machine, back, "Assistance + reps" — exactly as it ships.                              |
| Hand-authored assisted | Create "QA Assisted Dip", equipment `Machine`, any muscle group, logging mode "Assistance + reps".                                            |
| Two assisted sessions  | Two completed workouts of one assisted exercise, the first needing 25 kg of assistance and the second 18 kg.                                  |
| Assisted only          | One exercise whose completed history holds assisted sets and nothing else.                                                                    |
| Two modes over time    | An assisted exercise with completed history, then edited to "Bodyweight + reps" and performed again, so one identifier holds both meanings.   |
| Every other mode       | One completed workout for each of the other seven logging modes, so each existing record card can be compared against its previous behaviour. |

## The logging mode and its equipment

| Check                 | Steps                                                                                      | Expected result                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Starter definition    | Open "Assisted Pull-up" from the starter library.                                          | Equipment `Machine`, primary muscle group `Back`, logging mode "Assistance + reps".                                      |
| Allowed equipment     | Create an exercise with "Assistance + reps" and try `Machine`, `Resistance band`, `Other`. | Each saves.                                                                                                              |
| Refused equipment     | Try `Bodyweight`, `Barbell`, `Dumbbell`, or any other equipment with the same mode.        | Saving refuses with "Equipment and logging mode are not compatible." beside the logging mode, and nothing is saved.      |
| Field label           | Start a workout with an assisted exercise and add a set.                                   | The field reads "Assistance (kg)" in metric and "Assistance (lb)" in imperial — never "Weight" and never "Added weight". |
| Zero is not enterable | Enter `0` as the assistance and save.                                                      | "Enter valid values for this set." The entry is kept and no set is recorded.                                             |

## The record itself

| Check               | Steps                                                                       | Expected result                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| First record        | Record one assisted set, then open the exercise from Workout History.       | A card reading "Least recorded assistance in a set" with the value, the date, the workout name, and the set number.                            |
| Sentence gone       | Look at the whole personal-records section.                                 | "Personal records are not available for assisted work…" appears nowhere. Nothing on the screen says a record cannot be made for assisted work. |
| Claims nothing more | Read the card end to end.                                                   | It says nothing about repetitions, effort, strength, progress, or how close unassisted work is.                                                |
| Evidence            | Press the card.                                                             | The completed workout that set the record opens, showing the set that proves it.                                                               |
| Less assistance     | Record a second workout needing less assistance.                            | The record moves to the smaller value and the date follows it.                                                                                 |
| More assistance     | Record a third needing more, with more repetitions than either earlier set. | The record does not move. More repetitions do not beat it, and nothing on screen suggests they should.                                         |
| Tie                 | Record the record-holding assistance again on a later day.                  | The record keeps the earlier date and its evidence still opens the earlier workout.                                                            |
| Assisted only       | Open the assisted-only fixture.                                             | One assisted card and no mode heading, because there is only one mode.                                                                         |
| Two modes over time | Open the two-modes fixture.                                                 | Two headed groups — "Recorded as Assistance + reps" and "Recorded as Bodyweight + reps" — each with its own card. Nothing compares them.       |
| No assisted history | Open an exercise recorded only under another mode.                          | No assisted card anywhere.                                                                                                                     |
| Every other mode    | Open one exercise per remaining logging mode.                               | Every card reads, values, dates, evidence link, and ordering exactly as it did before this sprint.                                             |

## Correction, removal, and deletion

| Check               | Steps                                                          | Expected result                                                                                |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Correct downward    | Correct the record-holding set to less assistance.             | The record follows the corrected value and its date and evidence stay with that set.           |
| Correct upward      | Correct it to more assistance than another recorded set.       | The other set takes the record, with its own date and its own evidence.                        |
| Remove the exercise | Remove the record-holding exercise from its completed workout. | The next eligible assisted set takes the record, or no assisted card is shown if none remains. |
| Delete the workout  | Delete the record-holding workout.                             | Same as removal. No card points at a workout that no longer exists.                            |
| Nothing else moved  | After each act, open two exercises recorded under other modes. | Their records are untouched.                                                                   |

## Units, accessibility, and device behaviour

| Check                | Steps                                                               | Expected result                                                                                                                        |
| -------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Metric               | With metric preferred, read the assisted card.                      | The value reads in kg, rounded to at most two decimals.                                                                                |
| Imperial             | Switch to imperial and reopen.                                      | The same record, written in lb. The record itself does not change; only the writing does.                                              |
| VoiceOver            | Swipe to the assisted card with VoiceOver on, in both unit systems. | One element announces "Least recorded assistance in a set, <value> kilograms/pounds, first recorded on <date>, in <workout>, set <n>". |
| TalkBack             | Repeat on Android.                                                  | The same single announcement, units spoken as words.                                                                                   |
| Direction is spoken  | Listen to the first words of the announcement.                      | "Least recorded assistance" — the direction is heard before the number, so a larger value is never implied to be better.               |
| Dynamic Type         | Set the largest accessible text size and reopen the screen.         | Every line of the card is readable, nothing is clipped, and the section scrolls.                                                       |
| Keyboard             | Navigate the screen with an external keyboard.                      | The assisted card is reachable in visual order, activates the evidence link, and never traps focus.                                    |
| Touch targets        | On a physical device, press the card near each of its edges.        | The whole card responds; it meets the minimum touch target.                                                                            |
| Airplane mode        | Repeat the first-record check with networking off.                  | Identical behaviour. No request, no spinner beyond the local read, no error.                                                           |
| No sensitive logging | Watch device logs while opening the records screen.                 | No exercise name, value, date, identifier, SQL, or record text is logged.                                                              |

## Result

Record for each section: pass, fail, or not run, with device and build. Attach
screenshots only where they contain synthetic data.
