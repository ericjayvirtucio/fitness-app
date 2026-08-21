# Specification 0039: Progress counts every nutrient you logged

- Status: Approved
- Date: 2026-08-21

## Objective and scope

Make a period summarize every nutrient a day already summarizes. The Nutrition
Progress card gains a period total and an average per logged day for fiber,
sugar, and sodium, beside the three it already presents, in the order the
nutrition diary already uses.

Version 1 changes one SQL projection, one reader contract, one read model, one
use case, one formatter signature, and one card. No value's arithmetic changes.
No stored value, entry, daily total, migration, index, or export changes.

`@fitness/domain`, `apps/api`, `migrations.ts`, user version 11, every index,
export format version 1, the restore parser, local erasure, replacement restore,
every composition root, every daily total, every hydration target, the nutrition
diary, the nutrition catalog, the hydration daily screen, body measurements,
workouts, history, personal records, correction, and naming are untouched.

Charts, a Progress redesign or re-layout beyond the lines this specification
adds, adherence against the calculated calorie target, streaks, a custom date
range, versioned targets, localization, and export format changes remain
excluded.

## The gap this closes

The consumption entry form asks a person for six optional nutrients. The schema
stores six. The nutrition diary totals six for a day. The progress SQL reads
three.

| Nutrient     | Form captures      | Schema stores        | Daily summary | Progress SQL | Progress model | Progress screen |
| ------------ | ------------------ | -------------------- | ------------- | ------------ | -------------- | --------------- |
| Protein      | `Protein (g)`      | `protein_grams`      | yes           | yes          | yes            | total + average |
| Carbohydrate | `Carbohydrate (g)` | `carbohydrate_grams` | yes           | yes          | yes            | total + average |
| Fat          | `Fat (g)`          | `fat_grams`          | yes           | yes          | yes            | total + average |
| Fiber        | `Fiber (g)`        | `fiber_grams`        | yes           | **no**       | **no**         | **nothing**     |
| Sugar        | `Sugar (g)`        | `sugar_grams`        | yes           | **no**       | **no**         | **nothing**     |
| Sodium       | `Sodium (mg)`      | `sodium_milligrams`  | yes           | **no**       | **no**         | **nothing**     |

Migration 4 declares all three missing columns, each nullable with a
non-negative constraint:

```sql
fiber_grams REAL CHECK (fiber_grams IS NULL OR fiber_grams >= 0),
sugar_grams REAL CHECK (sugar_grams IS NULL OR sugar_grams >= 0),
sodium_milligrams REAL CHECK (
  sodium_milligrams IS NULL OR sodium_milligrams >= 0
),
```

The daily side is one function over a frozen list of all six —
`summarizeConsumptionEntries` in `@fitness/domain`, iterating `nutrientFields`
with strict unknown propagation. The period side is a hand-written projection of
three.

The consequence is specific. Somebody who conscientiously records sodium for
every meal can read today's sodium and can never read this week's, though the
rows sit under the same `local_calendar_date` index the query already uses. The
application asks for information and will not give it back at the granularity
where that information is usually interesting.

## The three-nutrient list was deferred, not decided

[Specification 0038](0038-progress-states-everything-it-counted.md) names the
same three nutrients twice in its exclusions — "fiber, sugar, and sodium in
Progress" — which is a scope boundary drawn by a sprint, not a product decision
about what a person should be able to learn.

[Specification 0016](0016-progress-analytics-and-qa-reporting.md) never argues
for three. Its general rule is written about "an optional nutrient" with no
count: "An optional nutrient is incomplete when any included entry has an
unknown value; known values are never presented as a falsely complete period
total or average." Only its enumeration says three, and that enumeration sits
beside a hydration enumeration Sprint 38 already had to amend once for being an
incomplete statement of what the application does.

Nothing in `specs/`, `docs/decisions/`, or the source argues that a weekly
sodium figure should be unreachable.

## What a period presents after this change

In the branch where the period holds at least one logged nutrition day, the
Nutrition card renders, in order:

