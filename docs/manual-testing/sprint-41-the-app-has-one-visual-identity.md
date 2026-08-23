# Sprint 41 manual QA: the app has one visual identity

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target.

Never enter a real person's measurements, nutrition, or training history.

This sprint changes no stored value, session, set, result, record, migration,
index, query, reader contract, model, use case, or export. It replaces both color
palettes, adds a hero type step and a stat tile, and applies the card-variant
rule. **Every screen looks different and every screen states exactly what it
stated before.** Both halves of that sentence are what this checklist proves.

Do not repeat what the Sprint 41 Maestro suite already automates: that Today
announces its fluid totals and keeps its target control reachable, that the
Nutrition diary announces every total in the same order, and that Progress states
the values it stated before.

## What only manual QA can cover

An automated run reads the accessibility tree. It cannot see a color, measure a
rendered contrast, switch appearance, render at the largest accessible text size,
count announcement stops, or read data written by a previous build. The claims
below are therefore **manual only**.

## Preparing the fixture

One populated day and one empty day are enough, because this sprint changes
appearance rather than computation.

1. Complete the profile with metric units, and set a daily fluid target.
2. Log one food entry and one 500 mL water entry today.
3. Complete one workout with one weighted set.
4. Record one body-weight check-in.
5. Move the Nutrition and Today day controls back one day for the empty case.

## 1. Both appearances, all five tabs

Switch the device appearance in Settings while the app is open, on each tab.

| #   | Check                                    | Expected                                                                                                                                             |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Dark, every tab                          | Page is true black. One saturated green marks the active tab, primary buttons, and the loading indicator. Nothing else competes for it.              |
| 1.2 | Light, every tab                         | Page is near-white, cards white. The same green, deeper, in the same places.                                                                         |
| 1.3 | Switch appearance while a screen is open | The screen repaints immediately. No stored preference, no restart, no flash of the other theme.                                                      |
| 1.4 | Tab bar, both appearances                | Active label and icon are green, inactive are legible grey, and the bar's top edge is visible against the page.                                      |
| 1.5 | Every screen, both appearances           | No text is unreadable anywhere. Report any pair that looks marginal even if the assertions pass — the tests prove token values, not rendered output. |

## 2. The card-variant rule

Five cards changed variant this sprint. Two are on Today, two on Workout, one on
Progress.

| #   | Check                                                    | Expected                                                                                                                                             |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Today's fluid-target card, dark                          | Has a visible border, and "Change daily target" or "Set daily target" is inside it and tappable.                                                     |
| 2.2 | Workout's "Active workout" or "Start workout" card, dark | Has a visible border. Its buttons are inside it and tappable.                                                                                        |
| 2.3 | Progress's Nutrition card, dark                          | Has a visible border, matching the Hydration, Workouts, and Body weight cards below it. No card in that column looks like a different kind of thing. |
| 2.4 | Goals & Energy's "About these estimates" card, dark      | Deliberately has **no** border. It is a faint tonal block, and that is correct — it holds nothing to act on.                                         |
| 2.5 | Any remaining elevated card, dark                        | Reads as a plain filled block with no visible shadow. Expected: a black shadow on a black page renders nothing.                                      |
| 2.6 | The same five cards, light                               | Borders and shadows both visible. Nothing looks heavier than it did before.                                                                          |

## 3. Bright-light legibility

The one claim no test can make.

| #   | Check                                                                          | Expected                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1 | Take the device outdoors or under a bright lamp, dark appearance, Progress tab | Card edges are findable. Report honestly if they are not — the filled-on-black separation is 1.21:1 by design and this check is what decides whether that was the right trade. |
| 3.2 | Same conditions, Today tab                                                     | The fluid-totals card and the target card are distinguishable from the page and from each other.                                                                               |

## 4. Hero numerals and Dynamic Type

Set text to the largest accessibility size in Settings.

| #   | Check                              | Expected                                                                                                                          |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Today, largest size                | "500 mL" stays on one line, fully visible, shrinking rather than wrapping or being cut off.                                       |
| 4.2 | Nutrition diary, largest size      | The day's energy total behaves the same way.                                                                                      |
| 4.3 | Progress, largest size             | Every stat label and value wraps and stays readable. Nothing is clipped. The screen is very long; that is expected and unchanged. |
| 4.4 | Every changed screen, largest size | No control is unreachable and no text is truncated.                                                                               |
| 4.5 | Smallest size                      | Hero numerals still read as the screen's subject rather than as ordinary text.                                                    |

## 5. Announcements

Turn on VoiceOver (iOS) and TalkBack (Android). **Count the stops** and compare
against the previous build if one is available.

| #   | Check                        | Expected                                                                                                                          |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Progress, Nutrition card     | Each value is one stop announcing "label, value" — for example "Energy, 89 kcal". Stop count is unchanged.                        |
| 5.2 | Goals & Energy, both cards   | Each card is one stop announcing its identity followed by every value it shows. Unchanged.                                        |
| 5.3 | Today, fluid-totals card     | One stop, announcing the whole sentence. The hero numeral adds no stop.                                                           |
| 5.4 | Nutrition diary, totals card | One stop, energy first, then the entry count and every nutrient. Unchanged.                                                       |
| 5.5 | Today, target card           | Its lines and its button are separate stops, and the button is reachable.                                                         |
| 5.6 | Progress period control      | The selected option announces as selected. Confirm the selection is legible **and** announced — color alone is never the carrier. |
| 5.7 | Every changed screen         | No stop was added, removed, or reworded.                                                                                          |

## 6. Keyboard and focus

| #   | Check                                            | Expected                                                                                                                                                        |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Pair a keyboard, tab through Today and Profile   | Focus order is unchanged and every focused control shows a visible ring.                                                                                        |
| 6.2 | Focus a primary (green) button, both appearances | **Known limitation.** The ring separates from the page but not from the green fill beneath it. Record what you see; a two-tone ring is deferred, not forgotten. |
| 6.3 | Focus an outlined button and a pressable card    | Ring is clearly visible in both appearances.                                                                                                                    |

## 7. Nothing changed but the look

| #   | Check                                                                                             | Expected                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 7.1 | Compare each tab against the previous build, value by value                                       | Every number, unit, sentence, and label is identical.                                                         |
| 7.2 | Switch the profile to imperial and revisit Progress and Body measurements                         | Every value reads in imperial exactly as before.                                                              |
| 7.3 | Empty day on Today and Nutrition                                                                  | The same empty sentences, unchanged wording.                                                                  |
| 7.4 | A period with no completed workouts on Progress                                                   | "No completed workouts in this period." unchanged.                                                            |
| 7.5 | Force a read failure (airplane mode is not enough — use a fresh install mid-load if reproducible) | The error screens read exactly as before.                                                                     |
| 7.6 | Export your data and open the file                                                                | Format version and contents are unchanged. Compare against an export from the previous build if you have one. |
| 7.7 | Data recorded before this build                                                                   | Reads correctly after it. No migration ran.                                                                   |
| 7.8 | Airplane mode, every tab                                                                          | Everything works. No request is made.                                                                         |
| 7.9 | Device logs during the run                                                                        | No fitness, nutrition, identity, or measurement value is logged.                                              |

## Result

Record pass or fail per section with device, appearance, and text size. A failing
contrast observation is a product finding, not a test problem: report the screen,
the appearance, the ambient light, and what was hard to read, and do not adjust a
color to make it go away without deciding what the color is for.
