# Sprint 47 manual QA: Optional reps in reserve

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). No Maestro, simulator,
> emulator, or automated UI suite is introduced or required for this
> capability, per [ADR 0033](../decisions/0033-risk-based-manual-device-testing.md).

Record device, OS, app build, network state, and result for every check. Use
synthetic data only; never enter a real person's training history. Run the
[critical smoke checklist](README.md#critical-smoke-checklist) alongside
these checks.

## Setup

Start or resume an active Workout Session with at least one repetition-based
exercise (e.g. a bodyweight or external-load exercise) and at least one
non-repetition-based exercise (e.g. a duration or distance exercise) added, so
both eligible and ineligible forms can be checked.

## Recording in an active session

| Check                            | Steps                                                                                    | Expected result                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Field offered for eligible mode  | Open the set form for a repetition-based exercise.                                       | A "Reps in reserve (optional)" field appears below Repetitions, with helper text stating it is optional and 0–10. |
| Field absent for ineligible mode | Open the set form for a duration or distance exercise.                                   | No reps-in-reserve field appears anywhere on the form.                                                            |
| Recording no estimate            | Leave the field blank and save a valid set.                                              | The set saves; its row shows no RIR text.                                                                         |
| Recording RIR 0                  | Enter `0` and save a valid set.                                                          | The set saves; its row reads "... · RIR 0" — distinct from no estimate at all.                                    |
| Recording RIR 10                 | Enter `10` and save a valid set.                                                         | The set saves; its row reads "... · RIR 10".                                                                      |
| Recording an interior value      | Enter `4` and save a valid set.                                                          | The set saves; its row reads "... · RIR 4".                                                                       |
| Rejecting a negative value       | Enter `-1` and attempt to save.                                                          | Save is blocked with an error; entered values (including the mechanical result) remain on screen.                 |
| Rejecting a value above 10       | Enter `11` and attempt to save.                                                          | Save is blocked with the same error; entered values remain on screen.                                             |
| Rejecting a fractional value     | Enter `2.5` and attempt to save.                                                         | Save is blocked with the same error.                                                                              |
| Editing a set's estimate         | Edit a previously saved set that has RIR 4; change it to `7`.                            | The set's row updates to "... · RIR 7".                                                                           |
| Clearing an estimate             | Edit a previously saved set that has an RIR value; clear the field and save.             | The set's row no longer shows any RIR text.                                                                       |
| Populating on edit               | Edit a previously saved set that has RIR 3.                                              | The field is pre-filled with `3`, not blank.                                                                      |
| Rejected save keeps no offer     | Enter an invalid mechanical result (e.g. non-numeric repetitions) alongside a valid RIR. | Save is blocked; no rest-timer offer appears, matching Sprint 46 behavior for any rejected save.                  |
| Rest timer still offered         | Save a valid set with an RIR value.                                                      | The rest countdown offer appears exactly as it does after a set saved without RIR (Sprint 46 behavior unchanged). |

## Persistence and lifecycle

| Check                          | Steps                                                                         | Expected result                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Survives app termination       | Record a set with RIR 5, force-quit the app, relaunch.                        | The active session resumes with the set's RIR 5 still shown.                                  |
| Survives finishing the workout | Record a mix of sets with and without RIR, finish the workout.                | The completed workout's history shows the same RIR values (or absence) as during the session. |
| Older sets show no RIR         | View a workout completed before this update (or a restored version-1 export). | Its sets display with no RIR text and no error.                                               |

## Correcting completed history

| Check                               | Steps                                                                                                  | Expected result                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Correcting RIR alone                | Open a completed set's correction screen; change only the RIR value; save.                             | The correction saves; the mechanical result is unchanged; the new RIR shows in history. |
| Correcting the result preserves RIR | Open a completed set that has RIR 6; change only the repetitions; save.                                | The correction saves; RIR 6 is still shown alongside the new repetitions.               |
| Clearing RIR in correction          | Open a completed set that has an RIR value; clear it; save.                                            | The correction saves; the set's history row no longer shows any RIR text.               |
| Adding a missing set with RIR       | Use "Add Missing Set" (or "Add Exercise") on completed history; enter a result and an RIR value; save. | The new set appears in history with the entered RIR.                                    |
| Ineligible mode has no field        | Correct a duration-mode set in completed history.                                                      | No reps-in-reserve field appears on the correction form.                                |

## Export, erase, and restore

| Check                        | Steps                                                                             | Expected result                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Export includes RIR          | Record sets with no RIR, RIR 0, and a nonzero RIR; export; open the JSON file.    | Each set's `repsInReserve` matches what was recorded (`null`, `0`, or the number), and `formatVersion` is `2`. |
| Erase and restore round-trip | Export the file above, erase all local data, restore it.                          | Every set's RIR value matches what was exported, exactly.                                                      |
| Safe replacement round-trip  | With different data already present, use safe replacement with the exported file. | After replacement, every set's RIR matches the file; the prior dataset is fully replaced, not merged.          |

## Accessibility

| Check                               | Steps                                                                                                     | Expected result                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver / TalkBack field name     | With a screen reader enabled, focus the reps-in-reserve field.                                            | The field announces its label and helper text, including that it is optional and 0–10, with no coaching or medical language. |
| VoiceOver / TalkBack recorded value | With a screen reader enabled, focus a recorded set's row that includes an RIR value.                      | The full sentence, including the RIR portion, is announced as one element.                                                   |
| Largest Dynamic Type                | Set the device to its largest accessibility text size; open the set form and a recorded-set row with RIR. | The field, its helper text, and the recorded-set sentence remain legible and reachable, without clipping the RIR portion.    |
| Not color-only                      | Compare a set with RIR 0 to a set with no RIR, without relying on color.                                  | The distinction is clear from text alone ("· RIR 0" present or absent).                                                      |

## Offline operation

| Check         | Steps                                                                                     | Expected result                                                                         |
| ------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Fully offline | Enable airplane mode; record, edit, and correct sets with RIR values; export and restore. | Every action succeeds identically to online use; no network indicator or error appears. |