| Line                                                                  | Complete    | Unknown      |
| --------------------------------------------------------------------- | ----------- | ------------ |
| `Energy`                                                              | `1000 kcal` | n/a          |
| `Average energy per logged day`                                       | `1000 kcal` | line omitted |
| `Logged days`                                                         | `1`         | n/a          |
| `Entries`                                                             | `1`         | n/a          |
| `Protein`                                                             | `30 g`      | `Incomplete` |
| `Average protein per logged day`                                      | `30 g`      | `Incomplete` |
| `Carbohydrate`                                                        | `40 g`      | `Incomplete` |
| `Average carbohydrate per logged day`                                 | `40 g`      | `Incomplete` |
| `Fat`                                                                 | `12 g`      | `Incomplete` |
| `Average fat per logged day`                                          | `12 g`      | `Incomplete` |
| `Fiber`                                                               | `6 g`       | `Incomplete` |
| `Average fiber per logged day`                                        | `6 g`       | `Incomplete` |
| `Sugar`                                                               | `9 g`       | `Incomplete` |
| `Average sugar per logged day`                                        | `9 g`       | `Incomplete` |
| `Sodium`                                                              | `450 mg`    | `Incomplete` |
| `Average sodium per logged day`                                       | `450 mg`    | `Incomplete` |
| `Incomplete means one or more entries did not include that nutrient.` | conditional | conditional  |

Sixteen metrics plus one conditional sentence. A period holding no logged
nutrition day renders `No nutrition logged in this period.` and nothing else,
unchanged.

Six visible strings are added: the six labels above. **No visible string
changes, and none is removed.** The Hydration, Workouts, and Body weight cards,
Daily activity, the period control, the previous and next controls, the screen
header, and the subtitle are unchanged.

## Every nutrient gets an average

The rule, so that a seventh nutrient inherits it:

> A nutrient the application asks a person to record daily is summarized over a
> period as both a period total and an average per logged day, because the
> recorded quantity is a daily quantity and the period total's length is an
> artifact of the period rather than of the person.

No nutrient is exempt. [ADR 0028](../docs/decisions/0028-a-summary-states-every-value-it-computes.md)
makes this binding rather than a preference: a nutrient with no displayed
average must have no computed average, so an asymmetric card requires a rule
inside `summarizeNutrient` that distinguishes the two groups. Three candidate
rules were tried and all three fail.

"Macronutrients get averages" fails on nutrition: fiber and sodium are the two
nutrients whose published guidance is stated per day most emphatically, so
denying them the per-day figure while granting it to fat inverts the utility
ordering. "Averages where the total is not meaningful" selects all six.
"Averages for what the previous sprint shipped" is a description of history
rather than a rule.

The remaining symmetric alternative — removing all three existing averages for
six totals and ten metrics — was rejected. It withdraws values Specification
0016 promises and Sprint 38 shipped, and under ADR 0028 it would also require
deleting the computation.

[ADR 0029](../docs/decisions/0029-a-captured-value-is-a-value-a-summary-can-state.md)
records the rule and the capture-to-summary claim it rests on.

## Sixteen metrics is the accepted cost

The card roughly doubles. At the largest accessible Dynamic Type size each
`Metric` occupies roughly three wrapped lines, so the card grows from about
thirty to about forty-eight lines of text — four to five viewport heights on a
6.1-inch device.

`Metric` is a wrapping row with `justifyContent: 'space-between'`, so each row
degrades to label above value rather than truncating. No `numberOfLines` is set,
no fixed height is introduced, and nothing clips. The longest label on the card,
`Average carbohydrate per logged day`, is unchanged from Sprint 38; the longest
label this specification adds, `Average sodium per logged day`, is shorter.

Sprint 38's fixed-height property is preserved and extended. A nutrient's total
and its average are null together and both read `Incomplete`, so the card
renders exactly sixteen metrics whenever the period holds a logged day, whatever
the data contains. Height does not vary with completeness.

A sub-heading inside the card was considered and deliberately deferred.
`SectionHeader` renders no control when it carries no action, so it would not
engage [ADR 0024](../docs/decisions/0024-labelled-containers-announce-their-contents.md),
and it would add a heading-rotor landmark for three lines of code. It is a
re-layout, which this specification excludes, and it would add a visible string
to solve a problem that has not been measured. Manual QA counts VoiceOver stops
at the largest accessible size; if the card proves unusable there, that
measurement is what should authorize the layout change.

## The completeness sentence is unchanged

`Incomplete means one or more entries did not include that nutrient.` keeps its
exact text and its conditional rendering. Only the set it is computed over
widens:

```ts
const hasIncompleteNutrient = [
  value.protein,
  value.carbohydrate,
  value.fat,
  value.fiber,
  value.sugar,
  value.sodium,
].some((item) => item.total === null);
```

