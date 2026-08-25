# Sprint 17 manual QA: Body measurement history

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the
create, persist, edit, and delete behavior that the Sprint 17 Maestro suite
already automates.

## Behavior worth checking by hand

| Check             | Steps                                                                           | Expected result                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Profile authority | Record a check-in with the profile update enabled, then edit that check-in.     | The profile weight follows the check-in once; the later edit changes history only and Goals & Energy stays on the profile. |
| Backdated entry   | Record a check-in dated before the newest one with the profile update enabled.  | History gains the entry; the current profile weight does not change.                                                       |
| Imperial entry    | Set the profile to imperial, record a check-in, then switch back to metric.     | The same stored measurement is shown in pounds and then kilograms with no value drift.                                     |
| Timezone          | Record a check-in, change the device timezone, and reopen history and Progress. | The recorded day, time, and period membership are unchanged.                                                               |
| Long values       | Record 499.9 kg with a 200-character note at the largest text size.             | Values, dates, and notes wrap without clipping or horizontal scrolling.                                                    |
| Paging            | Record more than 20 check-ins and use "Show older check-ins".                   | Older entries append in order with no duplicate, gap, or full reload.                                                      |
| Failure           | Induce a read failure on the history screen and retry.                          | The message states that nothing was changed and retry recovers.                                                            |

## Accessibility and visual review

| Check              | Expected result                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver/TalkBack | History rows read weight, date, time, and note as one phrase; the Progress card reads first, latest, recorded change, and count.      |
| Dynamic Type       | Largest practical sizes wrap the entry form, history cards, and the Progress card without clipping or overlap.                        |
| Keyboard           | Focus order follows weight, date, time, note, profile-update choice, save, cancel, and delete; the decimal keypad appears for weight. |
| Destructive action | The delete confirmation names the consequence and says the profile weight is unchanged; Cancel leaves the record intact.              |
| Appearance         | Light and dark mode keep values, helper text, errors, and the selected profile-update option legible without color-only meaning.      |
| Touch targets      | The add button, history cards, unit choice, and destructive action all meet the minimum target on a physical device.                  |
| Language           | No screen implies a trend, target, diagnosis, or health recommendation.                                                               |

## Automated harness and reports

Run `./scripts/qa.sh sprint 17 --platform ios` and, when available, Android.
Confirm four scenario lines, correct totals and exit status, and the presence
of `junit.xml`, `report.txt`, `report.json`, `cli.log`, and debug evidence.
Then run `./scripts/qa.sh regression --platform ios` on the final branch state.
Inspect artifacts for synthetic measurement values only.
