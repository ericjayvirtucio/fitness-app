# Sprint 21 manual QA: Safe replacement restore

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the open,
explain, cancel, gating, and reachability behavior that the Sprint 21 Maestro
suite already automates.

Every check below replaces information permanently. Never run one against a
device holding data you need, and never enter a real person's measurements,
dates of birth, or history.

## Preparing the fixtures

| Fixture                | How to produce it                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Dataset A              | Enter synthetic records in every capability, including an active workout, a weekly plan, and weight check-ins. |
| Export A               | Export dataset A and save it to Files or Drive. Note its name and size.                                        |
| Dataset B              | Delete all local data, enter a clearly different synthetic dataset, and export it. Note its name and size.     |
| Same-installation copy | With dataset A restored, export it again without changing anything.                                            |
| Empty export           | Delete all local data, export immediately, and save that file.                                                 |
| Invalid file           | Copy export A and corrupt its JSON, for example by deleting a closing brace.                                   |
| Unsupported version    | Copy export A and change `"formatVersion"` to `2`.                                                             |
| Oversized file         | Any JSON file larger than 25 MB.                                                                               |
| Large history          | Several hundred nutrition, hydration, and weight records over multiple local days, exported.                   |

The round-trip check needs dataset A restored on the device and export B
available in Files.

## Replacement behavior

| Check                     | Steps                                                                                                      | Expected result                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete replacement      | With dataset A on the device, replace it with export B.                                                    | Every tab shows only dataset B afterwards. Nothing from dataset A remains anywhere.                                                               |
| Round trip                | Replace A with B, then export the result and compare with export B.                                        | Records, identifiers, and canonical values match. Only `generatedAt` and application metadata legitimately differ. Byte equality is not expected. |
| Same-installation export  | Replace dataset A with the export it produced moments earlier.                                             | The operation succeeds and the visible data is unchanged. It is still a full replacement, not a no-op shortcut.                                   |
| Empty export              | Replace a populated installation with the empty export.                                                    | The preview states that the file contains no records. After confirming, every tab is empty, exactly as after deleting everything.                 |
| Empty installation        | Delete all local data, then replace with export B.                                                         | Replacement succeeds. Nothing refuses it for having nothing to replace.                                                                           |
| Active workout            | Start a workout in dataset A, leave it active, then replace with an export holding its own active workout. | Only the incoming active workout is resumable. The previous one cannot be reached from any route.                                                 |
| Completed history         | Replace a dataset holding completed workouts.                                                              | History shows only the incoming completed workouts, with their own recorded sets.                                                                 |
| Deleted catalog reference | Replace with an export whose completed history references an exercise the file does not contain.           | The replacement succeeds and that history stays readable. Its snapshot is the truthful record.                                                    |
| Planner references        | Replace with an export containing a weekly plan.                                                           | Every planned exercise resolves to a restored definition and the plan opens normally.                                                             |
| Relaunch                  | Stop and relaunch after a successful replacement.                                                          | The replacement dataset is still there. Nothing from the previous dataset returns.                                                                |
| Export afterwards         | Export immediately after replacing.                                                                        | The new export contains the replacement dataset only.                                                                                             |
| Restore afterwards        | Open Restore my data after replacing.                                                                      | It refuses, because the installation now holds information, and points at replacement.                                                            |
| Delete afterwards         | Open Delete all local data after replacing.                                                                | It is available and unchanged.                                                                                                                    |
| Timezone                  | Replace on a device set to a different timezone from the one that recorded the data.                       | Occurrence dates and times are unchanged. No record moves across a day boundary.                                                                  |
| Offline                   | Enable airplane mode and replace.                                                                          | Replacement succeeds unchanged. No network prompt, no error, no delay attributable to connectivity.                                               |
| Schema intact             | After replacing, add records in every capability.                                                          | All of them save. No migration runs and no storage error appears.                                                                                 |

## Validation, gating, and cancellation

| Check                     | Steps                                                                                                    | Expected result                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Invalid file              | Choose the corrupted file.                                                                               | A clear failure appears, no destructive control is offered, and every record is still present afterwards. |
| Unsupported version       | Choose the version 2 file.                                                                               | The failure names the version problem specifically. Nothing is replaced.                                  |
| Oversized file            | Choose the file larger than 25 MB.                                                                       | It is refused before the contents are read. Nothing is replaced.                                          |
| Picker cancellation       | Open the picker and dismiss it.                                                                          | A neutral message appears. It is never described as a failure, and no record changes.                     |
| Gate before validation    | Open the screen and look for a way to replace before choosing a file.                                    | There is none. No acknowledgement and no destructive control exists yet.                                  |
| Acknowledgement required  | Validate a file, resolve the recovery decision, and press the destructive control without acknowledging. | Nothing happens, no alert opens, and the control reads as disabled with a stated reason.                  |
| Recovery required first   | Validate a file and acknowledge the replacement without resolving the recovery decision.                 | The destructive control stays disabled and says a copy decision is still needed.                          |
| Confirmation cancellation | Reach the alert and cancel it.                                                                           | Nothing is replaced, no busy state appears, and every record is still present after relaunching.          |
| Different file            | Resolve both decisions, then choose a different file.                                                    | Both decisions are cleared and the destructive control is disabled again.                                 |
| Repeat request            | Press the destructive control repeatedly while replacing.                                                | Only one replacement runs.                                                                                |