ADR 0028's reasoning is confirmed rather than assumed: the coverage claim is the
value itself — each line reads `Incomplete` or a quantity, unconditionally, in
every period — and the sentence is a glossary entry for the word, which may
render only when the word does. Neither half of that argument counts nutrients.
One sentence still serves, because it defines one word.

## Sodium is formatted through one path

`formatProgressMass` takes the unit it renders:

```ts
export function formatProgressMass(
  value: number | null,
  unit: 'g' | 'mg',
): string {
  if (value === null) return 'Incomplete';
  return `${formatNumber(value, 1)} ${unit}`;
}
```

Twelve nutrient call sites pass `'g'` or `'mg'`. This is one formatting path,
not two: the same function, the same `Incomplete`, the same rounding, the same
`Intl.NumberFormat`. It is the shape the daily side already ships as
`formatNutrient(value, unit)`, so both sides of the application parameterise the
unit the same way. The name stays accurate, because `Mass` covers both.

A sibling `formatProgressMilligrams` was rejected: two functions differing by
one character of output is the second formatting path Sprint 30 spent a sprint
removing and ADR 0028 rejected again.

Importing `formatNutrient` across the capability boundary was rejected on
behavior rather than architecture — `ProgressScreen` already imports
`formatBodyWeight` and `formatDuration` from other capabilities' presentation
layers, so the boundary is not the objection. `formatNutrient` renders
`String(Math.round(value * 10) / 10)` with no locale grouping, while
`formatProgressMass` uses `Intl.NumberFormat`. A month's sodium is a five-digit
milligram figure, where grouping is the difference between `70,300 mg` and
`70300 mg`, and adopting `formatNutrient` would silently change the existing
three nutrients' rendering above 999 g.

## A nutrient total is named by its value rather than its unit

`NutrientProgressValue.totalGrams` becomes `total`, and
`ProgressNutrientSummary.averageGramsPerLoggedDay` becomes
`averagePerLoggedDay`. The type is generic over nutrients and now carries a
milligram value, so a unit-suffixed field name would be false for sodium. The
unit is supplied where it is known: the screen, which writes the label. This is
the shape the daily side already uses, where `NutrientAmounts` names each field
with its own unit and `formatNutrient` takes the unit at the call site.

No field is removed from `ProgressNutritionSummary`, and no field changes type.

## The duplicated completeness field is removed

`NutrientProgressValue` becomes:

```ts
export type NutrientProgressValue = Readonly<{ total: number | null }>;
```

Specification 0038 removed `isComplete` from `ProgressNutrientSummary` and left
it on the reader contract, recording the reason: "a reader contract was outside
the change that found this." This specification changes the reader contract, so
that reason has expired.

The reader still computes `knownCount === entryCount`, because it needs the
comparison to decide the null. It stops publishing the boolean beside the null
that already implies it. The only consumer outside the reader is
`summarizeNutrient`, which reads `value.total === null` instead — exactly the
change `ProgressScreen` made in Sprint 38.

## The SQL statement

Before:

```sql
SELECT local_calendar_date, COUNT(*) AS entry_count,
  SUM(energy_kilojoules) AS energy_kilojoules,
  SUM(protein_grams) AS protein_grams,
  COUNT(protein_grams) AS protein_known_count,
  SUM(carbohydrate_grams) AS carbohydrate_grams,
  COUNT(carbohydrate_grams) AS carbohydrate_known_count,
  SUM(fat_grams) AS fat_grams,
  COUNT(fat_grams) AS fat_known_count
FROM nutrition_consumption_entry
WHERE local_calendar_date BETWEEN ? AND ?
GROUP BY local_calendar_date
ORDER BY local_calendar_date ASC
```

After:

```sql
SELECT local_calendar_date, COUNT(*) AS entry_count,
  SUM(energy_kilojoules) AS energy_kilojoules,
  SUM(protein_grams) AS protein_grams,
  COUNT(protein_grams) AS protein_known_count,
  SUM(carbohydrate_grams) AS carbohydrate_grams,
  COUNT(carbohydrate_grams) AS carbohydrate_known_count,
  SUM(fat_grams) AS fat_grams,
  COUNT(fat_grams) AS fat_known_count,
  SUM(fiber_grams) AS fiber_grams,
  COUNT(fiber_grams) AS fiber_known_count,
  SUM(sugar_grams) AS sugar_grams,
  COUNT(sugar_grams) AS sugar_known_count,
  SUM(sodium_milligrams) AS sodium_milligrams,
  COUNT(sodium_milligrams) AS sodium_known_count
FROM nutrition_consumption_entry
WHERE local_calendar_date BETWEEN ? AND ?
GROUP BY local_calendar_date
ORDER BY local_calendar_date ASC
```

