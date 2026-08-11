# Sprint 18 manual QA: Offline data export

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the open,
review, generate, and discard behavior that the Sprint 18 Maestro suite already
automates.

## Behavior worth checking by hand

| Check              | Steps                                                                                 | Expected result                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Offline generation | Enable airplane mode, then create an export.                                          | Generation succeeds unchanged. No network prompt, no error, no delay attributable to connectivity.                    |
| Native handoff     | Open share options and save the file to Files or Drive on both platforms.             | The platform sheet appears, the saved file opens as readable JSON, and the app reports a neutral handoff message.     |
| Dismissed sheet    | Open share options and dismiss the sheet without choosing anything.                   | The app never claims the file was saved and still offers to open share options again.                                 |
| File contents      | Open the saved file and inspect it against the documented contract.                   | Canonical units, occurrence triples, `formatVersion` 1, unknown nutrients as `null`, and no database or column names. |
| Empty install      | Clear app data, create a profile only, and export.                                    | A valid complete file with empty arrays and `null` singletons. This is a success, not an error.                       |
| Large history      | Log a few hundred records across capabilities, then export.                           | Generation stays responsive, the busy state is visible, and record counts match what was entered.                     |
| Cancellation       | Start an export on a large history and press Cancel export.                           | Generation stops, the screen returns to idle, and no export file remains.                                             |
| Backgrounding      | Start an export, background the app, then return.                                     | The app returns to a coherent state, either ready or idle, and never shows a half-finished export.                    |
| Repeat export      | Create an export, then create another without leaving the screen.                     | Only one file exists; the second export replaces the first and the reported name and size update.                     |
| Low storage        | Fill device storage, then attempt an export.                                          | An explicit failure naming storage, no partial file, and retry works after freeing space.                             |
| Cleanup            | Create an export, leave the screen without sharing, and return to it.                 | The previous export is gone and the screen starts idle.                                                               |
| Timezone           | Log records, change the device timezone, then export.                                 | Recorded days, times, and offsets in the file are unchanged.                                                          |
| Separation         | Confirm the file's profile weight, weight check-ins, planner, and completed workouts. | Profile weight is not a check-in, planner intent is not history, and an active session is not a completed workout.    |

## Accessibility and visual review

| Check              | Expected result                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver/TalkBack | The notice, "Export ready" panel, file name, size, and each record count read in a sensible order; status changes are announced. |
| Dynamic Type       | Largest practical sizes wrap the notice, the count rows, and the file name without clipping, overlap, or horizontal scrolling.   |
| Loading state      | While generating, a labelled busy indicator is present, Cancel export is reachable, and Create export is visibly disabled.       |
| Confirmation       | Success is a persistent panel, not a transient toast, and remains readable after focus moves away.                               |
| Errors             | Failures state that nothing was saved, offer a retry, and contain no measurement, identifier, file path, or database detail.     |
| Touch targets      | Create, Cancel, Open share options, and Discard all meet the minimum target on a physical device.                                |
| Appearance         | Light and dark mode keep the notice, counts, status, and errors legible without color-only meaning.                              |
| Language           | No screen implies the export is encrypted, is a backup, can be restored, or is uploaded anywhere.                                |

## Privacy review

| Check     | Expected result                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------- |
| Logs      | Device logs during an export contain no export contents, file path, measurement, or identifier. |
| Network   | No request is made at any point in the workflow, including during the handoff.                  |
| Artifacts | QA artifacts and any saved export contain only the synthetic data entered during the run.       |

## Automated harness and reports

Run `./scripts/qa.sh sprint 18 --platform ios` and, when available, Android.
Confirm five scenario lines, correct totals and exit status, and the presence of
`junit.xml`, `report.txt`, `report.json`, `cli.log`, and debug evidence. Then run
`./scripts/qa.sh regression --platform ios` on the final branch state, because
navigation, the root stack, and a native module changed this sprint.

The first iOS run after this change rebuilds the native project to link
`expo-sharing`, so allow extra time for preparation.
