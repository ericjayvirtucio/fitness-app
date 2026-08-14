# Sprint 23 manual QA: Completed workout correction

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the edit,
add, delete, blocked-deletion, record-recomputation, and relaunch behavior that
the Sprint 23 Maestro suite already automates.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture                | How to produce it                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One overstated set     | A completed workout whose only exercise holds two sets, one of them ten times larger than intended.                                                      |
| Every logging mode     | One completed workout per mode: reps, weight + reps, bodyweight + reps, added weight + reps, assistance + reps, duration, distance, distance + duration. |
| Deleted definition     | A completed workout whose Exercise Library definition is deleted afterwards.                                                                             |
| Deleted planned source | A completed workout started from a plan whose planned workout is deleted afterwards.                                                                     |
| Planned context        | A completed workout started from a plan, so the correction screen has a captured target to show.                                                         |
| Multi-exercise workout | A completed workout with two exercises, each holding recorded sets.                                                                                      |
| Export file            | An export created after a correction, kept for the restore and replacement checks.                                                                       |

## Correction behavior

| Check                   | Steps                                                                     | Expected result                                                                                               |
| ----------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Every logging mode      | Correct one recorded set in each mode fixture.                            | The form offers exactly the fields that mode records, and the corrected value is shown in the same wording.   |
| Assistance stays itself | Correct the assistance fixture.                                           | The field is labelled as assistance, never as ordinary weight, and no body mass is added anywhere.            |
| Metric and imperial     | Correct a loaded set, switch the unit preference, and reopen the workout. | The stored result is unchanged and only the displayed units differ.                                           |
| Captured target         | Open a correction on the planned-context fixture.                         | The planned target, the currently recorded result, and the editable fields read as three distinct things.     |
| Mode cannot change      | Inspect every correction screen.                                          | There is no way to change how the exercise was recorded, its name, its plan, or the workout's times.          |
| Add a missing set       | Add a set to an exercise that already holds two.                          | It appears as set 3 and the workout's set count rises by one.                                                 |
| Delete one of several   | Delete set 1 of three.                                                    | The confirmation is explicit, the remaining sets renumber to 1 and 2, and their values are unchanged.         |
| Emptying one exercise   | Delete every set of one exercise in the multi-exercise fixture.           | That exercise remains with its planned context and no recorded sets. The workout and the other exercise stay. |
| Final set refused       | Reduce a workout to one recorded set and try to delete it.                | A sentence explains why it cannot be deleted. No control silently does nothing.                               |
| Cancel changes nothing  | Open a correction, change a value, and cancel.                            | The recorded result is unchanged.                                                                             |
| Invalid input           | Enter zero, blank, and a negative value.                                  | The correction is refused with a field-level message and nothing is written.                                  |

## Historical authority

| Check                  | Steps                                                   | Expected result                                                                                        |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Deleted definition     | Correct a set in the deleted-definition fixture.        | The correction works and shows the captured name and mode. Nothing about the Exercise Library changes. |
| Deleted planned source | Correct a set in the deleted-planned-source fixture.    | The correction works and the captured planned target still reads as it did.                            |
| Catalog rename         | Rename the exercise, then reopen the corrected workout. | History still shows the name captured at the time.                                                     |
| Workout identity       | Compare the workout before and after correcting it.     | The name, date, start time, and workout time are identical.                                            |
| No audit claim         | Read every screen involved.                             | Nothing claims to show what changed, when it changed, or the previous value.                           |
| Wording                | Read every label, heading, alert, and message.          | Correction wording only. Nothing says improve, personal best, upgrade, or rewrite.                     |

## Derived views

| Check                | Steps                                                                     | Expected result                                                                                    |
| -------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Personal records     | Correct a record-setting set downwards.                                   | The overstated record disappears and the next eligible result or no record takes its place.        |
| Record evidence      | Open the record's proving workout after the correction.                   | It opens the corrected workout and shows the corrected set.                                        |
| Progress totals      | Note the Day, Week, and Month workout summaries, then correct a set.      | Set counts, repetitions, duration, distance, and recorded load volume follow the corrected values. |
| Workout count        | Compare the completed workout count and workout time before and after.    | Both are unchanged by a set correction.                                                            |
| Emptied exercise     | Empty one exercise, then reopen Progress and the performed exercise list. | That exercise no longer counts as performed, and the truth is stated rather than hidden.           |
| Per-exercise history | Reopen the exercise's performance history after a correction.             | The occurrence shows the corrected totals.                                                         |

## Lifecycle

| Check                  | Steps                                                              | Expected result                                                                     |
| ---------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Export after fixing    | Correct a set, then create an export and read the workout section. | Only the corrected values appear. The previous value is absent and the format is 1. |
| Restore a corrected    | Erase all local data, then restore the corrected export.           | The restored history holds the corrected values.                                    |
| Replace with corrected | Replace local data with the corrected export.                      | The replacement completes atomically and the corrected history is present.          |
| Erasure                | Delete all local data after a correction.                          | No corrected workout, set, record, or summary remains.                              |
| Relaunch               | Correct a set, force-quit, and relaunch.                           | The correction is still there.                                                      |

## Failure, staleness, and interruption

| Check             | Steps                                                                                   | Expected result                                                                           |
| ----------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Stale screen      | Open a correction, correct the same set from another route, then save the first screen. | The save is refused with an explanation and the newer value survives.                     |
| Double submission | Tap Save twice quickly.                                                                 | Exactly one correction is applied.                                                        |
| Erased underneath | Open a correction, erase all local data, then save.                                     | A safe message appears and the app stays usable.                                          |
| Backgrounded      | Open a correction, background the app during the delete confirmation, and return.       | Nothing was written until the confirmation was accepted.                                  |
| Interrupted write | Force-quit during a save, then relaunch and reopen the workout.                         | Either the previous or the corrected values are present in full. Never a partial workout. |
| Messages are safe | Trigger every failure you can and read each message.                                    | No SQL, path, identifier, exercise name, recorded value, date, or stack trace appears.    |

## Accessibility and privacy

| Check              | Steps                                                           | Expected result                                                                             |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| VoiceOver          | Traverse the completed workout and a correction screen.         | Every control announces which set and which exercise it acts on. Units are spoken as words. |
| TalkBack           | Repeat on Android.                                              | The same, with a correct focus order and no unlabelled control.                             |
| Focus after saving | Save a correction and delete a set with a screen reader active. | Focus lands on the refreshed completed workout rather than being lost.                      |
| Largest text       | Set the largest Dynamic Type and revisit both screens.          | Nothing is clipped or truncated and the page never scrolls horizontally.                    |
| Keyboard           | Use an external keyboard on the correction form.                | Every field and both actions are reachable and the field order is sensible.                 |
| No colour-only     | Inspect every state.                                            | Every meaning is carried by words.                                                          |
| No network         | Enable airplane mode and correct, add, and delete sets.         | Everything works. Monitor traffic and confirm no request is made.                           |
| No sensitive logs  | Watch device logs during every correction.                      | No exercise name, value, date, identifier, or before-and-after pair is logged.              |
