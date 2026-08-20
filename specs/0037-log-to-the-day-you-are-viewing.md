# Specification 0037: Log to the day you are viewing

- Status: Approved
- Date: 2026-08-20

## Objective and scope

Make an entry recorded from a daily screen belong to the day that screen is
showing, so navigating to a day and logging to it are the same act. The Nutrition
diary and Hydration pass their selected local calendar day to every screen that
records from them, both entry forms prefill that day with a wall time valid on
it, and neither navigator will select a day that has not happened.

No stored entry, amount, instant, offset, total, or target changes. No migration,
index, column, dependency, domain change, repository contract change, SQL change,
or export-format change. The schema stays at user version 11.

## The defect this closes

Both daily screens hold a selected day, read it, name it, and then render an add
control that discards it. `onAdd` took no argument on either screen, every route
between them carried no day, and `emptyFormValues()` built its date and time from
`new Date()` on both entry screens. `LogFromNutritionCatalogUseCase` derived the
instant, the calendar date, and the offset from its injected clock.

The consequence was not an omission a person could work around. It was a screen
contradicting its own words. On a past day both screens render
`Nothing logged for this day` above `Add first entry` and `Add first fluid`, and
both wire that control to `onAdd`. A person who followed the sentence returned to
the same screen still reading it, while a day they were not looking at had gained
an entry they did not put there.

Three further pieces of repository evidence make this a defect rather than an
unfinished design.

[Specification 0008](0008-offline-food-beverage-logging.md) states that the UI
"defaults to the current local date and time, accepts past consumption, and
rejects future occurrences". Past consumption is a specified capability. That
specification then lists date navigation and an add action among five separate
things and never binds the second to the first, which is structurally the
omission [ADR 0026](../docs/decisions/0026-a-period-control-governs-every-list-beneath-it.md)
found in Specification 0015's four-item list.

[Specification 0010](0010-offline-hydration-tracking.md) states that edits "may
move an event to a different day". Recording onto a past day was therefore
already supported, implemented, and tested — reachable only by first recording
onto a day nobody chose and then correcting it.

`HydrationDailyScreen` computed `isToday` and rendered a sentence about it three
lines above calling `onAdd()` with nothing. The value the write needed was in
scope at the call site.

A future day was worse than a refusal. The navigator walked into tomorrow, the
add control was offered unchanged, and the form still prefilled today — so the
save succeeded, onto today, with no refusal at all.

## The day travels as a route parameter

The selected day reaches every recording screen as an expo-router query
parameter named `date`, carrying a `YYYY-MM-DD` local calendar date, pushed
through `router.push({ pathname, params })` and read with
`useLocalSearchParams`. The repository already passes an optional non-path
parameter exactly this way: `apps/mobile/app/nutrition-entry/[id].tsx` pushes
`fromEntryId` and `apps/mobile/app/nutrition-catalog/new.tsx` reads it and
conditionally spreads it into the screen prop. That conditional spread is not
style; `exactOptionalPropertyTypes` requires it.

```text
(tabs)/nutrition.tsx  → /nutrition-add?date
nutrition-add.tsx     → /nutrition-entry/new?date
                      → /nutrition-catalog/{id}/log?date
(tabs)/index.tsx      → /hydration-entry/new?date
```

`NutritionCatalogBrowserScreen` is unchanged. The route file owns the parameter
and closes over it in the callbacks it already supplied, so the browser never
learns a day exists.

A path segment was rejected because it would make the day mandatory on routes
that must stay reachable without one. A store or context was rejected because
none exists, because `AGENTS.md` forbids hidden global state, and because it
would be invisible to a restored route.

## What the form prefills

`resolveRecordedDayPrefill(requested, now)` in
`apps/mobile/src/application/date/local-calendar-date.ts` is the single place the
rule is written. It returns today and the current clock when no day was
requested, when the requested day is today, and when the request is not a local
calendar date or has not happened. It returns the requested day at `12:00`
otherwise.

