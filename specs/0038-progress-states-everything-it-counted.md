# Specification 0038: Progress states everything it counted

- Status: Approved
- Date: 2026-08-21

## Objective and scope

Make the Progress tab present every value its summary computes, so a person
reads what the application counted rather than a subset of it. The Nutrition
card gains an average per logged day for protein, carbohydrate, and fat beside
each existing total. The Hydration card gains the period's non-water fluid and
an average plain water per logged day.

Two labels are renamed so that four averages on one card each name the value
they average. One redundant model field is removed. Two fallbacks that would
have displayed an unknown as zero are removed.

Version 1 changes presentation, one read-model type, and one use-case return
shape. No value's arithmetic changes.

`@fitness/domain`, `apps/api`, every progress reader contract and its SQLite
implementation, every SQL statement, every migration, user version 11, export
format version 1, the restore parser, local erasure, replacement restore, every
composition root, every daily total, every hydration target, the nutrition
diary, the hydration daily screen, body measurements, workouts, history,
personal records, correction, and naming are untouched. No stored value, total,
average definition, denominator, record, tie, or evidence link changes.

Charts, a Progress redesign, fiber, sugar, and sodium in Progress, adherence
against the calculated calorie target, streaks, a custom date range, versioned
hydration targets, localization, and export format changes remain excluded.

## The gap this closes

Every value the progress summary produces was audited against the SQL that
reads it, the use case that computes it, the model that types it, and the screen
that renders it.

### Nutrition

| Value                | SQL | Use case | Model | Screen                   |
| -------------------- | --- | -------- | ----- | ------------------------ |
| Energy               | yes | yes      | yes   | `Energy`                 |
| Energy average       | —   | yes      | yes   | `Average per logged day` |
| Logged days          | yes | yes      | yes   | `Logged days`            |
| Entries              | yes | yes      | yes   | `Entries`                |
| Protein total        | yes | yes      | yes   | `Protein`                |
| Protein completeness | yes | yes      | yes   | one sentence's condition |
| Protein average      | —   | yes      | yes   | **nothing**              |
| Carbohydrate total   | yes | yes      | yes   | `Carbohydrate`           |
| Carbohydrate average | —   | yes      | yes   | **nothing**              |
| Fat total            | yes | yes      | yes   | `Fat`                    |
| Fat average          | —   | yes      | yes   | **nothing**              |

### Hydration

| Value               | SQL | Use case | Model | Screen                   |
| ------------------- | --- | -------- | ----- | ------------------------ |
| Total fluid         | yes | yes      | yes   | `Total fluid`            |
| Plain water         | yes | yes      | yes   | `Plain water`            |
| Other fluid         | yes | yes      | yes   | **nothing**              |
| Fluid average       | —   | yes      | yes   | `Average per logged day` |
| Plain water average | —   | yes      | yes   | **nothing**              |
| Logged days         | yes | yes      | yes   | `Logged days`            |
| Entries             | yes | yes      | yes   | `Entries`                |

Three values are computed on every load, typed in the read model, and read by
nobody. `averageGramsPerLoggedDay` and
`averagePlainWaterMillilitersPerLoggedDay` appear only in
`get-progress-summary-use-case.ts` and `progress-models.ts`.
`otherFluidMilliliters` appears in those two files and in the hydration reader
that produces it. No presentation file mentions any of the three.

This is a defect rather than a curated presentation, and the repository says so
rather than a preference.

[Specification 0016](0016-progress-analytics-and-qa-reporting.md) enumerates the
missing values by name. It states that the selected period presents "Protein,
carbohydrate, and fat totals/averages are exact only when every included entry
supplies that nutrient", and "Hydration total fluid, plain water, other fluid,
entry count, logged days, and averages over hydration-logged days." That
specification is Approved. The implementation computes what it promises and then
discards it.

The [offline Progress architecture](../docs/architecture/offline-progress-analytics.md)
agrees, in a document describing shipped behavior: "if one entry is unknown, its
period total and average are not claimed as exact." A rule about how an average
is presented presumes the average is presented.

A curated subset does not type what it curates away. These three values are
carried through two layers and declared on an immutable read model, which is
what a value that was meant to be displayed looks like.

The cost is small and real. A person tracking protein sees a period total —
the question almost nobody asks — while the daily average, the number people
track against, is computed on every load and withheld. A person who logs coffee
and water is shown `Total fluid` and `Plain water` and left to subtract, for a
number the hydration daily screen names outright as `Other fluids`.

