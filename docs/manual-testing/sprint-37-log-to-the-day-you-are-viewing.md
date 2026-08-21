# Sprint 37 manual QA: log to the day you are viewing

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat recording one
food entry onto yesterday, one fluid entry onto yesterday, logging a saved item
onto yesterday, or proving today did not gain either — the Sprint 37 Maestro
suite and regression scenario 30 already automate all four.

Never enter a real person's measurements, nutrition, or training history.

This sprint changes no stored entry, amount, instant, offset, total, or target.
Every check below compares the day a screen was showing against the day the entry
landed on.

## What only manual QA can cover

An end-to-end run cannot change the device clock, cross midnight while a form is
open, or move a device between time zones. It also cannot exercise a screen
reader, Dynamic Type, or a physical touch target. The claims below are therefore
**manual only**, and are the reason this checklist exists rather than a longer
Maestro suite:

- a day several weeks back, rather than the one day a run can reach;
- a form opened before midnight and saved after it;
- a time-zone change between recording and reading;
- Progress over a period containing a back-dated entry, checked value by value;
- VoiceOver, TalkBack, keyboard focus, Dynamic Type, and touch targets;
- data recorded before this build, read after it.

Produce each by changing the device clock or time zone between steps, not by
editing data. Do not add a fixture, a seeder, or a hidden route.

## Preparing the fixtures

| Fixture              | How to produce it                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Yesterday's food     | On the Nutrition tab, press Previous once, then Add food or beverage, then Enter one-time item and save. |
| Yesterday's beverage | The same, choosing Beverage as the entry type.                                                           |
| Yesterday's fluid    | On the Today tab, press Previous once, then Add fluid, a preset, and Save fluid.                         |
| A day weeks back     | Press Previous roughly twenty times on either screen, then record there.                                 |
| A saved item         | Create a reusable item, then log it from a past day.                                                     |
| Recorded before      | Data recorded on the previous build, read after installing this one.                                     |
| Two unit systems     | Switch the profile's preferred unit system between passes.                                               |

## Recording onto yesterday

1. On Nutrition, press **Previous**. The heading names yesterday.
2. Press **Add food or beverage**, then **Enter one-time item**.
3. The **Date** field reads yesterday's date and the **Time** field reads `12:00`.
   Do not change either.
4. Fill the entry and press **Save entry**, then return to the diary.
5. The entry is listed on yesterday, and the daily totals card counts it.
6. Press **Today**. The entry is not there and the totals return to zero.
7. Repeat steps 1 to 6 choosing **Beverage**, and again on the Today tab with
   **Add fluid** and **Save fluid**.

## A day several weeks back

1. Press **Previous** about twenty times on Nutrition and note the heading.
2. Record an entry without touching the Date or Time fields.
3. The entry is listed on that day, with the time `12:00`.
4. Press **Today**, then **Previous** the same number of times. The entry is
   still there.
5. Repeat on the Today tab.

## Recording onto today is unchanged

1. On each screen, record an entry without moving a day.
2. The **Date** field reads today and the **Time** field reads the current clock,
   to the minute, exactly as it did before this build.
3. The entry lands on today at that time.

## A day that has not happened

1. On Nutrition, note that **Next** is unavailable on today. With VoiceOver or
   TalkBack it announces as dimmed or disabled.
2. Press **Previous** once. **Next** becomes available again and returns to today.
3. Repeat on the Today tab.
4. On either entry form, type tomorrow's date into **Date** and save. The screen
   refuses with `Consumption time cannot be in the future.` or
   `Hydration time cannot be in the future.` and records nothing.

## Editing and deleting an entry recorded onto a past day

1. Open an entry recorded onto yesterday from that day's list.
2. The **Date** and **Time** fields hold that entry's own recorded values.
3. Change the amount and save. The entry stays on yesterday.
4. Change the **Date** to today and save. The entry moves to today and leaves
   yesterday, and both days' totals follow it.
5. Delete an entry recorded onto a past day. It is removed from that day and the
   totals fall accordingly.

## Totals and lists agree

For every day touched above, the daily totals card and the entry list beneath it
describe the same entries. On Hydration, the totals card names the same volumes
its lines show.

## The hydration target card

1. On today with a target set, the target card shows percentage and remaining.
2. On any past day, the card is replaced by
   `Historical days show recorded totals. Target progress is shown only for today because targets are not versioned.`
3. Recording onto a past day does not change today's percentage.

## Progress over a period containing a back-dated entry

1. Note every value on Progress for a period containing yesterday.
2. Record one entry onto yesterday.
3. Return to Progress and compare value by value. Only the values that count that
   entry changed, and they changed by exactly what was recorded.

## Midnight

1. Shortly before midnight, open the entry form from a past day.
2. Wait until after midnight without leaving the form.
3. Save. The entry lands on the day the **Date** field holds, at the time the
   **Time** field holds.
4. Return to the daily screen. It still shows the day it was showing, and the
   entry is listed there. **Next** is now available, because that day is past.

## A time-zone change

1. Record an entry onto a past day.
2. Change the device time zone by several hours and reopen the application.
3. The entry is still listed on the same day, at the same time, and the day's
   totals are unchanged.

## Accessibility, type, and units

1. With VoiceOver and again with TalkBack, on the Nutrition diary, the Hydration
   screen, both entry forms, and the saved-item log screen: every control is
   reachable, focus order is logical, and nothing is announced that is not shown.
2. The saved-item control announces `Log to today` on today and names the day
   otherwise.
3. At the largest accessible text size, that control's label wraps rather than
   truncates and both it and **Cancel** stay reachable by scrolling.
4. With a keyboard, every field and control is reachable in order.
5. Repeat one recording pass in each unit system.
6. On a physical device, every control on the changed screens meets the minimum
   touch target.

## Environment and privacy

1. With the device offline for the whole pass, everything above still works.
2. No console, log, or diagnostic output contains an entry description, a
   quantity, a date, a database identifier, SQL, or a file path.
3. Data recorded on the previous build reads correctly after installing this one,
   on the days it was recorded to.

## Regression sweep

Run `./scripts/qa.sh regression --platform ios` and confirm all thirty scenarios
pass, then spot-check by hand that logging onto today from the Nutrition diary,
the saved-item browser, and the Hydration screen behaves exactly as it did before
this build.
