# Sprint 20 manual QA: Offline local data erasure

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the open,
explain, cancel, delete, first-run, relaunch, and restore-eligibility behavior
that the Sprint 20 Maestro suite already automates.

Every check below deletes information permanently. Never run one against a
device holding data you need, and never enter a real person's measurements,
dates of birth, or history.

## Preparing the fixtures

| Fixture                 | How to produce it                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Populated install       | Enter synthetic records in every capability, including an active workout and weight check-ins. |
| Large history           | Add several hundred nutrition, hydration, and weight records over multiple local days.         |
| Held export             | Open Export my data and create an export, then leave without sharing it.                       |
| Externally saved export | Create an export and save it to Files or Drive, then note its name and size.                   |

## Behavior worth checking by hand

| Check                        | Steps                                                                               | Expected result                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Empty installation           | Clear app data, open Data controls, open Delete all local data.                     | The screen states that nothing is stored, and the destructive control keeps its name but is disabled.                       |
| Partially populated          | Log only hydration, then delete.                                                    | Deletion succeeds and the hydration entries and daily target are both gone. No default target reappears.                    |
| Fully populated              | Delete the populated install.                                                       | Every tab is empty afterwards: Profile, Nutrition, Hydration, Workout, History, Progress, and Body measurements.            |
| Active workout               | Start a workout, leave it active, then delete.                                      | No workout is resumable afterwards, and no route leads back to the active session screen.                                   |
| Completed history            | Complete a workout, then delete.                                                    | Workout history is empty and no completed workout can be opened from Progress or from an exercise.                          |
| Offline                      | Enable airplane mode and delete a populated install.                                | Deletion succeeds unchanged. No network prompt, no error, no delay attributable to connectivity.                            |
| Held export removed          | Create an export, return without sharing, delete, then reopen Export my data.       | No previous export is offered, and the completion panel showed no leftover-file warning.                                    |
| External export survives     | Delete with an export saved in Files or Drive.                                      | That file is still present, unchanged, with the same name and size. The app never touched it.                               |
| Export before deleting       | Use "Export my data first", create and save an export, return, then delete.         | The export exists outside the app and the deletion still requires the acknowledgement and the confirmation again.           |
| Cancel at the alert          | Acknowledge, press the destructive control, and cancel the alert.                   | Nothing is deleted, no busy state appears, and every record is still present after relaunching.                             |
| Acknowledgement required     | Open the screen and press the destructive control without acknowledging.            | Nothing happens, no alert opens, and the control reads as disabled to assistive technology.                                 |
| Background before confirming | Open the screen, acknowledge, background the app, and return.                       | Nothing was deleted. The acknowledgement is not remembered across a relaunch.                                               |
| Interruption during deletion | Background the app while it is deleting, then return.                               | The app returns to a coherent state and never shows a half-deleted installation.                                            |
| Force quit during deletion   | Force quit while deleting, then relaunch and check every tab.                       | The installation is either completely empty or completely intact. Never partial.                                            |
| Low storage                  | Fill device storage, then delete a populated install.                               | Deletion still succeeds. If space could not be reclaimed the user is not told a false failure, and no user record survives. |
| Large history                | Delete the large-history fixture and time it.                                       | The operation stays responsive and shows labelled phases. It does not grow noticeably with record count.                    |
| Relaunch                     | Stop and relaunch after a successful deletion.                                      | The installation is still empty. Nothing returns.                                                                           |
| New profile afterwards       | Create a profile immediately after deleting, without relaunching.                   | It saves successfully and the app is usable at once.                                                                        |
| Restore afterwards           | Delete, then restore the externally saved export.                                   | Restore is eligible, the picker is only opened by the user, and the restored records match the original device.             |
| Repeat request               | Press the destructive control repeatedly during deletion.                           | Only one deletion runs. A second deletion on an emptied install is accepted and changes nothing.                            |
| Timezone                     | Delete on a device set to a different timezone from the one that recorded the data. | Deletion is unaffected. No record survives because of a day boundary.                                                       |
| Schema intact                | After deleting, add records in every capability.                                    | All of them save. No migration runs and no storage error appears, so the schema and migration version survived.             |

## Accessibility and visual review

| Check              | Expected result                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver/TalkBack | The two explanation panels, the acknowledgement, the destructive control, and the completion panel read in a sensible order.                |
| Acknowledgement    | It is announced as a checkbox with its checked state, and its state is never carried by colour alone.                                       |
| Disabled control   | While disabled, the control keeps the name "Delete all local data" and its label explains what is missing.                                  |
| Alert              | The platform alert reads its title, its message, and both options, and the destructive option is distinguishable from the screen's control. |
| Dynamic Type       | Largest practical sizes wrap both explanation panels and the acknowledgement without clipping, overlap, or horizontal scrolling.            |
| Busy state         | Deleting shows a labelled busy indicator and the destructive control is visibly disabled.                                                   |
| No false cancel    | While deleting, no cancel control is offered, because the transaction cannot be half-cancelled.                                             |
| Confirmation       | Completion is a persistent panel, not a transient toast, and stays readable after focus moves away.                                         |
| Keyboard           | With a hardware keyboard, the acknowledgement and the destructive control are reachable and show a visible focus state.                     |
| Touch targets      | The acknowledgement, the destructive control, and Back to profile meet the minimum target on a physical device.                             |
| Appearance         | Light and dark mode keep both panels, the warning, and errors legible.                                                                      |
| Language           | No screen claims an account, a cloud copy, an encrypted backup, a secure or unrecoverable wipe, or that files saved elsewhere were deleted. |

## Privacy review

| Check      | Expected result                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Logs       | Device logs during a deletion contain no table name, SQL, file path, measurement, or identifier.     |
| Network    | No request is made at any point in the workflow.                                                     |
| Permission | No new permission is requested.                                                                      |
| Artifacts  | QA artifacts and every fixture contain only synthetic data.                                          |
| Files      | Nothing outside `<app>/Library/Caches/data-export/` is removed. Files saved elsewhere are untouched. |

## Storage after erasure

This is a proportionate check of the documented claim, not a forensic one. No
conclusion about physical recoverability may be drawn from it.

1. Note the size of the app container's `fitness-app.db` and its `-wal` file
   while the populated fixture is present.
2. Delete all local data.
3. Compare: the database file should be much smaller, and the `-wal` file should
   be truncated or absent.

On iOS, `xcrun simctl get_app_container <device> com.fitnessapp.dev data` locates
the container on a simulator.

## Automated harness and reports

Run `./scripts/qa.sh sprint 20 --platform ios` and, when available, Android.
Confirm seven scenario lines, correct totals and exit status, and the presence of
`junit.xml`, `report.txt`, `report.json`, `cli.log`, and debug evidence. Then run
`./scripts/qa.sh regression --platform ios` on the final branch state, because
navigation, the root stack, the Profile screen, persistence composition, and the
export and restore entry points all changed this sprint.

Every suite creates its state through public controls. Closing any gap above
with a hidden reset route, a database fixture, or a production seeder is not
acceptable; the gap is documented instead.
