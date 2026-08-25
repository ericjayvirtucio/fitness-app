# Sprint 36 manual QA: history obeys its period

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat a single day
holding today's workout, an empty adjacent day, moving back and forth between
them, a future period, or an empty history, which the Sprint 36 Maestro suite and
regression scenario 29 already automate.

Never enter a real person's measurements, nutrition, or training history.

This sprint changes no stored value. Every check below compares what the list
shows against what the summary above it says, and against what the period control
was set to.

## What only manual QA can cover

Start and completion instants come from the device clock and are not editable
through the product, and this sprint does not make them so. No end-to-end flow can
therefore create a workout in a previous week or month, or one performed across
midnight. Adding a database fixture, a seeder, a hidden route, or a test-only
bypass to make it possible is out of scope and was deliberately not done.

The three claims below are consequently **manual only**, and are the reason this
checklist exists rather than a longer Maestro suite:

- workouts in two different months, with the period moved between them;
- a period holding more workouts than one page, paged to the end;
- a workout started before midnight and completed after it.

Produce each by changing the device clock between recordings, not by editing data.

## Preparing the fixtures

| Fixture              | How to produce it                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Today's workout      | Record at least one set in an empty workout and finish it.                                                      |
| Last month's workout | Set the device clock back one month, record and finish a workout, then return the clock to today.               |
| A full page and more | With the clock set to one day, record and finish 21 workouts, so one month holds more than the page size of 20. |
| Midnight workout     | Set the clock to 23:50, start a workout, record a set, wait past midnight, and finish it.                       |
| Empty period         | Any day, week, or month in which nothing was recorded.                                                          |
| Empty history        | A freshly installed or fully erased installation, before any workout is completed.                              |
| Renamed workout      | Rename any completed workout from its detail screen.                                                            |
| Recorded before      | Data recorded on the previous build, read after installing this one.                                            |

## The period governs the list

| Check                                                      | Expected                                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The period control's label                                 | Reads `History period`, not `Summary period`.                                           |
| The heading above the workouts                             | Reads `Workouts in this period`, not `Recent workouts`.                                 |
| `Month`, on the current month                              | Only this month's workouts are listed.                                                  |
| `Previous`, to the month holding the older workout         | The list changes to that month's workouts. This month's are gone.                       |
| `Next`, back to this month                                 | The older workout is gone and this month's are back.                                    |
| `Week` and `Day`, each on a period that recorded something | Only that period's workouts are listed.                                                 |
| Every list, against the summary above it                   | The completed workout count equals the number of cards, unless a next page is offered.  |
| Every list, value by value                                 | Actual sets and performed exercises across the listed cards match the summary's totals. |
| `Exercise progress`, in every period                       | Unchanged. It is deliberately all-time and does not follow the period.                  |

## An empty period

| Check                                                  | Expected                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| A day, week, or month that recorded nothing            | `No workouts in this period` and `Choose another period, or finish a workout to add one here.`            |
| The same period, with history existing elsewhere       | The never-completed sentence does **not** appear.                                                         |
| `Next` past today, into a period that has not happened | The same period-empty sentences.                                                                          |
| The summary above an empty period                      | Zeroes, and no card beneath it.                                                                           |
| An installation holding no completed workout at all    | `No completed workouts yet` and `Finish a workout with at least one performed set to build your history.` |
| That installation, in any period                       | Still the never-completed sentences. The period-empty ones never appear.                                  |

## The period boundary

| Check                                               | Expected                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| The midnight workout, in the day it started         | Listed, and counted by that day's summary.                                 |
| The midnight workout, in the day it finished        | Not listed, and not counted.                                               |
| The same workout across a week or month boundary    | Belongs to the period holding its start, in both the list and the summary. |
| The workout's own card, in the period that holds it | Its date reads the day it started.                                         |
| The first and last day of a month, each on `Day`    | A workout recorded on either is listed by that day.                        |
| Every workout you recorded, across every period     | Appears in exactly one period. None disappears from all of them.           |

## Paging within a period

| Check                                   | Expected                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| A month holding more than 20 workouts   | `Load More Workouts` is offered.                                                       |
| Press it                                | The next workouts of the same month are appended. None repeats.                        |
| Page to the end                         | Every workout of that month is listed, and the control disappears.                     |
| The full list, against the summary      | The card count equals the summary's completed workout count.                           |
| Move the period, then press `Load More` | Whatever appends belongs to the period that was on screen, and the reload replaces it. |
| A period holding 20 or fewer            | The control is not offered.                                                            |

## Moving quickly

| Check                                          | Expected                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Tap `Previous` several times quickly           | The list and the summary that settle both describe the final period. |
| Tap `Previous` and `Next` alternately, quickly | No period's summary is ever shown above another period's workouts.   |
| Switch `Day`, `Week`, `Month` rapidly          | The period re-anchors on today each time and both reads agree.       |

## Naming, correction, and records

| Check                                                | Expected                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| Rename a completed workout, then return to history   | The card shows the new name and stays in the same period.                      |
| Correct, remove, or add a set in a completed workout | The workout stays in its period. Its date and times do not move.               |
| Open a personal record                               | Its evidence is unchanged, and may cite a workout outside the selected period. |
| Delete a completed workout                           | It leaves its period. Every other period is unchanged.                         |
| Data recorded before this build                      | Reads correctly and lands in the period matching its recorded date.            |

## Accessibility, type, and units

| Check                                       | Expected                                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver on the changed screen             | The period control announces `History period`; the section announces `Workouts in this period`.                              |
| VoiceOver on an empty period                | Both sentences are announced separately; neither is trapped inside a card.                                                   |
| TalkBack, the same two checks               | The same.                                                                                                                    |
| Every card's announced name                 | Unchanged from the previous build: `Open <name>, <date>, <n> actual sets, <duration>`.                                       |
| The performed summary's announced name      | Unchanged; still carries every sentence it displays.                                                                         |
| Keyboard navigation and focus order         | Heading, period control, period label, `Previous`, `Next`, summary, section, cards, `Load More Workouts`, exercise progress. |
| Dynamic Type at the largest accessible size | `Workouts in this period` wraps rather than truncating; both empty sentences are fully readable.                             |
| Dynamic Type on an empty period             | The screen is shorter than with a list, and nothing overlaps.                                                                |
| Touch targets on a physical device          | `Previous`, `Next`, each period option, and `Load More Workouts` meet the minimum.                                           |
| Metric and imperial                         | Only formatting differs. The same workouts are listed in the same periods.                                                   |

## Environment and privacy

| Check                                            | Expected                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Airplane mode, throughout                        | Every check above behaves identically. Nothing requires a network.             |
| Change the device time zone, then reopen history | Every workout stays in the period holding its captured start date.             |
| Change the time zone across a period boundary    | No workout moves between periods. Captured dates do not shift.                 |
| Device logs during every check                   | No workout name, date, count, measurement, identifier, SQL, or path is logged. |
| Any refusal encountered                          | A fixed sentence with no SQL, identifier, or path.                             |
| Export taken before and after                    | Byte-identical content for unchanged data. The format is version 1 either way. |

## Regression sweep

| Check                                   | Expected                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| Progress                                | Unchanged. Its own period still governs its own summary.                               |
| Workout planner and pickers             | Unchanged.                                                                             |
| Completed workout detail                | Unchanged, including its correction, removal, addition, deletion, and rename controls. |
| Exercise performance history            | Unchanged, including its paging. It has no period control.                             |
| Nutrition, hydration, body measurements | Unchanged.                                                                             |
| Export, restore, erasure, replacement   | Unchanged.                                                                             |
