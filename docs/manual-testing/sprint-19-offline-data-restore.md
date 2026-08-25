# Sprint 19 manual QA: Offline data restore

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the open,
explain, reach-the-control, and refusal behavior that the Sprint 19 Maestro
suite already automates.

Manual QA carries more weight this sprint than usual: the document picker is
owned by the operating system, so **no automated flow can select a file**. Every
successful restore below is verified by hand.

## Preparing the fixtures

Build these once on a disposable target and keep them somewhere the picker can
reach, such as Files or Drive.

| Fixture             | How to produce it                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Complete export     | Enter synthetic records in every capability, including an active workout, then export and save. |
| Empty export        | Clear app data, export immediately, and save the result.                                        |
| Wrong JSON          | Any other valid `.json` file, for example `{"hello":"world"}`.                                  |
| Unsupported version | Copy the complete export and change `"formatVersion"` to `2`.                                   |
| Broken JSON         | Copy the complete export and delete a closing brace.                                            |
| Oversized file      | Any `.json` file larger than 25 MB.                                                             |

Every fixture must contain synthetic values only. Never use a real person's
measurements, dates of birth, or history.

## Behavior worth checking by hand

| Check                    | Steps                                                                                   | Expected result                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Fresh installation       | Clear app data, open Profile, and use Restore my data from the empty state.             | The entry point is reachable without creating a profile first, and the explanation appears.                            |
| Offline restore          | Enable airplane mode, then restore the complete export.                                 | The restore succeeds unchanged. No network prompt, no error, no delay attributable to connectivity.                    |
| Complete export          | Restore the complete export on a cleared install.                                       | The preview counts match what was entered, and after confirming, every tab shows the restored records.                 |
| Empty export             | Clear app data and restore the empty export.                                            | Validation succeeds, every count is zero or "Not included", and confirming completes without error. This is a success. |
| Wrong JSON               | Choose the wrong-JSON fixture.                                                          | "not a Fitness App export". Nothing is written.                                                                        |
| Unsupported version      | Choose the version 2 fixture.                                                           | An explicit unsupported-version message, distinct from a malformed-file message. Nothing is written.                   |
| Broken JSON              | Choose the broken-JSON fixture.                                                         | "not a valid JSON document". Nothing is written.                                                                       |
| Oversized file           | Choose the oversized fixture.                                                           | An explicit size message. The app does not hang while reading it.                                                      |
| Picker cancellation      | Open the picker and dismiss it without choosing.                                        | A neutral "No file was selected" notice. No error styling, no failure language.                                        |
| Existing-data refusal    | Create a profile, then open Restore my data.                                            | The refusal panel appears, no Choose file control is offered, and the profile is unchanged afterwards.                 |
| Refusal after preview    | On a cleared install, validate a file, add a nutrition entry from another tab, confirm. | The restore refuses with the existing-data message and writes nothing.                                                 |
| Active workout           | Restore an export containing an active workout.                                         | The workout is active in the Workout tab, not listed in history, with its captured exercises and sets.                 |
| Completed snapshots      | Open a restored completed workout.                                                      | Names, logging modes, planned targets, and every performed set match the original device.                              |
| Deleted catalog exercise | Restore an export whose completed workout references an exercise deleted before export. | The workout still describes what was performed; the exercise is absent from the library and nothing is invented.       |
| Unknown nutrition        | Restore an entry saved with some nutrients left blank.                                  | Those nutrients stay blank. None of them becomes zero.                                                                 |
| Profile and check-ins    | Compare restored profile weight with the newest weight check-in.                        | They match the original device independently. Neither was derived from the other.                                      |
| Hydration target         | Check the restored daily target and past days.                                          | The target is current configuration. No past day claims a target.                                                      |
| Progress after restore   | Open Progress for a period covered by the restored history.                             | Summaries are derived from restored records and match the original device.                                             |
| Relaunch                 | Stop and relaunch the app after a successful restore.                                   | Everything restored is still present.                                                                                  |
| Interruption             | Background the app while restoring, then return.                                        | The app returns to a coherent state and never shows a half-restored installation.                                      |
| Force quit               | Force quit during the restore, then relaunch and open Profile.                          | The installation is either fully restored or still empty. Never partial.                                               |
| Low storage              | Fill device storage, then restore the complete export.                                  | An explicit failure stating nothing was changed, and the installation is still empty.                                  |
| Timezone                 | Restore on a device set to a different timezone from the original.                      | Recorded days, times, and offsets are unchanged. No record moves to another day.                                       |
| Repeat request           | Press the confirmation control repeatedly.                                              | Only one restore runs, and a second attempt refuses with the existing-data message.                                    |

## Round trip

After a successful restore of the complete export, create a new export on the
restored device and compare it with the original file.

- Every authoritative value must match: identifiers, canonical amounts,
  occurrence triples, snapshots, favourite and usage state, and the current
  hydration target.
- `generatedAt` and `application.version` legitimately differ.
- Byte equality is not required and must not be treated as a failure.

## Accessibility and visual review

| Check              | Expected result                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| VoiceOver/TalkBack | The explanation, preview rows, refusal panel, and completion panel read in a sensible order; status changes are announced.           |
| Dynamic Type       | Largest practical sizes wrap the explanation and preview rows without clipping, overlap, or horizontal scrolling.                    |
| Busy states        | Opening the picker, checking the file, and restoring each show a labelled busy indicator, and controls are visibly disabled.         |
| No false cancel    | While restoring, no cancel control is offered, because the transaction cannot be half-cancelled.                                     |
| Confirmation       | Completion is a persistent panel, not a transient toast, and stays readable after focus moves away.                                  |
| Preview honesty    | The preview states that nothing has been restored yet and shows counts and presence only, never a weight, meal, or date of a record. |
| Errors             | Failures state that nothing was changed, offer another attempt, and contain no measurement, identifier, file path, or SQL.           |
| Touch targets      | Choose file, Restore my data, and Back to profile all meet the minimum target on a physical device.                                  |
| Appearance         | Light and dark mode keep the explanation, preview, refusal, and errors legible without colour-only meaning.                          |
| Language           | No screen implies the restore came from a cloud service, that the file was encrypted, or that merging or replacing is supported.     |

## Privacy review

| Check       | Expected result                                                                               |
| ----------- | --------------------------------------------------------------------------------------------- |
| Logs        | Device logs during a restore contain no file contents, file path, measurement, or identifier. |
| Network     | No request is made at any point in the workflow, including while the picker is open.          |
| Permission  | No storage permission is requested; the picker grants access to one file only.                |
| Artifacts   | QA artifacts and every fixture contain only synthetic data.                                   |
| Source file | The file chosen in the picker is unchanged and still present afterwards.                      |

## Automated harness and reports

Run `./scripts/qa.sh sprint 19 --platform ios` and, when available, Android.
Confirm five scenario lines, correct totals and exit status, and the presence of
`junit.xml`, `report.txt`, `report.json`, `cli.log`, and debug evidence. Then run
`./scripts/qa.sh regression --platform ios` on the final branch state, because
navigation, the root stack, the Profile screen, and persistence composition
changed this sprint.

No suite selects a file. That boundary is deliberate: closing it would require a
hidden import route, a database fixture, or a production seeder, none of which
belong in a shipped application.