## Deleting the values instead was considered and rejected

The honest alternative to displaying a computed-and-discarded value is deleting
it. It was priced rather than dismissed.

Deleting the three fields removes roughly fourteen lines from the use case and
three from the model. It also requires amending an Approved specification to
withdraw three values it promises, which is a harder review than adding lines.
It leaves a person subtracting to learn a number the day screen states. And it
does not remove the computation: `other_fluid_milliliters` is a `SUM` inside the
hydration statement and a field on the reader contract, so deleting the summary
field leaves the same value computed and discarded one layer lower.

## Every value is displayed

### The Nutrition card

In the branch where the period holds at least one logged nutrition day, the card
renders, in order:

| Line                                                                  | Value form  |
| --------------------------------------------------------------------- | ----------- |
| `Energy`                                                              | `1000 kcal` |
| `Average energy per logged day`                                       | `1000 kcal` |
| `Logged days`                                                         | `1`         |
| `Entries`                                                             | `1`         |
| `Protein`                                                             | `30 g`      |
| `Average protein per logged day`                                      | `30 g`      |
| `Carbohydrate`                                                        | `30 g`      |
| `Average carbohydrate per logged day`                                 | `30 g`      |
| `Fat`                                                                 | `10 g`      |
| `Average fat per logged day`                                          | `10 g`      |
| `Incomplete means one or more entries did not include that nutrient.` | conditional |

A period holding no logged nutrition day renders
`No nutrition logged in this period.` and nothing else, unchanged.

### The Hydration card

| Line                                 | Value form |
| ------------------------------------ | ---------- |
| `Total fluid`                        | `750 mL`   |
| `Plain water`                        | `500 mL`   |
| `Other fluids`                       | `250 mL`   |
| `Average fluid per logged day`       | `750 mL`   |
| `Average plain water per logged day` | `500 mL`   |
| `Logged days`                        | `1`        |
| `Entries`                            | `2`        |

A period holding no logged hydration day renders
`No hydration logged in this period.` and nothing else, unchanged.

`Other fluids` is the string the hydration daily screen already renders, so the
day view and the period view use one word for one thing.

## A total and its average are two lines

Each average is its own `Metric`, directly beneath the total it averages. The
screen already ships this pattern for energy.

The rejected alternative was one `Metric` carrying both values, which keeps the
card's height. `Metric` composes `label, value` into a single accessible
element, so combining would make one spoken utterance carry two numbers, would
give the value column a shape that varies with completeness, and would introduce
a composition path beside the two formatters the screen already uses.

The accepted cost is height: the Nutrition card grows from seven metrics to ten
and the Hydration card from five to seven.

## Each average names the value it averages

`Average per logged day` was unambiguous while one average existed per card. It
cannot survive four on one card: a person navigating by accessible element would
land on a label that names no subject.

Two visible strings change:

| Before                   | After                           |
| ------------------------ | ------------------------------- |
| `Average per logged day` | `Average energy per logged day` |
| `Average per logged day` | `Average fluid per logged day`  |

Every label now names its subject and states its denominator in the same phrase,
which is the shape [ADR 0023](../docs/decisions/0023-displayed-totals-state-their-coverage.md)
requires of a coverage statement: unconditional, positive, and short.

## The denominator

`summarizeNutrient` divides a nutrient's period total by the number of values it
was given, which is one per row returned by `NutritionProgressReader`, which is
one per calendar date in range holding at least one nutrition entry. That count
is `loggedDayCount`, and the card names it on the line `Logged days`.

The average is therefore **per nutrition-logged day**. It is not per day in the
period, and it is not per day on which that nutrient was known — the second is
unreachable by construction, because a single unknown entry nullifies the whole
period's total and its average together.

Hydration's two averages divide by `loggedDayCount` in the same sense: one per
calendar date holding at least one hydration entry.

## An unknown average reads as an unknown total

A nutrient's total and its average are null together, because the average is
derived from the total. Both render through `formatProgressMass`, so both read
`Incomplete`, with the same word for the same reason.

The card therefore renders exactly ten metrics in the logged-days branch,
whatever the data contains. Its height stops varying with completeness, which
closes a fixture-dependent height rather than opening one.

## The completeness sentence stays conditional

`Incomplete means one or more entries did not include that nutrient.` renders
only when a nutrient is incomplete, and that is deliberate.