## Recovery copy

| Check                    | Steps                                                                          | Expected result                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Copy contents            | Create a recovery copy, share it to Files, then open it.                       | It contains dataset A only. No record from the incoming file appears in it.                                      |
| Honest wording           | Read the panel after the copy is created and after the share sheet closes.     | Neither says the file was saved. Both make clear the app cannot see the destination.                             |
| Share cancellation       | Open share options and dismiss the sheet.                                      | The outcome is neutral, the copy is still offered, and replacement is still allowed.                             |
| Continue without a copy  | Tick the opt-out acknowledgement instead of creating a copy.                   | Replacement becomes available after the replacement acknowledgement. No copy is created silently.                |
| Copy survives            | Create a copy, replace, then check Files and the completion panel.             | The completion panel says the copy is still on the device. It is not deleted by the replacement.                 |
| Copy cleanup             | After a replacement with a copy, open Export my data.                          | The held copy is gone, replaced by whatever that screen prepares. Nothing saved elsewhere is affected.           |
| Recovery failure         | Fill device storage, then try to create a recovery copy.                       | The failure is reported with a retry, no path is shown, and the opt-out is still the deliberate way to continue. |
| External files untouched | Replace with exports A and B saved in Files.                                   | Both files are still present, unchanged, with the same names and sizes.                                          |
| Recovering with the copy | After replacing A with B, delete all local data and restore the recovery copy. | Dataset A comes back. This is the path the copy exists for and it should be walked at least once.                |

## Failure and interruption

| Check                        | Steps                                                             | Expected result                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Background before confirming | Validate a file, acknowledge, background the app, and return.     | Nothing was replaced. Acknowledgements are not remembered across a relaunch.                                      |
| Force quit before confirming | Force quit at the preview, relaunch, and check every tab.         | The original dataset is intact and no decision was remembered.                                                    |
| Interruption while replacing | Background the app while it is replacing, then return.            | The app returns to a coherent state and never shows a half-replaced installation.                                 |
| Force quit while replacing   | Force quit during the replacement, relaunch, and check every tab. | The installation holds the original dataset or the complete replacement. Never a mixture, never empty.            |
| Low storage                  | Fill device storage, then replace.                                | Either the replacement succeeds, or it fails and says the current information was kept. Never a partial result.   |
| Failure wording              | Trigger any replacement failure.                                  | The message says the current information was kept, and contains no path, identifier, table name, or stored value. |

## Accessibility and visual review

| Check              | Expected result                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver/TalkBack | The explanation, preview, recovery panel, both acknowledgements, the destructive control, and the completion panel read in a sensible order.       |
| Acknowledgements   | Both are announced as checkboxes with their checked state, and neither carries its state by colour alone.                                          |
| Disabled control   | While disabled, the destructive control keeps the name "Replace all local data" and its label explains which decision is still missing.            |
| Alert              | The alert reads its title, message, and both options, and "Replace everything" is distinguishable from the screen's own control.                   |
| Focus              | Focus moves to the preview after validation and to the completion panel after replacing.                                                           |
| Live region        | Reading, checking, preparing the copy, and replacing are each announced politely.                                                                  |
| Dynamic Type       | At the largest practical sizes the explanation, preview counts, and both acknowledgements wrap without clipping, overlap, or horizontal scrolling. |
| Busy state         | Each phase shows a labelled busy indicator and the destructive control is visibly disabled.                                                        |
| No false cancel    | While replacing, no cancel control is offered, because the transaction cannot be half-cancelled.                                                   |
| Completion         | Completion is a persistent panel, not a transient toast, and stays readable after focus moves away.                                                |
| Keyboard           | With a hardware keyboard, both acknowledgements and every control are reachable and show a visible focus state.                                    |

## Performance and privacy

| Check             | Steps                                                                                | Expected result                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Large history     | Replace the large-history fixture and time each phase.                               | The app stays responsive, shows labelled phases, and invents no percentage.                  |
| Peak memory       | Watch memory while a large recovery copy and a large incoming file are both in play. | Memory rises for both datasets and returns afterwards. No crash, no warning from the system. |
| No network        | Watch network activity through the whole workflow.                                   | Nothing leaves the device except what the share sheet's chosen destination does on its own.  |
| No sensitive logs | Watch the device log through a full replacement and a failure.                       | No record, identifier, measurement, file path, or SQL appears.                               |
| Synthetic only    | Review every fixture used.                                                           | No real personal or fitness information was entered or exported at any point.                |