`FROM`, `WHERE`, `GROUP BY`, `ORDER BY`, and both bound parameters are
byte-identical. Six aggregate expressions are added to the projection.

Each nutrient's `SUM`/`COUNT` pair passes through the existing
`nutrient(total, knownCount, entryCount)` mapper unchanged, so a nutrient is
exact when every entry that day supplied it and unknown otherwise, by the same
rule the existing three already obey.

## No migration, and the index that proves it

All three columns exist with their constraints since migration 4. No table,
column, index, constraint, or trigger is added or altered, so the schema stays
at user version 11 and the migration list keeps its eleven entries.

The statement's only predicate is `local_calendar_date BETWEEN ? AND ?` and its
only grouping key is `local_calendar_date`, which is the leading column of
`nutrition_consumption_entry_local_date_occurred_at (local_calendar_date,
occurred_at_epoch_ms DESC, id)`. That index therefore serves the range seek, the
ordered grouping, and the `ORDER BY` without a sorter.

The index does not carry the nutrient columns, so SQLite already performs one
rowid lookup per matching row to read protein, carbohydrate, fat, and energy,
which materialises the whole row. The three new columns come from bytes already
fetched. The predicate, the grouping key, the ordering, and the row-fetch
strategy are all unchanged, so the query plan cannot change. Six added
accumulators are constant work per row.

Making the index covering would require adding seven columns and a migration.
The maximum window this screen opens is one calendar month of one person's food
entries, so that is a schema change justified only by measurement and is not
proposed.

## Ownership

Nothing belongs in `@fitness/domain`. Every value here is a read-time aggregate
over captured rows, which [ADR 0010](../docs/decisions/0010-derived-workout-history-progress.md)
and [ADR 0011](../docs/decisions/0011-cross-capability-derived-progress-analytics.md)
place in the application layer. No invariant, unit conversion, or rule of the
product is involved.

Reading the six nutrients through `summarizeConsumptionEntries` was rejected: it
takes `readonly ConsumptionEntry[]`, so a month period would hydrate every entry
into domain objects in memory to produce six numbers SQLite computes during the
scan it already performs.

A separate period-nutrient reader was rejected: a second reader over the same
table, the same range, and the same grouping key would run a second statement
per load for rows the first already returns, and would add a sixth member to a
`Promise.all` for data a existing member already carries.

`NutritionProgressReader` has exactly one implementer,
`NutritionProgressSqliteReader`, constructed in
`apps/mobile/src/composition/progress-analytics.ts`. That composition root is
unchanged, because the constructor signature, the interface, and the use case's
parameter list are unchanged.

The only consumer of `ProgressSummary` is `ProgressScreen`. Every pre-existing
field keeps its value.

## Error model

This specification adds no write and no query, so it adds no failure mode and no
new sentence.

- A period in which every nutrient is incomplete renders all sixteen metrics,
  with six totals and six averages reading `Incomplete`, above the completeness
  sentence.
- A period in which exactly one of the three new nutrients is incomplete renders
  all sixteen metrics, with that nutrient's total and average reading
  `Incomplete` and the other ten values exact, above the sentence.
- A period with no logged days renders `No nutrition logged in this period.`
- A reader that fails mid-load replaces the screen with `Progress unavailable`,
  `Progress could not be loaded from this device.`, and a `Try Again` control.
- A corrupt row fails through the existing `nonnegative` and
  `nonnegativeInteger` guards with `Corrupt nutrition progress row.`, thrown
  inside the reader's `try`, converted by `toPersistenceError`, and surfaced as
  the three strings above. A negative or non-finite sodium value fails exactly
  as a negative protein does, through the same guard.

No error text contains SQL, a table name, a column name, an identifier, an
internal path, or a stack trace.

## Experience and accessibility

The Progress summary cards carry no `accessibilityLabel`, so each `Metric` is
its own accessible element announcing `label, value` and the six new lines add
accessibility stops rather than burying existing ones. The card gains no
control, so it must not and does not gain a label, and ADR 0024's guarantee that
no labelled card contains an interactive child is preserved unchanged across all
nineteen labelled cards.

