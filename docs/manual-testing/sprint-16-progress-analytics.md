# Sprint 16 manual QA: Progress analytics and QA reporting

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target.

## Progress behavior

| Check      | Steps                                                                                  | Expected result                                                                                              |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Empty      | Clear app data and open Progress.                                                      | Nutrition, Hydration, and Workouts each explain that no records exist; averages are not zero.                |
| Periods    | Select Today, This Week, and This Month; navigate backward.                            | Day, Sunday–Saturday week, and calendar-month labels and records are correct; future navigation is disabled. |
| Nutrition  | Log known-zero energy, complete macros, and an entry with an unknown macro.            | Zero stays zero; unlogged dates are absent from averages; the affected macro says Incomplete.                |
| Hydration  | Log plain water and another fluid across several dates.                                | Totals and logged-day averages are correct; no historical target-adherence claim appears.                    |
| Workouts   | Create a plan, leave an active session, then complete a session with actual sets.      | Plan and active session do not count; only the completed session and actual results appear.                  |
| Restart    | Record all three capabilities, terminate, relaunch offline, and open Progress.         | Derived summaries restore from local history without a network request.                                      |
| Boundaries | Exercise Saturday/Sunday, month end, leap February, DST, and a device-timezone change. | Captured local-day membership remains stable with no duplicate or omitted record.                            |
| Failure    | Inject an initial read failure and retry; induce an older slow period response.        | Retry is actionable; a stale result never replaces the latest selection.                                     |

## Accessibility and visual review

| Check              | Expected result                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver/TalkBack | Period controls expose selected state; headings, metric/value pairs, incomplete explanations, and daily rows read coherently. |
| Dynamic Type       | Largest practical sizes wrap without clipping, overlap, hidden values, or horizontal scrolling.                               |
| Keyboard           | Focus order follows period, navigation, summaries, and daily activity; disabled Next is announced.                            |
| Appearance         | Light/dark text, borders, selection, errors, and disabled states remain legible without color-only meaning.                   |
| Small screens      | Summary rows and date labels wrap while preserving readable grouping.                                                         |

## Automated harness and reports

Run `./scripts/qa.sh sprint 16 --platform ios` and, when available, Android.
Confirm four scenario lines, correct totals and exit status, and the presence of
`junit.xml`, `report.txt`, `report.json`, `cli.log`, and debug evidence. Force one
selector failure on a disposable run and confirm the failing scenario, source,
message, artifact directory, and nonzero status are preserved. Inspect artifacts
for synthetic data only, then restore the flow before merge.