[ADR 0023](../docs/decisions/0023-displayed-totals-state-their-coverage.md)
states that "a qualifier that appears only sometimes is a qualifier a person
cannot rely on". That rule governs a coverage claim attached to a number a
person cannot otherwise assess. Here the coverage claim is the value itself: the
line reads `Incomplete` or it reads a quantity, unconditionally, in every
period. The sentence is not the coverage claim. It defines the word `Incomplete`
for a reader meeting it, and a definition of a word that is not on screen
explains nothing while inviting a search for something incomplete.

The nutrition diary composes its own completeness explanation the same
conditional way, and Sprint 34 shipped it inside a composed card name.

[ADR 0028](../docs/decisions/0028-a-summary-states-every-value-it-computes.md)
records this boundary, because it is the reading that decides the question and
it should not be re-derived.

## `Other fluids` needs no coverage sentence

Migration 11's hydration table constrains `fluid_type IN ('plain-water',
'other-fluid')`, and the hydration statement sums two disjoint `CASE`
expressions over exactly those two values. `Plain water` and `Other fluids` are
exhaustive over `Total fluid` by construction, so no fluid is excluded from the
three lines and there is nothing for them to state.

## Two names for one fact are collapsed

`summarizeNutrient` assigned `totalGrams = isComplete ? sum(...) : null`, so on
`ProgressNutrientSummary` the two fields were one fact written twice, and a
future reader could consult either. `ProgressScreen` read `isComplete` in one
place: the condition on the sentence above.

`isComplete` is removed from `ProgressNutrientSummary`. The screen names the
condition it needs:

```ts
const hasIncompleteNutrient = [
  value.protein,
  value.carbohydrate,
  value.fat,
].some((item) => item.totalGrams === null);
```

`NutrientProgressValue.isComplete` on the nutrition reader contract is
unchanged. The reader genuinely uses it to decide the null, from
`knownCount === entryCount`, and a reader contract is outside this
specification's scope. The same redundancy therefore survives one layer down,
recorded here as debt rather than fixed under a presentation change.

## An unknown is never rendered as zero

`ProgressScreen` rendered
`formatProgressEnergy(value.averageEnergyKilojoulesPerLoggedDay ?? 0)` and the
hydration equivalent. Both averages are null exactly when `loggedDayCount === 0`,
and both metrics render only inside the branch where `loggedDayCount !== 0`, so
neither fallback is reachable today.

An unreachable instruction to display an unknown as zero is still an instruction
to display an unknown as zero, and
[ADR 0023](../docs/decisions/0023-displayed-totals-state-their-coverage.md)
exists because that is a lie. Both fallbacks are removed. Each average line
renders only when its value exists, which is the pattern the same file already
uses for a null `repetitions` and a null `changeGrams`.

## Ownership

Nothing belongs in `@fitness/domain`. Every value here is a read-time aggregate
over captured rows, which [ADR 0010](../docs/decisions/0010-derived-workout-history-progress.md)
and [ADR 0011](../docs/decisions/0011-cross-capability-derived-progress-analytics.md)
place in the application layer, and no invariant, unit conversion, or rule of the
product is involved. `formatProgressMass` and `formatProgressVolume` already
produce every string this specification renders, so `progress-formatting.ts` is
unchanged and no second formatting path appears.

`progress-models.ts` loses one field. `get-progress-summary-use-case.ts` stops
returning it. `ProgressScreen.tsx` renders five more lines and renames two
labels. That is the whole of the production change, other than three test
identifiers added to the optional-nutrient fields on the consumption entry form
so an end-to-end run can supply a complete nutrient.

No reader contract, SQL statement, query, or composition root changes. The only
consumer of `ProgressSummary` is `ProgressScreen`.

## No migration, and the schema that proves it

Every value this specification displays is already produced. `other_fluid_milliliters`
is an existing `SUM(CASE WHEN fluid_type = 'other-fluid' …)` in the hydration
statement, and both new averages are arithmetic over rows the existing
statements already return. No table, column, index, constraint, trigger, or
statement is added or altered, so the schema stays at user version 11 and the
migration list keeps its eleven entries.

## Error model

This specification adds no write and no query, so it adds no failure mode. The
existing boundary is reused unchanged: a reader that fails mid-load replaces the
screen with `Progress unavailable`, `Progress could not be loaded from this
device.`, and a `Try Again` control. No error text contains SQL, a table name, an
identifier, an internal path, or a stack trace.

Empty and incomplete outcomes are defined and safe:

- a period in which every nutrient is incomplete renders all ten metrics, with
  three totals and three averages reading `Incomplete`, above the completeness
  sentence;
- a period with logged days but no hydration renders
  `No hydration logged in this period.`;
- a period with no logged days at all renders both empty sentences, and no
  average, no `Other fluids`, and no new string appears anywhere.

## User-facing behavior

The Nutrition card gains three lines and renames one. The Hydration card gains
two lines and renames one. The Workouts card, the Body weight card, Daily
activity, the period control, the previous and next controls, the screen header,
and the screen's subtitle are unchanged.

## Experience and accessibility

The Progress summary cards carry no `accessibilityLabel`, so each `Metric` is
its own accessible element and the new lines add accessibility stops rather than
burying existing ones. Neither changed card gains a control, so neither may gain
a label, and [ADR 0024](../docs/decisions/0024-labelled-containers-announce-their-contents.md)'s
guarantee that no labelled card contains an interactive child is preserved
unchanged across all nineteen labelled cards.

Accessible names added:

- `Average protein per logged day, 30 g`
- `Average carbohydrate per logged day, 30 g`
- `Average fat per logged day, 10 g`
- `Other fluids, 250 mL`
- `Average plain water per logged day, 500 mL`

Accessible names changed:

| Before                              | After                                      |
| ----------------------------------- | ------------------------------------------ |
| `Average per logged day, 1000 kcal` | `Average energy per logged day, 1000 kcal` |
| `Average per logged day, 500 mL`    | `Average fluid per logged day, 750 mL`     |

An incomplete nutrient announces `Average protein per logged day, Incomplete`.
Completeness is never signalled by colour.

`Metric` lays out its label and value in a row that wraps, so at the largest
accessible Dynamic Type size each row degrades to label above value rather than
truncating, and the longest new label, `Average carbohydrate per logged day`,
wraps within itself. The card is taller and the screen scrolls to it. Nothing
clips and no fixed height is introduced.

## Privacy, security, and performance

No network request, telemetry, analytics, AI, permission, background work, or
dependency. No value is logged. Every SQL parameter stays bound, and no
statement changes. No read is added or widened, so no read is slower; the cost
is five additional views inside a scroll view that already renders dozens.

## Data lifecycle

Export, restore, local erasure, and replacement read persisted tables and never
consult `ProgressSummary`. Export format version 1 is unchanged. Data recorded
before this change reads identically after it, because no stored value, captured
date, or offset is involved.

## Verification and completion

- Application tests prove the nutrient average's denominator with a fixture
  whose logged-day count and period length differ, so the two candidate
  denominators produce different numbers; prove that an incomplete nutrient
  yields a null total and a null average together; prove the hydration averages
  and the other-fluid total over a multi-day period; and pin the whole
  `ProgressSummary` shape against a literal, so no existing field changed value.
- Presentation tests prove each new line's exact accessible name for a complete
  period, prove the unknown form for an incomplete period, prove the renamed
  labels and the absence of the old ones, and prove both empty states unchanged.
- Every new test is proven to fail against the preceding commit by stashing only
  its implementation file.
- Sprint 38 Maestro scenarios prove a complete nutrient's average over two logged
  days, the stated other-fluid total, and an incomplete nutrient's unknown
  average, through public controls only.
- One regression scenario proves the new lines survive from a clean state
  alongside the standing suite.
- Repository formatting, lint, type checking, tests, and builds pass without
  warnings.
- Manual QA covers assistive technology metric by metric, Dynamic Type at the
  largest accessible size, both unit systems, every empty and incomplete period,
  a back-dated entry, and unchanged daily screens and export output.

## Explicit exclusions

Charts and any graphical presentation, a Progress redesign beyond the lines this
specification adds, fiber, sugar, and sodium in Progress, widening any reader,
adherence against the calculated calorie target, streaks, achievements, badges,
a custom date range or calendar picker, versioned hydration targets, searching
history by name, starter Workout Plans, coaching or dietary interpretation,
onboarding, localization, export format changes, cloud synchronization,
authentication, notifications, AI, unifying the four time navigators, renaming
the `Snapshot`-suffixed projected fields, and removing the duplicated
completeness field from the nutrition reader contract.
