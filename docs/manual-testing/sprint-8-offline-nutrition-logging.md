# Sprint 8 offline nutrition logging manual QA

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record the device/simulator, OS version, app build, appearance, and result for
each available platform. Do not claim an unavailable platform was tested.

## Database and offline behavior

- Upgrade an installation with schema version 3 and confirm existing profile and
  goal data remain intact.
- Cold-start a fresh installation and open Nutrition.
- Disable network access, create an entry, restart the app, and confirm it remains.
- Force-close during normal use and confirm the diary reopens without data loss.

## Create and totals

- Create a mass-based food with energy and all nutrients.
- Create a volume-based caloric beverage.
- Confirm proportional upscaling and downscaling from reference to consumed amount.
- Leave one nutrient blank and enter zero for another; confirm “Incomplete” versus
  `0` remains distinct on the daily summary.
- Confirm future consumption is rejected and valid historical consumption saves.
- Confirm invalid dates, times, negative values, nonnumeric values, zero physical
  quantities, and mismatched required fields show safe validation.

## Date boundaries

- Create entries immediately before and after local midnight and confirm they
  appear on the expected days.
- Change the simulator/device timezone and confirm existing entries remain on
  their captured calendar dates.
- Where available, test a daylight-saving transition date and confirm a valid
  saved entry retains its displayed time and day after restart.

## Edit and delete

- Edit description, source facts, consumed amount, kind, and occurrence time;
  confirm totals refresh and the UUID-backed entry is not duplicated.
- Change a complete entry from mass to volume by entering new physical values;
  confirm no automatic conversion occurs.
- Cancel an edit and confirm nothing changes.
- Cancel deletion and confirm the entry remains.
- Confirm deletion and verify the entry and totals are removed after restart.

## Failure and recovery

- Exercise a simulated read failure and confirm retry is available without a
  destructive reset.
- Exercise a simulated save/delete failure and confirm existing entries remain and
  no technical details or food values appear in the error.

## Accessibility and appearance

- Verify light and dark appearance and sufficient contrast.
- Verify large accessibility text without clipped labels or unreachable controls.
- Verify keyboard avoidance and dismissal throughout the editor.
- With VoiceOver on iOS, verify headings, radio selections, unit labels, entry
  buttons, date navigation, errors, and destructive confirmation.
- With TalkBack on Android, repeat the same journey.
- Confirm every touch target is comfortable and meaning never relies on color.
