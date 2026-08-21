# Sprint 39 manual QA: Progress counts every nutrient you logged

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat proving that
a period counts every nutrient it was given, that sodium is counted in
milligrams, or that an omitted nutrient is incomplete rather than absent — the
Sprint 39 Maestro suite and regression scenario 32 already automate all three.

Never enter a real person's measurements, nutrition, or training history.

This sprint changes no stored value, entry, daily total, migration, index, or
export. It widens one SQL projection over columns that already exist. Every
check below compares what the application recorded against what the Progress tab
now says.

## What only manual QA can cover

An end-to-end run cannot span two logged days without falling outside the
selected week on a Sunday, exercise a screen reader, render at the largest
accessible text size, or read data written by a previous build. The claims below
are therefore **manual only**:

- a nutrient average over more than one logged day, where the average differs
  from the total;
- a period where exactly one entry omits exactly one of the three new nutrients;
- a period where sodium alone is supplied;
- Day, Week, and Month periods and the moves between them;
- VoiceOver and TalkBack, metric by metric, **with the stop count recorded**;
- keyboard navigation and focus order;
- Dynamic Type at the largest accessible size, on a card that is now roughly
  twice as tall;
- both unit systems;
- data recorded before this build, read after it.

Produce each through the product's own controls. Do not add a fixture, a seeder,
or a hidden route.

## Preparing the fixtures

| Fixture                  | How to produce it                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| All six nutrients        | Add a one-time entry and fill Protein, Carbohydrate, Fat, Fiber, Sugar, and Sodium as well as Energy. |
| Two complete logged days | Record one such entry today and another after pressing Previous on the Nutrition tab.                 |
| One omitted new nutrient | Add a second entry on one of those days leaving **Fiber** blank and every other nutrient filled.      |
| Sodium alone             | Add an entry filling Energy and Sodium only, leaving the other five blank.                            |
| No nutrition             | A period holding hydration or a workout but no food or beverage entry.                                |
| Nothing recorded         | A freshly erased installation, or a period navigated back past every recorded day.                    |
| A back-dated entry       | Press Previous on the Nutrition tab before adding, as Sprint 37 made possible.                        |
| Two unit systems         | Switch the profile's preferred unit system between passes.                                            |
| Recorded before          | Data recorded on the previous build, read after installing this one.                                  |

## The Nutrition card counts every nutrient

With at least one logged day, confirm the card renders exactly these **sixteen**
metrics, in this order, and the sentence below them only when something is
incomplete:

| #   | Line                                  | Expected                                             |
| --- | ------------------------------------- | ---------------------------------------------------- |
| 1   | `Energy`                              | the period total                                     |
| 2   | `Average energy per logged day`       | the total divided by `Logged days`                   |
| 3   | `Logged days`                         | days holding at least one nutrition entry            |
| 4   | `Entries`                             | entries across those days                            |
| 5   | `Protein`                             | grams, or `Incomplete`                               |
| 6   | `Average protein per logged day`      | grams, or `Incomplete`                               |
| 7   | `Carbohydrate`                        | grams, or `Incomplete`                               |
| 8   | `Average carbohydrate per logged day` | grams, or `Incomplete`                               |
| 9   | `Fat`                                 | grams, or `Incomplete`                               |
| 10  | `Average fat per logged day`          | grams, or `Incomplete`                               |
| 11  | `Fiber`                               | grams, or `Incomplete`                               |
| 12  | `Average fiber per logged day`        | grams, or `Incomplete`                               |
| 13  | `Sugar`                               | grams, or `Incomplete`                               |
| 14  | `Average sugar per logged day`        | grams, or `Incomplete`                               |
| 15  | `Sodium`                              | **milligrams**, or `Incomplete`                      |
| 16  | `Average sodium per logged day`       | **milligrams**, or `Incomplete`                      |
| —   | the completeness sentence             | only when at least one of the six reads `Incomplete` |

The count is sixteen whatever the data contains. A nutrient's total and its
average are unknown together, so completeness never changes the card's height.

- [ ] Sixteen metrics render in that order for a complete period.
- [ ] Sixteen metrics still render when every nutrient is incomplete.
- [ ] `Sodium` and its average carry `mg`. Every other nutrient carries `g`.
- [ ] No line reads a bare number without a unit.

## Sodium is the milligram nutrient, on both screens

