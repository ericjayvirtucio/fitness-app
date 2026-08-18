# Sprint 34 manual QA: announced card contents

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the estimate
card, the nutrition totals card, the completed workout summary, the correction
consequence, or reaching the hydration control, which the Sprint 34 Maestro suite
and regression scenario 27 already automate.

Never enter a real person's measurements, nutrition, or training history.

This sprint changes what nine elements announce and changes no visible string.
Every check below is therefore a comparison between what is written and what is
spoken, plus one control that was unreachable and is not any more.

## Preparing the fixtures

| Fixture                | How to produce it                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Profile and estimates  | A saved profile with height, weight, date of birth, biological sex, and activity level, then open Goals & energy. |
| Calculated target      | On Goals & energy, choose "Lose weight" and enter a 250 kcal deficit.                                             |
| Screening only         | A profile the selected energy formula does not support, so the screen shows the BMI card and no estimates.        |
| Nutrition, complete    | One logged entry carrying every nutrient.                                                                         |
| Nutrition, incomplete  | One logged entry with at least one nutrient left unknown.                                                         |
| Completed workout      | One completed workout holding at least one recorded set.                                                          |
| Correction consequence | From that workout, choose Correct on a recorded set.                                                              |
| Addition consequence   | From that workout, add an exercise and reach the record-a-set step.                                               |
| Hydration with target  | A daily fluid target set, and at least one fluid entry logged against it.                                         |
| Body weight, two       | Two weight check-ins in one period, read on Progress.                                                             |
| Body weight, one       | One weight check-in in a period, so no recorded change exists.                                                    |
| Recorded before        | Data recorded on the previous build, read after installing this one.                                              |

## What each element announces

Announcement is read with VoiceOver on iOS and repeated with TalkBack on Android.
Values follow the fixture; the words and their order do not.

| Element                            | Expected announcement                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Completed workout summary          | `Completed workout summary`, then the actual set count, then the workout time.                                                           |
| Correction consequence, correcting | `What this correction changes`, then `Correcting changes what this workout recorded.` and the rest of the paragraph on screen.           |
| Correction consequence, adding     | `What this correction changes`, then `Adding records a set this workout did not record.` and the rest of the paragraph on screen.        |
| Addition consequence               | `What this addition changes`, then the whole paragraph on screen.                                                                        |
| Daily nutrition totals             | `Daily nutrition totals`, the day's energy, the entry count, then protein, carbohydrate, fat, fiber, sugar, and sodium in written order. |
| BMI screening result               | `BMI screening result`, then `BMI` and its value, then `Screening category` and its value.                                               |
| Profile-derived energy estimates   | `Profile-derived energy estimates`, then BMI, screening category, estimated BMR, and estimated maintenance, each label then value.       |
| Calculated daily calorie target    | `Calculated daily calorie target`, then `Calculated target`, the value, and the caveat sentence.                                         |
| Hydration target progress card     | Four separate stops: `Daily fluid target`, the percentage line, the remaining line, then `Change daily target` announced as a button.    |
| Progress body weight caption       | The sentence printed under the metrics, and nothing else. The metrics above it stay individually navigable.                              |

## Checks

| Check                    | Steps                                                                                                | Expected result                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Announced matches read   | For each element above, compare what is announced with what is on screen, word by word and in order. | Every announced string appears on the element, and every string on the element is announced. Nothing is invented and nothing is omitted. |
| Nothing visible changed  | Read every changed screen against the previous build.                                                | Not one displayed word, number, unit, heading, empty state, alert, or control label differs.                                             |
| Partly absent values     | Open the incomplete nutrition day, and the one-check-in Progress period.                             | The announcement is shorter and states `Incomplete` where the value is unknown. It claims nothing about the value it does not have.      |
| Screening without energy | Open the unsupported-profile fixture.                                                                | The BMI card announces its two metrics. No energy estimate is announced, because none is displayed.                                      |
| Error instead of values  | Force each changed screen into its failure state.                                                    | The error screen is announced. No stale total, estimate, or target is announced or displayed.                                            |
| Target preview is live   | With the target card open, change the deficit and reread it.                                         | The announcement carries the new value. It never announces the previous one.                                                             |
| Correction wording       | Reach the card once by correcting a set and once by adding a missing set.                            | The announced paragraph matches the branch on screen: `Correcting…` for one and `Adding…` for the other.                                 |
| Recorded before          | Read every fixture recorded on the previous build.                                                   | Same values, now announced. Nothing was rewritten and no number moved.                                                                   |

## The control that was unreachable

| Check                | Steps                                                                                                    | Expected result                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver reaches it | With a fluid target set, swipe through Today until `Change daily target` is reached.                     | It is reached, announced as a button, and activating it opens the target screen. Before this build it could not be reached. |
| TalkBack reaches it  | The same on Android.                                                                                     | The same.                                                                                                                   |
| Keyboard reaches it  | Tab through Today with an external keyboard.                                                             | The control takes focus in written order, after the three lines above it, and activates from the keyboard.                  |
| Touch target         | On a physical device, press it.                                                                          | It meets the minimum target, unchanged from what was drawn before.                                                          |
| Every other control  | Press every control on the changed screens: nutrition day navigation, goal saving, correction, addition. | Each is still reachable, still named as before, and still acts.                                                             |

## Accessibility

| Check               | Steps                                                                                                     | Expected result                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Announcement length | Let the nutrition totals card and the four-metric estimate card announce end to end without interrupting. | Each is one utterance, readable to the end, and interruptible by the next swipe. Note any that reads as unusably long.           |
| Focus order         | Move through every changed screen with an external keyboard.                                              | Focus order matches written order. No focusable element was lost, and the only new stop is `Change daily target`.                |
| Dynamic Type        | Largest accessible text size on the nutrition totals card and the estimates card.                         | Every line wraps and the card grows taller. Nothing truncates, clips, or overlaps, and the announcement is unchanged.            |
| Both unit systems   | Switch the profile between metric and imperial and reread Progress body weight and hydration.             | Only the unit and number change. Words and order are identical.                                                                  |
| Roles unchanged     | Check each changed card with the screen reader's rotor or element list.                                   | Static cards are not announced as buttons. Pressable cards still are. The hydration progress card is no longer a single element. |

## Privacy and safety

| Check           | Steps                                                           | Expected result                                                                        |
| --------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| No network      | Enable airplane mode and repeat every announcement.             | Every element renders and announces unchanged. Nothing is requested and nothing fails. |
| No logging      | Watch the device log while reading each changed screen.         | No value, sentence, accessible name, SQL, table name, identifier, or path is logged.   |
| Failure wording | Read each failure state.                                        | Unchanged fixed sentences, with no SQL or internal detail.                             |
| Synthetic only  | Review the fixtures before starting and delete them afterwards. | No real measurements, nutrition, or training history was entered on the QA target.     |
