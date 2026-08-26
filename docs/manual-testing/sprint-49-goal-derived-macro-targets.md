# Sprint 49 manual QA: Goal-derived macronutrient targets

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). No Maestro, simulator,
> emulator, or automated UI suite is introduced or required for this
> capability, per [ADR 0033](../decisions/0033-risk-based-manual-device-testing.md).

Record device, OS, app build, network state, and result for every check. Use
synthetic data only; never enter a real person's profile or goal information.
Run the [critical smoke checklist](README.md#critical-smoke-checklist)
alongside these checks.

## Setup

A saved profile (height, weight, date of birth, biological sex, activity
level) that produces a supported energy estimate, then open Goals & energy.

## Display and consistency

| Check                          | Steps                                                                                | Expected result                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| No macros before a goal type   | Open the goal form with no goal type chosen.                                         | No calculated-target card, and no protein, carbohydrate, or fat line, is shown.                                                          |
| No macros out of range         | Choose "Lose weight" and enter an adjustment outside 100–500 kcal/day (e.g. 12).     | No calculated-target card and no macro lines appear; the field's own validation message shows instead.                                   |
| Macros appear with a target    | Choose "Lose weight" and enter a 250 kcal/day deficit.                               | The calculated-target card shows the calorie target, then Protein target, Carbohydrate target, and Fat target, each in whole grams.      |
| Grams match the calorie target | With the same fixture, hand-check: `protein g × 4 + carbohydrate g × 4 + fat g × 9`. | The sum equals the displayed calorie target's kilocalories (within whole-gram rounding of at most a few kilocalories).                   |
| Live with the form             | With the card open, change the deficit amount or switch to "Gain weight".            | The calorie target and all three macro values update together to match the new selection; none lags or shows a stale value.              |
| Saved goal reopens correctly   | Save a goal, leave Goals & energy, then return.                                      | The form reloads with the saved goal selected and the same calorie target and macro values shown as before leaving.                      |
| Maintain weight                | Choose "Maintain weight".                                                            | The card shows maintenance energy as the target, with macro targets derived from it, using the same fixed split as the other goal types. |

## Accessibility

| Check               | Steps                                                                                 | Expected result                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full announcement   | With VoiceOver (iOS) or TalkBack (Android) enabled, reach the calculated-target card. | One element announces, in order: "Calculated daily calorie target", "Calculated target", the value, the calorie caveat, "Protein target" and its value, "Carbohydrate target" and its value, "Fat target" and its value, then the macro caveat. Nothing is a separate stop. |
| Not a medical claim | Read the macro caveat sentence aloud or on screen.                                    | It states the target is general and not personalized nutrition or medical advice, matching the on-screen text exactly.                                                                                                                                                      |
| Dynamic Type        | Set the device to its largest accessibility text size, then reopen the card.          | Every line wraps and the card grows taller; nothing truncates, clips, or overlaps; the announcement is unchanged.                                                                                                                                                           |
| Not color-only      | Compare the macro lines to the calorie target line without relying on color.          | Meaning is clear from text and layout alone.                                                                                                                                                                                                                                |

## Privacy, offline, and persistence

| Check                  | Steps                                                                                | Expected result                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| No network             | Enable airplane mode and repeat the display checks above.                            | Every value renders identically. Nothing is requested and nothing fails.                             |
| No logging             | Watch the device log while opening the card and changing the goal.                   | No profile, goal, calorie, or macro value is logged.                                                 |
| No new persisted trace | Save a goal, then review the completed export and any Goals & energy data on device. | Nothing new appears — only `goal_type` and `adjustment_kilocalories` are present, exactly as before. |
