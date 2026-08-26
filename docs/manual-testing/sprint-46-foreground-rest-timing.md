# Sprint 46 manual QA: Foreground rest timing

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). No Maestro, simulator,
> emulator, or automated UI suite is introduced or required for this
> capability, per [ADR 0033](../decisions/0033-risk-based-manual-device-testing.md).

Record device, OS, app build, network state, and result for every check. Use
synthetic data only; never enter a real person's training history. Run the
[critical smoke checklist](README.md#critical-smoke-checklist) alongside
these checks.

## Setup

Start or resume an active Workout Session with at least one exercise added,
so a set can be recorded.

## Offer and interaction

| Check                          | Steps                                                                                   | Expected result                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| No offer before a save         | Open an active session that has never had a set saved this visit.                       | No rest countdown or preset offer is visible.                                                                              |
| Offer after success            | Record a valid set and save it.                                                         | A "Rest" section appears with four preset buttons (0:60, 1:30, 2:00, 3:00) and no timer running yet.                       |
| No offer after a rejected save | Attempt to save with a value the app rejects, or force a save failure.                  | The set editor stays open with an error message. No rest offer appears or changes.                                         |
| Explicit start only            | With the offer visible, do nothing further.                                             | No countdown starts on its own.                                                                                            |
| Start a preset                 | Press one preset button (e.g. 1:30).                                                    | The countdown starts immediately at that duration and counts down; the four preset buttons are replaced by a Stop control. |
| Stop while running             | Press Stop partway through a countdown.                                                 | The countdown clears and the four preset buttons reappear.                                                                 |
| Restart after stopping         | Stop a countdown, then start a different preset.                                        | The new countdown starts fresh at the newly chosen duration, not resuming the old one.                                     |
| Rapid double-press             | Try to press a preset button twice quickly, or Start then Stop in immediate succession. | Behaves exactly as one deliberate press each time; no duplicate or stuck countdown.                                        |

## Completion and accessibility

| Check                        | Steps                                                                                          | Expected result                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reaching zero                | Let a short preset (60s) run to completion without touching the screen.                        | The display reads `0:00`; a "Rest complete" message appears alongside a Dismiss control.                                                                      |
| Completion announced once    | Repeat the above with VoiceOver (iOS) or TalkBack (Android) enabled.                           | "Rest complete" is announced exactly once when the countdown finishes — not repeated, and not announced every second while counting down.                     |
| Dismiss after completion     | Press Dismiss after completion.                                                                | The four preset buttons reappear.                                                                                                                             |
| Screen-reader names          | With VoiceOver/TalkBack enabled, explore the preset buttons and the running/completed control. | Each preset announces "Start rest timer, [N] seconds"; the running and completed control both announce "Stop rest timer".                                     |
| Large Dynamic Type           | Set the device to its largest accessibility text size, then start a countdown.                 | The remaining-time numeral shrinks to stay on one line rather than wrapping, clipping, or overflowing the screen; every button remains reachable and legible. |
| Not color-only               | Compare the running and completed states without relying on color.                             | The state is clear from text alone ("Rest complete" wording, the visible numeral) — no meaning depends on color.                                              |
| Distinct from a recorded set | Compare the rest countdown region to a recorded set's row (e.g. a duration-mode exercise).     | The two are visually and structurally distinct; nothing about the countdown reads as a recorded value.                                                        |

## Foreground/background lifecycle

| Check                               | Steps                                                                                  | Expected result                                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backgrounding mid-countdown         | Start a countdown, background the app for longer than the remaining time, then return. | On return, the countdown shows completed (or very close to elapsed) — no notification, alert, sound, or vibration ever appeared while backgrounded. |
| Backgrounding briefly               | Start a countdown, background the app briefly (a few seconds), then return.            | Remaining time reflects the true elapsed time, not paused or reset.                                                                                 |
| Leaving the screen (Finish/Discard) | Start a countdown, then finish or discard the workout.                                 | The countdown is gone; no error, crash, or stray timer behavior occurs.                                                                             |
| Leaving the screen (Rename)         | Start a countdown, then open Rename This Workout, then return.                         | The countdown is still counting down when you return — it was never on a background screen.                                                         |
| App termination                     | Start a countdown, then force-quit the app, then relaunch.                             | On relaunch, the active session resumes normally with no rest countdown showing — this is expected, not a bug.                                      |

## Recorded-data integrity

| Check                      | Steps                                                                                                    | Expected result                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Sets survive a countdown   | Record two or three sets, starting and letting a countdown run or stopping it between each.              | Every set is present, correct, and in order after finishing the workout.                    |
| Sets survive backgrounding | Record a set, start a countdown, background the app until it completes, return, then finish the workout. | The recorded set is intact in completed history; nothing about the countdown appears there. |
| No new field anywhere      | Review the completed workout, export, and Progress after using rest timing during a session.             | Nothing new appears in any of them — rest timing produced no persisted trace.               |