Noon is not an invention. `startOfLocalDay` in both daily screens already anchors
a selected day at hour 12, because noon is the one wall time no daylight-saving
transition removes. The domain requires the stored calendar date to be the date
the instant and offset produce, so a prefilled time must be a wall time on the
prefilled day; the current clock re-based onto a past date can land inside a
spring-forward gap, where `toSaveInput` round-trips the fields, returns `null`,
and renders `Enter a valid local date and time.` against a value the application
itself supplied. A form that prefills a value it will then refuse is a defect,
not a trade-off.

Recording onto today is byte-identical to before: today's day and today's clock.

The Date field stays editable and stays visible. It is how Specification 0010's
day-moving edit is delivered, it is the only place the form states which day it
will record to, and it is what makes the fallback for a bad parameter honest
rather than silent. The navigator supplies the default; the field overrides it,
the same relationship the Time field already has with the clock.

## The navigator stops at today

`Next` is disabled on both daily screens when the selected day is today or later,
using the expression `ProgressScreen` already uses against its range end. Every
entry builder refuses a future instant, so a recording screen must not offer a
day it will decline. Prevention needs no new sentence, adds no element, and
changes neither screen's height.

`WorkoutHistoryScreen` deliberately keeps `Next` enabled. An empty future period
is a true and useful statement on a reading screen; a future day on a recording
screen is an act the application will refuse. Unifying the four time navigators
is deferred and is not attempted here.

## The saved-item path follows the same day

`LogFromNutritionCatalogUseCase.execute` takes an optional third argument. Absent,
it behaves exactly as before: the instant is the injected clock, the calendar date
is today, the offset is the clock's. Given a day, it re-validates that day rather
than trusting the screen, records at noon on it, and takes that instant's offset.

`recordUsage` keeps the clock rather than the selected day. Usage recency is when
the item was reached for, not the day the entry was attributed to.

`Log to today` was honest and became inconsistent, because from a past day one
control led to two branches that would have recorded to two different days, each
individually truthful. The label now names the day it will record to. It is the
only visible string this specification changes.

## No migration, and the schema that proves it

`nutrition_consumption_entry` from migration 4 and `hydration_entry` from
migration 6 each already store the occurrence epoch, the captured `YYYY-MM-DD`,
and the captured UTC offset, and each already carries an index leading with the
calendar date. `ConsumptionEntry.create` and `HydrationEntry.create` already
verify that the three agree. A back-dated entry is a row those tables can hold,
those indexes serve, and those factories accept, which is why no existing row and
no existing total changes.

## Ownership

Nothing belongs in `packages/domain`. The domain already models an instant, a
captured day, an offset, their agreement, and the refusal of a future instant.
What was missing was an argument presentation never passed. A selected day has no
meaning without a screen.

No repository contract, implementer, or fake changes. No SQL statement changes.
No composition root changes, because a defaulted parameter needs no wiring.

## Error model

| Situation                                             | Outcome                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parameter absent                                      | Prefills today; the Date field shows it                                                                                                                            |
| Parameter is not a local calendar date                | Prefills today; the Date field shows it                                                                                                                            |
| Parameter names a day that has not happened           | Prefills today; the Date field shows it                                                                                                                            |
| The saved-item path receives a day it will not accept | `Consumption calendar date is invalid.` or `Consumption time cannot be in the future.`, carried without a field so it renders in the screen's existing live region |
| A typed future date                                   | `Consumption time cannot be in the future.` / `Hydration time cannot be in the future.`, unchanged                                                                 |
| A typed invalid wall time                             | `Enter a valid local date and time.`, unchanged                                                                                                                    |
| A failed save                                         | Unchanged                                                                                                                                                          |

Every sentence already existed. None contains SQL, a table name, an identifier,
or a path.

The parameter is untrusted input and is validated at two independent boundaries:
in presentation before it can prefill a field, and again inside the saved-item
use case before it can reach a write.

## Midnight and time zones

A form carries its own Date and Time from the moment it renders and does not
re-read the clock for the entry's instant. A form opened before midnight and
saved after it records the day and time its fields hold; the builder compares
that instant against the newer clock and accepts it, because it is now past. A
daily screen left open across midnight keeps the day it was showing, and its
`Next` control re-enables on the next render because the expression is evaluated
against a fresh clock.

Entries store their own offset and calendar date, and daily queries use the
captured date, so a device time-zone change never regroups history. The only
offset this change newly produces is the one in force at noon on the selected
day.

