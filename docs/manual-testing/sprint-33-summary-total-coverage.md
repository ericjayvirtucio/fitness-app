# Sprint 33 manual QA: summary total coverage

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the weighted
period, the assisted period, the mixed period, or the relaunch, which the Sprint
33 Maestro suite and regression scenario 26 already automate.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture              | How to produce it                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Weighted only        | One completed workout holding a "Weight + reps" set of 20 kg × 8, and nothing else in the period.     |
| Added load only      | One completed workout holding an "Added weight + reps" set of 20 kg × 8.                              |
| Assisted only        | One completed workout holding an "Assistance + reps" set of 20 kg × 8.                                |
| Bodyweight only      | One completed workout holding a "Bodyweight + reps" set of 8 repetitions.                             |
| Duration or distance | One completed workout holding a duration set of 1 min 30 sec, and one holding a distance set of 5 km. |
| Mixed                | One period holding the weighted workout and the assisted workout together.                            |
| Empty period         | A period, reached with Previous, that holds no completed workouts.                                    |
| Mode changed         | One exercise recorded as "Assistance + reps" in one workout and as "Weight + reps" in a later one.    |
| Recorded before      | A period recorded on the previous build, read after installing this one.                              |

## What each coverage case says

Read on Workout History, in the performed summary, for the period holding the
fixture.

| Period holds                   | Expected sentence, metric                             | Expected sentence, imperial                           |
| ------------------------------ | ----------------------------------------------------- | ----------------------------------------------------- |
| Weighted only                  | `160 kg-reps recorded load volume from weighted sets` | `353 lb-reps recorded load volume from weighted sets` |
| Added load only                | `160 kg-reps recorded load volume from weighted sets` | `353 lb-reps recorded load volume from weighted sets` |
| Weighted and assisted together | `160 kg-reps recorded load volume from weighted sets` | `353 lb-reps recorded load volume from weighted sets` |
| Assisted only                  | `No recorded load volume from weighted sets`          | `No recorded load volume from weighted sets`          |
| Bodyweight only                | `No recorded load volume from weighted sets`          | `No recorded load volume from weighted sets`          |
| Duration or distance only      | `No recorded load volume from weighted sets`          | `No recorded load volume from weighted sets`          |
| No completed workouts          | no load volume line at all                            | no load volume line at all                            |

## Checks

| Check                    | Steps                                                                    | Expected result                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mixed period is honest   | Open Workout History on the mixed period.                                | The number counts the weighted set only, and the sentence says what it counts. Repetitions counts both sets, because it covers all recorded work. |
| Absence is not a zero    | Open the assisted-only period.                                           | `No recorded load volume from weighted sets`. No `0 kg-reps`, no explanation of why, no mention of assistance.                                    |
| Nothing recorded         | Reach the empty period with Previous.                                    | `0 completed workouts`, and no load volume sentence in either form.                                                                               |
| No comparison is made    | Read every sentence on the summary for each fixture.                     | Nothing compares assisted with weighted work, ranks anything, or states why a mode is excluded.                                                   |
| Per-exercise, eligible   | Open Exercise progress, then the weighted exercise.                      | Each performed session states `… · 160 kg-reps recorded load volume from weighted sets`, in the same words the summary uses.                      |
| Per-exercise, ineligible | Open Exercise progress, then the assisted exercise.                      | The row states `20 kg maximum assistance` and no load volume phrase at all. It does not repeat the summary's absent sentence.                     |
| Mode changed             | Open the exercise recorded under two modes.                              | The assisted session states no load volume; the weighted session states its own, covered. Neither row mixes the two.                              |
| Both unit systems        | Switch the profile between metric and imperial and reread every fixture. | Only the unit and number change. The qualifier is identical, and the absent sentence is identical because it carries no unit.                     |
| Data recorded before     | Read the pre-change period after installing this build.                  | Same numbers as before, now stating their coverage. Nothing was rewritten and no value moved.                                                     |

## Accessibility

| Check                  | Steps                                                                                             | Expected result                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VoiceOver, covered     | Swipe to the performed summary on the weighted period and let it announce end to end.             | It announces the card name followed by every sentence it displays, ending with the covered load volume and its coverage. Nothing displayed is left unannounced.          |
| VoiceOver, absent      | The same on the assisted-only period.                                                             | The announcement ends with `No recorded load volume from weighted sets`. It never says a number for a total that has none.                                               |
| VoiceOver, empty       | The same on the empty period.                                                                     | The announcement ends with the last total the period has, and says nothing about load volume.                                                                            |
| TalkBack               | Repeat the three announcements on Android.                                                        | The same sentences, in the same order.                                                                                                                                   |
| Announced matches read | Compare what is announced with what is on screen.                                                 | Every announced sentence appears on the card, and every sentence on the card is announced.                                                                               |
| Dynamic Type           | Largest accessible text size, on the imperial fixture with the longest value.                     | The sentence wraps onto further lines and the card grows. Neither the number nor `from weighted sets` is truncated, and nothing below the card is clipped or overlapped. |
| Keyboard               | Move focus through Workout History with an external keyboard.                                     | Focus order is unchanged, the summary is reachable, and no new stop was introduced — the card is not a control and does not take focus as one.                           |
| Touch targets          | On a physical device, press every control on Workout History and the exercise performance screen. | Unchanged, and each still meets the minimum target. No control was added or moved out of reach by the new line.                                                          |

## Privacy and safety

| Check           | Steps                                                           | Expected result                                                                     |
| --------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| No network      | Enable airplane mode and repeat every coverage case.            | Every sentence renders unchanged. Nothing is requested and nothing fails.           |
| No logging      | Watch the device log while reading each period.                 | No recorded value, sentence, SQL, table name, identifier, or path is logged.        |
| Failure wording | Read the failure state, if one can be provoked.                 | `Workout history could not be loaded.` — unchanged, with no SQL or internal detail. |
| Synthetic only  | Review the fixtures before starting and delete them afterwards. | No real training history was entered on the QA target.                              |
