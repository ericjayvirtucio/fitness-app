# Sprint 38 manual QA: Progress states everything it counted

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat proving that
a complete nutrient states its average, that other fluids are stated rather than
subtracted, or that an incomplete nutrient states an unknown average — the
Sprint 38 Maestro suite and regression scenario 31 already automate all three.

Never enter a real person's measurements, nutrition, or training history.

This sprint changes no stored value, query, SQL statement, reader contract,
daily total, or export. Every check below compares what the application computed
against what the Progress tab now says.

## What only manual QA can cover

An end-to-end run cannot span two logged days without falling outside the
selected week on a Sunday, exercise a screen reader, render at the largest
accessible text size, or read data written by a previous build. The claims below
are therefore **manual only**, and are the reason this checklist exists rather
than a longer Maestro suite:

- an average over more than one logged day, where the average differs from the
  total;
- a period where exactly one entry omits exactly one nutrient;
- Day, Week, and Month periods and the moves between them;
- VoiceOver and TalkBack, metric by metric;
- keyboard navigation and focus order;
- Dynamic Type at the largest accessible size on a taller Nutrition card;
- both unit systems;
- data recorded before this build, read after it.

Produce each through the product's own controls. Do not add a fixture, a seeder,
or a hidden route.

## Preparing the fixtures

| Fixture                  | How to produce it                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| A complete nutrient day  | Add a one-time entry and fill Protein, Carbohydrate, and Fat as well as Energy.                 |
| Two complete logged days | Record one complete entry today and another on the Nutrition tab after pressing Previous once.  |
| One omitted nutrient     | Add a second entry on one of those days leaving Protein blank and the other two filled.         |
| Plain water only         | On the Today tab, add fluid, keep Water, choose a preset, and save.                             |
| Other fluids only        | The same, choosing Other fluid before the preset.                                               |
| Both fluid kinds         | Record one of each on the same day.                                                             |
| A back-dated entry       | Press Previous on the Nutrition tab or the Today tab before adding, as Sprint 37 made possible. |
| Nothing recorded         | A freshly erased installation, or a period navigated back past every recorded day.              |
| Two unit systems         | Switch the profile's preferred unit system between passes.                                      |
| Recorded before          | Data recorded on the previous build, read after installing this one.                            |

## The Nutrition card states every value it counted

With at least one logged day, confirm the card renders exactly these ten lines,
in this order, and the sentence below them only when something is incomplete:

| Line                                  | Expected                                            |
| ------------------------------------- | --------------------------------------------------- |
| `Energy`                              | the period total                                    |
| `Average energy per logged day`       | the total divided by `Logged days`                  |
| `Logged days`                         | days holding at least one nutrition entry           |
| `Entries`                             | entries across those days                           |
| `Protein`                             | the period total, or `Incomplete`                   |
| `Average protein per logged day`      | the total divided by `Logged days`, or `Incomplete` |
| `Carbohydrate`                        | the period total, or `Incomplete`                   |
| `Average carbohydrate per logged day` | the total divided by `Logged days`, or `Incomplete` |
| `Fat`                                 | the period total, or `Incomplete`                   |
| `Average fat per logged day`          | the total divided by `Logged days`, or `Incomplete` |

- [ ] Every line is present and in this order.
- [ ] `Average per logged day` appears nowhere; each average names its value.
- [ ] No average shows `0` for a period the application could not compute.

## The average uses logged days, not days in the period

- [ ] Over two logged days inside a seven-day week, divide each nutrient total
      by two and confirm the card agrees. It must not divide by seven.
- [ ] Confirm `Logged days` reads `2` for the same period, so the card names its
      own denominator.
- [ ] Repeat for a month period holding the same two days.

## One omitted nutrient

- [ ] With one entry missing Protein and every other value supplied, `Protein`
      and `Average protein per logged day` both read `Incomplete`.
- [ ] `Carbohydrate` and `Fat` and both of their averages still read quantities.
- [ ] `Incomplete means one or more entries did not include that nutrient.`
      renders beneath them.
- [ ] Fill the missing nutrient by editing the entry, return to Progress, and
      confirm all six nutrient lines read quantities and the sentence is gone.

## The Hydration card states every value it counted

| Line                                 | Expected                                                |
| ------------------------------------ | ------------------------------------------------------- |
| `Total fluid`                        | the period total                                        |
| `Plain water`                        | the water component                                     |
| `Other fluids`                       | everything else, so the two components sum to the total |
| `Average fluid per logged day`       | the total divided by `Logged days`                      |
| `Average plain water per logged day` | plain water divided by `Logged days`                    |
| `Logged days`                        | days holding at least one hydration entry               |
| `Entries`                            | entries across those days                               |

- [ ] Plain water only: `Other fluids` reads `0 mL` and the two components still
      sum to the total.
- [ ] Other fluids only: `Plain water` reads `0 mL`, and so does the average
      plain water per logged day.
- [ ] Both kinds: `Plain water` plus `Other fluids` equals `Total fluid`
      exactly, and matches the same three numbers on the daily hydration screen.

## Empty periods

- [ ] A period with no nutrition shows `No nutrition logged in this period.` and
      no metric, no average, and no completeness sentence.
- [ ] A period with no hydration shows `No hydration logged in this period.` and
      no metric and no average.
- [ ] A period with nothing recorded at all shows both sentences, plus the
      unchanged workout, body weight, and daily activity empty states.

## Periods and navigation

- [ ] Day, This Week, and This Month each recompute both cards.
- [ ] Previous and Next move the period and the values follow.
- [ ] Next is disabled on the current period.
- [ ] A period containing an entry back-dated through Sprint 37's change counts
      that entry on the day it was recorded to.

## Nothing else changed

- [ ] The nutrition diary shows the same six nutrients and the same daily
      totals card as before this build.
- [ ] The hydration daily screen shows the same total, plain water, other
      fluids, and entry count as before this build.
- [ ] The Workouts, Body weight, and Daily activity cards are unchanged.
- [ ] An export produced after this build has the same shape and the same values
      as one produced before it.
- [ ] Restore, erasure, and replacement behave exactly as before.

## Accessibility, type, and units

- [ ] VoiceOver announces each Progress metric once, as `label, value`, and the
      five new lines are among them.
- [ ] TalkBack does the same.
- [ ] An incomplete nutrient announces `Average protein per logged day,
Incomplete`.
- [ ] No Progress summary card announces as one element; each metric is its own
      stop, and no card hides a control.
- [ ] Keyboard navigation reaches the period control, Previous, and Next in a
      sensible order, and no new line traps focus.
- [ ] At the largest accessible text size, every new label wraps rather than
      truncating, the value drops below its label where needed, and the taller
      Nutrition card scrolls fully into view.
- [ ] Metric and imperial passes show the same nutrition and hydration values;
      only body weight changes unit.

## Environment and privacy

- [ ] With the device offline, Progress loads and every new line renders.
- [ ] No console, log, or crash report contains a nutrient value, a fluid
      volume, a description, or a date.
- [ ] Force a read failure and confirm `Progress unavailable`, `Progress could
not be loaded from this device.`, and a working `Try Again`, with no SQL,
      table name, identifier, or path in the message.

## Regression sweep

- [ ] Data recorded before this build reads identically after it.
- [ ] `./scripts/qa.sh sprint 38 --platform ios`
- [ ] `./scripts/qa.sh regression --platform ios`