- [ ] Record an entry with `Sodium (mg)` set to `450` and a reference of 100.
- [ ] The nutrition diary's day totals read `Sodium: 450 mg`.
- [ ] The Progress Day period reads `Sodium, 450 mg` — **the same number and the
      same unit**, not `0.45 g` and not `450 g`.
- [ ] A month's accumulated sodium renders with a thousands separator, for
      example `70,300 mg`.

## An unknown is never a number

- [ ] A period where one entry omits Fiber reads `Fiber, Incomplete` and
      `Average fiber per logged day, Incomplete`.
- [ ] Every other nutrient in that same period reads an exact quantity.
- [ ] Nothing in the card reads `0 g`, `0 mg`, or a blank where a nutrient was
      omitted.
- [ ] The completeness sentence renders. Confirm it renders when the **only**
      incomplete nutrient is one of the three new ones.
- [ ] The sentence does **not** render when all six nutrients are supplied.

## The average's denominator

- [ ] Build two logged days whose fiber totals differ, in a period longer than
      two days.
- [ ] `Average fiber per logged day` equals the fiber total divided by
      `Logged days`, not by days in the period.
- [ ] The same holds for sugar and sodium.
- [ ] Compare against `Average protein per logged day`, whose denominator this
      sprint did not change.

## The period agrees with the day, value by value

- [ ] Select the `Today` period with exactly one logged day.
- [ ] Open the nutrition diary on that same day.
- [ ] Compare all six nutrients one at a time. Each pair must match in **number
      and unit**.
- [ ] Where the diary says `Incomplete`, Progress says `Incomplete`.
- [ ] The diary's own six lines, its totals card name, and its explanation
      sentence are unchanged from the previous build.

## Periods and navigation

- [ ] Day, Week, and Month each render the sixteen metrics.
- [ ] Moving Previous and Next recomputes them, and a rapid sequence of presses
      leaves the newest selection on screen.
- [ ] A period with no nutrition renders `No nutrition logged in this period.`
      and nothing else — no nutrient line, no average, no sentence.
- [ ] A period with nothing recorded at all renders every card's empty sentence.
- [ ] A back-dated entry recorded through Sprint 37's change is counted by the
      period containing the day it was recorded to.

## Assistive technology

Count the stops and write the number down. This is the check that decides
whether the card's height needs a follow-up.

- [ ] VoiceOver: swipe through the Nutrition card and record the total number of
      stops. Expect **17** for a complete period (heading plus sixteen metrics)
      and **18** for an incomplete one.
- [ ] Each metric announces `label, value` as one utterance — for example
      `Average sodium per logged day, 450 mg`.
- [ ] An incomplete nutrient announces `Incomplete` inside its own name.
- [ ] The heading rotor reaches `Nutrition`, `Hydration`, `Workouts`,
      `Body weight`, and `Daily activity`, so the card can be skipped in one
      gesture.
- [ ] TalkBack: repeat the above.
- [ ] No card on the Progress tab is a single element hiding its children.
- [ ] No control is unreachable.
- [ ] Keyboard: focus order follows render order through the whole card, and no
      element is skipped or trapped.
- [ ] Completeness is legible without colour.

## Dynamic Type

- [ ] At the largest accessible size, every metric wraps to label above value.
- [ ] Nothing truncates, clips, or overlaps.
- [ ] The longest label, `Average carbohydrate per logged day`, wraps within
      itself.
- [ ] The whole card is reachable by scrolling, and the Hydration, Workouts, and
      Body weight cards below it are still reachable.
- [ ] Record how many screens of scrolling the Nutrition card occupies.

## Unchanged behavior

- [ ] Both unit systems render the same nutrient numbers; the preference affects
      body weight only.
- [ ] The Hydration, Workouts, and Body weight cards show the same values as the
      previous build.
- [ ] Daily activity rows are unchanged.
- [ ] Export the data and compare the file against one produced by the previous
      build from the same records. It must be identical.
- [ ] Restore, erase, and replacement behave as before.
- [ ] Data recorded before this build reads identically after it.

## Privacy, security, and failure

- [ ] Airplane mode throughout. Every check above still passes.
- [ ] No console or device log contains a nutrient value, a description, or a
      date.
- [ ] Force a load failure and confirm the screen reads `Progress unavailable`,
      `Progress could not be loaded from this device.`, and offers `Try Again`.
- [ ] No error text contains SQL, a table name, a column name, a file path, or a
      stack trace.
- [ ] Retry recovers without relaunching.