The Nutrition card carries sixteen metric stops, up from ten, plus its heading
and a possible sentence — seventeen elements for a complete period, eighteen for
an incomplete one, and two for an empty one. The Progress screen carries roughly
thirty-six metric stops where it carried thirty. The heading rotor still reaches
`Nutrition`, `Hydration`, `Workouts`, `Body weight`, and `Daily activity`, so a
longer card costs one rotor gesture to skip rather than sixteen swipes.

Accessible names added:

- `Fiber, 6 g`
- `Average fiber per logged day, 6 g`
- `Sugar, 9 g`
- `Average sugar per logged day, 9 g`
- `Sodium, 450 mg`
- `Average sodium per logged day, 450 mg`

No accessible name changes. An incomplete nutrient announces
`Average sodium per logged day, Incomplete`. Completeness is never signalled by
colour, and it reaches a screen reader inside the metric's own name.

## Privacy, security, and performance

No network request, telemetry, analytics, AI, permission, background work,
notification, or dependency. No value is logged. Both SQL parameters stay bound
and unchanged, and the six added expressions are literal column names in the
projection with no interpolation. Fitness and dietary data never leaves the
device.

No query is added and no read is repeated. The presentation cost is six
additional views inside a scroll view that already renders dozens.

## Data lifecycle

Export, restore, local erasure, and replacement read persisted tables and never
consult `ProgressSummary`, `NutritionProgressReader`, or `progress-models.ts`.
Export format version 1 is unchanged, and `fiber_grams`, `sugar_grams`, and
`sodium_milligrams` were already exported and restored, because export reads the
row.

Data recorded before this change reads identically after it. No stored value,
captured date, or UTC offset is involved.

## Derived behavior

The nutrition diary, the nutrition catalog, the hydration daily screen and its
target, body measurements, Goals & energy, workouts, history, personal records,
correction, and naming are unchanged in behavior. The Hydration, Workouts, and
Body weight Progress cards are unchanged in content and sit six lines further
down the scroll view, which is a scroll-distance change rather than a behavior
change; every existing step that reaches them already scrolls. `DailyActivity`
and `DailyRow` render energy, fluid, and completed workouts and read no
nutrient, so `ProgressDay.nutrition` gaining three fields changes nothing they
display or announce.

## Verification and completion

- SQLite reader tests prove all six nutrients are grouped and summed per local
  calendar date; that a day where one entry omits one nutrient reports that
  nutrient incomplete and every other nutrient exact; that sodium's milligram
  magnitude is never confused with a gram magnitude; that the existing three
  nutrients' values are unchanged; and that a corrupt row still fails with the
  existing safe message.
- Application tests prove the period total for each new nutrient across a
  multi-day range, that an incomplete new nutrient yields the same null shape
  the existing three use, and that no existing field of `ProgressSummary`
  changed value.
- Presentation tests prove each new line's exact accessible name for a complete
  period, its unknown form for an incomplete period, that sodium renders in
  milligrams and never in grams, and that both empty states are unchanged.
- Formatting tests prove the milligram form, the unknown form, the unchanged
  gram form, and the grouped five-digit form that motivated the single-path
  decision.
- Every new test is proven to fail against the preceding commit by stashing only
  its implementation file. Tests that pin behavior which already exists and is
  already correct are labelled as pins rather than presented as new evidence.
- Sprint 39 Maestro scenarios prove a period counting every nutrient it was
  given, sodium counted in milligrams, and an omitted nutrient reported
  incomplete, through public controls only.
- One regression scenario proves the six lines survive from a clean state
  alongside the standing suite.
- Repository formatting, lint, type checking, tests, and builds pass without
  warnings.
- Manual QA covers a period supplying all six nutrients, a period omitting
  exactly one of the new three, a period supplying sodium alone, empty periods,
  Day, Week, and Month, a back-dated entry, the diary compared value by value
  against the period card, unchanged export output, assistive technology metric
  by metric with an explicit stop count, Dynamic Type at the largest accessible
  size, both unit systems, and data recorded before the change.

## Explicit exclusions

Charts and any graphical presentation, a Progress redesign or re-layout beyond
the six lines this specification adds, a sub-heading or disclosure control
inside a Progress card, adherence against the calculated calorie target,
streaks, achievements, badges, a custom date range or calendar picker, versioned
hydration or calorie targets, searching history by name, starter Workout Plans,
coaching or dietary interpretation, onboarding, localization, export format
changes, cloud synchronization, authentication, notifications, AI, broad
dependency upgrades, repository-wide refactoring, unifying the four time
navigators, and renaming the `Snapshot`-suffixed projected fields.