## Derived behavior

A Progress summary over a past period can now change after the fact, because a
person can record onto a day inside it. That follows automatically from readers
that already group by captured local date, with no reader, query, or summary
change, and it is the intended consequence rather than a side effect. For
existing data, with nothing recorded, every value is unchanged.

Hydration's target card and its `isToday` gate are untouched. A past day still
shows recorded totals and no target progress, because targets are still not
versioned.

Goals and Energy, body measurements, workouts, history, personal records,
naming, export, restore, erasure, and replacement are unaffected.

## Experience and accessibility

The only changed visible string is the saved-item save control: `Log to today`
when the target day is today or none was given, and `Log to ` followed by the day
rendered with the same formatter both daily screens use for their heading
otherwise. `AppButton` derives its accessible name from its label, so a screen
reader hears the day too.

Both `Next` controls keep the accessible name `Next day` and gain
`accessibilityState.disabled` at today, which VoiceOver announces as dimmed and
TalkBack as disabled. No new focusable element is added, so focus order is
unchanged. No card gains, loses, or changes an accessible name, and no labelled
card gains a control: the audit remains 56 card usages, 19 labelled, none holding
an interactive child.

The saved-item label is the one element whose text can grow, from twelve
characters to at most twenty-four. It wraps rather than truncates, and it is
already reached by a scroll in the flow that taps it.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, or dependency. All SQL is
unchanged and already bound. The parameter is a local calendar date, is never
logged, and exists only in in-process router state. No query is added, removed,
or changed, and no read is slower; the added work is one regular-expression test
and one string comparison per form mount.

## Verification and completion

Date-module tests cover the prefill rule in every case, the noon anchor, and the
day label. Saved-item use-case tests cover the preserved two-argument default,
the chosen past day at noon, usage recency keeping the clock, and both refusals.
Presentation tests cover, separately for Nutrition and for Hydration, that the
daily screen passes its selected day to the add control before and after moving a
day, that the entry screen prefills the day it was given and today when given
none, a malformed day, or one that has not happened, that a save from a past day
carries that day's calendar date and a matching instant, that an existing entry
keeps its own recorded day, and that `Next` is disabled at today and enabled once
the day is past. `ConsumptionEntryScreen` and `LogNutritionCatalogItemScreen`
gain their first unit tests.

Every new test was proven to fail against the commit before its fix.

Sprint 37 adds four scenarios and one regression scenario. Existing nutrition,
catalog, and hydration flows pass unmodified because each stays on today, where
nothing changed, and because no screen gained or lost an element.

Completion requires repository formatting, lint, strict type checking, tests,
builds, staff-level review, and the Sprint 37 manual checklist. Merge readiness
remains blocked until the repository owner confirms manual QA.

## Alternatives and trade-offs

Relabelling both add controls the way `Log to today` already reads, and leaving
the navigation read-only, was the cheapest option and was rejected on the
screens' own words: `Nothing logged for this day` above `Add first entry` stays
true after a person obeys it, whatever the button is called. It would also leave
`Previous` with no purpose on a screen whose only other affordance records.

Prefilling a past day with the current clock time was rejected on the
spring-forward gap. A read-only Date field was rejected because it splits one
component's behaviour by route and hides the target day. A warning on a future
day was rejected because disabling `Next` reaches the same outcome with no new
string and no height change. Refusing a malformed parameter outright was rejected
because a person did not type it and cannot act on the refusal; falling back to
today is visible in the Date field.

Noon means several back-dated entries recorded in one sitting share a time and
are ordered by identity. Correcting a time is one field.

## Explicit exclusions

Meal or time-of-day grouping, a calendar picker, a custom range, copying a
previous day, recurring entries, barcode or photo logging, external food
databases, versioned hydration targets, charts, a Progress redesign, adherence,
streaks, coaching, medical interpretation, starter workout plans, onboarding,
localization, export-format changes, cloud synchronization, authentication, AI,
notifications, dependency upgrades, repository-wide refactoring, unifying the
four time navigators, and unit tests for the two nutrition catalog screens this
change does not touch are all excluded.

The repository owner approved the Stage 1 design on 2026-08-20 and requested
staged, commit-by-commit implementation.
