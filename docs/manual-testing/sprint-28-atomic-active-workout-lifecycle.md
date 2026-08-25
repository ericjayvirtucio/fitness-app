# Sprint 28 manual QA: Atomic active workout lifecycle

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target.

Never enter a real person's measurements or training history.

## Read this before running the checklist

**Every check below is a regression check.** Sprint 28 changed no wording, no
control, no confirmation, and no screen. It moved the discard write inside one
exclusive transaction so that an interrupted discard leaves the workout with
every set it held, instead of a workout that recovers with its recorded work
missing.

That difference is only observable when a storage write fails partway through,
which cannot be triggered from a device without a production failure switch or a
hidden route — neither of which exists, and neither of which will be added. The
proof of the fix is
`apps/mobile/src/features/workout-session/infrastructure/workout-session-discard-sqlite.spec.ts`,
which forces a failure at each intermediate point on a real SQLite engine and
compares every row of every table before and after.

The force-quit check below is the closest a device gets, and it will pass on a
broken build almost every time. Run this checklist to confirm nothing regressed,
not to confirm the fix landed.

`regression/08-workout-session.yaml` and `flows/workout/empty-session-lifecycle.yaml`
already automate starting an empty workout, relaunching, resuming, discarding,
and returning to the start control. Do not repeat those by hand.

## Preparing the fixtures

| Fixture          | How to produce it                                                                     |
| ---------------- | ------------------------------------------------------------------------------------- |
| Empty active     | Start an empty workout and add nothing.                                               |
| Loaded active    | An active workout holding at least two exercises and four recorded sets between them. |
| Recorded history | At least two completed workouts, one of them holding a personal record.               |
| Export file      | An export created before any discard, kept for the restore and replacement checks.    |

## Discarding

| Check                | Steps                                                                                                     | Expected result                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty workout        | Discard the empty-active fixture.                                                                         | It is gone. Workout offers to start again.                                                                                                  |
| Loaded workout       | Discard the loaded-active fixture.                                                                        | It is gone with every exercise and set. Workout offers to start again.                                                                      |
| Immediately          | Start a workout and discard it without touching anything else.                                            | Same result, with no error and no delay.                                                                                                    |
| Confirmation wording | Open the discard confirmation without confirming.                                                         | It says every recorded set will be permanently removed, and the confirming option reads differently from the control that opened it.        |
| Cancel               | Open the confirmation and cancel.                                                                         | The workout is untouched, with every set still listed.                                                                                      |
| After backgrounding  | Background the app during a loaded workout, return, then discard.                                         | The workout is still complete on return, and discards normally.                                                                             |
| Relaunch after       | Discard, stop the app, relaunch, open Workout.                                                            | No active workout. Nothing offers to resume.                                                                                                |
| Start after          | Discard, then start a new workout.                                                                        | A new empty workout starts. It does not resume the discarded one.                                                                           |
| Force-quit mid-write | Discard a loaded workout and force-quit during the confirmation press, if the device allows it. Relaunch. | Either the workout is gone, or it is present **with every set it held**. Never present and empty, never present with exercises but no sets. |

## Completed history is untouched

| Check            | Steps                                                            | Expected result                                                       |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| History list     | Discard a workout, then open Workout History.                    | Every completed workout is still listed, with unchanged summaries.    |
| Detail           | Open a completed workout after a discard.                        | Its exercises, sets, and recorded results are unchanged.              |
| Personal records | Check the exercise holding a record after a discard.             | The record is unchanged.                                              |
| Progress         | Open Progress after a discard.                                   | Workout totals reflect completed workouts only, unchanged by discard. |
| After force-quit | Repeat the history and record checks after the force-quit check. | Unchanged in either outcome.                                          |

## Units, data lifecycle, and platform

| Check                | Steps                                                                               | Expected result                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Both unit systems    | Record weight-based and distance-based sets in metric, discard; repeat in imperial. | Discard behaves identically. No value is misread on either preference.                                 |
| Export after discard | Create an export after discarding a loaded workout.                                 | It holds the completed workouts and no trace of the discarded one. Active workouts are never exported. |
| Restore after        | On a fresh install, restore the export file created before the discard.             | It restores normally. The precondition still requires an empty installation.                           |
| Replacement after    | Replace local data using the export file, having first discarded a workout.         | The replacement completes and the resulting data matches the file.                                     |
| Erasure after        | Discard a workout, then erase all local data.                                       | Everything is removed and the app reports a complete erasure.                                          |
| Dynamic Type         | Set the largest accessible text size and open a loaded workout.                     | The discard control remains reachable and readable; nothing is clipped or overlapped.                  |
| VoiceOver            | Reach the discard control and its confirmation with VoiceOver.                      | Both are announced by their labels, and the destructive option is distinguishable.                     |
| TalkBack             | Repeat the VoiceOver check on Android.                                              | Same result.                                                                                           |
| Keyboard             | Reach and operate the discard control with an attached keyboard.                    | Focus order is sensible and the confirmation is operable.                                              |
| No network           | Repeat the loaded discard in airplane mode.                                         | Identical behavior. Nothing waits on a network.                                                        |
| No sensitive logging | Watch the device log across every check above.                                      | No workout name, exercise name, set value, SQL, table name, or identifier is logged.                   |
