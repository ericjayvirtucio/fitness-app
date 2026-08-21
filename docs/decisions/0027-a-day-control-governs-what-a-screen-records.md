# ADR 0027: Let a day control govern what a screen records, and refuse a day it cannot record to

**Status:** Accepted

**Distinct from:** [ADR 0026](0026-a-period-control-governs-every-list-beneath-it.md),
which decided that a control scoping one read on a screen scopes every read on
that screen presenting the same subject. This record decides what such a control
does to a _write_, which 0026 deliberately did not.

## Context

The Nutrition diary and Hydration each hold a selected local calendar day, read
it, name it in a heading, and offer `Previous`, `Today`, and `Next`. Each then
renders an add control whose callback took no argument. Every route between the
daily screen and the screen that records carried no day, and `emptyFormValues()`
on both entry screens built its date and time from `new Date()`.
`LogFromNutritionCatalogUseCase` derived the instant, the calendar date, and the
offset from its injected clock.

Sprint 36 found a screen that was incoherent while stating nothing untrue. This
one states something untrue. Both daily screens render
`Nothing logged for this day` above `Add first entry` and `Add first fluid`, and
wire that control to the callback that discarded the day. A person who followed
the sentence on a past day returned to the same screen still reading it, while
today had gained an entry they did not put there.

Three further pieces of evidence were already in the repository.
[Specification 0008](../../specs/0008-offline-food-beverage-logging.md) states
the UI "accepts past consumption", and lists date navigation and an add action
among five separate things without binding them.
[Specification 0010](../../specs/0010-offline-hydration-tracking.md) states that
an edit "may move an event to a different day", so back-dating was already
specified and reachable — but only by first recording onto a day nobody chose.
And `HydrationDailyScreen` computed `isToday`, rendered a sentence about it, and
three lines later called `onAdd()` with nothing.

The future was worse than a refusal. `Next` walked into tomorrow, the add control
was offered unchanged, the form still prefilled today, and the save succeeded
onto today. The screen did not decline the act; it quietly performed a different
one.

## Decision

**A control that selects which day a screen shows also selects the day the screen
records to, and must not offer a day the application will refuse to record to.**

Three consequences are part of the decision.

**The day travels as a route parameter, and it is untrusted.** It reaches every
recording screen as an expo-router query parameter carrying a `YYYY-MM-DD` local
calendar date, the way `fromEntryId` already travels from
`app/nutrition-entry/[id].tsx` to `app/nutrition-catalog/new.tsx`. It is
validated in presentation before it can prefill a field and again inside the
saved-item use case before it can reach a write. A parameter that is absent,
malformed, or names a day that has not happened resolves to today — visibly, in
the Date field the form still renders, because a person who did not type the
parameter cannot act on a refusal about it.

**A prefilled time must be a wall time on the prefilled day, and that time is
noon.** The domain requires the stored calendar date to be the date the instant
and offset produce, so "now" is unavailable on any day but today. Noon is already
this application's representative instant for a local day: `startOfLocalDay` in
both daily screens anchors at hour 12, because noon is the one wall time no
daylight-saving transition removes. The current clock re-based onto a past date
can land inside a spring-forward gap, where the form's own round-trip check
rejects a value the application supplied. Today keeps the current clock, so
recording onto today is unchanged.

**A recording navigator stops at today; a reading navigator does not.** `Next` is
disabled on both daily screens when the selected day is today or later, using the
expression `ProgressScreen` already applies to its range end. Workout History
deliberately keeps `Next` enabled, because ADR 0026 made an empty future period a
true and useful statement about a period a person is reading. A future day on a
screen that records is not a statement; it is an act every entry builder refuses.
That difference is the reason the four time navigators are not unified here.

Persist nothing. No migration, column, index, constraint, table, trigger,
dependency, domain change, repository contract change, SQL change, or
export-format change. Both entry tables already store an occurrence epoch, a
captured calendar date, and a captured offset, and both domain factories already
verify their agreement, so a back-dated entry is a row the existing schema holds
and the existing readers group correctly.

## Consequences

- A person who forgets to log a meal or a drink can move to the day it belongs to
  and record it there, in the number of taps the navigator already implied.
- A day that has not happened is unreachable on a screen that records, so the
  refusal sentences in the three entry builders become the last line of defence
  rather than the first thing a person meets.
- One visible string changes. The saved-item control read `Log to today`, which
  was honest alone and inconsistent on a branch: from a past day, one add control
  led to two paths that would record to two different days, each truthful. It now
  names the day it will record to.
- A Progress summary over a past period can change after the fact. This follows
  from readers that already group by captured local date, and it is the intended
  consequence rather than a side effect.
- Hydration's target card and its `isToday` gate are untouched. A past day still
  shows recorded totals and no target progress, because targets remain
  unversioned — which this decision does not pretend to fix.
- `recordUsage` on the saved-item path keeps the clock rather than the selected
  day, because usage recency is when the item was reached for, not the day the
  entry was attributed to.
- Meal grouping, a calendar picker, copying a previous day, and versioned targets
  all consume "the day this screen records to" and can take it from the same
  parameter.

## Alternatives considered

**Say plainly that recording always means today, relabel both add controls the
way `Log to today` already reads, and leave the navigation read-only.** The
cheapest option, and the one the codebase could be read as already endorsing.
Rejected on the screens' own words: `Nothing logged for this day` sitting above
`Add first entry` stays true after a person obeys it, whatever the button is
called. It also contradicts Specification 0008's "accepts past consumption",
leaves Specification 0010's day-moving edit reachable only by recording to the
wrong day first, and leaves `Previous` with no purpose on a screen whose only
other affordance records.

**Prefill a past day with the current clock time.** Rejected: it prefills a value
the form's own validation refuses inside a spring-forward gap.

**Carry the day in a store or a context.** Rejected: no such mechanism exists,
`AGENTS.md` forbids hidden global state, and it would be invisible to a restored
route.

**Make the day a path segment.** Rejected: it makes the day mandatory on routes
that must stay reachable without one.

**Make the Date field read-only once the day is prefilled.** Rejected: it splits
one component's behaviour by route, breaks the day-moving edit, and removes the
only place the form states which day it will record to.

**Warn on a future day instead of disabling `Next`.** Rejected: disabling reaches
the same outcome with no new string, no new element, and no change to either
screen's height — which is also what keeps every existing end-to-end flow valid.

**Unify the four time navigators now.** Rejected for this change, not in
principle. It would put a refactor of Workout History and Progress inside a fix
to Nutrition and Hydration, and the reading-versus-recording distinction this
record establishes is the evidence that work should start from.
