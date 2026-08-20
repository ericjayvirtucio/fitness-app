# Specification 0036: History obeys its period

- Status: Approved
- Date: 2026-08-19

## Objective and scope

Make Workout History show the workouts belonging to the period a person selected,
so the list and the summary above it describe the same span of time.

Version 1 adds one optional field to one query type, one predicate to one
statement, one empty state, and one concurrency guard, and renames two visible
labels. Nothing else changes.

`@fitness/domain`, `apps/api`, every migration, user version 11, export format
version 1, the restore parser, local erasure, replacement restore, every other
reader contract, every other query, personal record calculation, correction,
removal, addition, deletion, naming, the Exercise Catalog and its filtering, all
three pickers, the Workout Planner, Progress, nutrition, hydration, and body
measurements are untouched. No stored result, set, exercise, position, time,
total, record, tie, or evidence link changes.

Searching or filtering history by name or exercise, custom date ranges, editing a
completed workout's times or date, charts, Progress redesign, achievements,
streaks, adherence, coaching, starter Workout Plans, onboarding, localization,
export format changes, cloud synchronization, authentication, AI, notifications,
and dependency upgrades remain excluded.

## The gap this closes

Workout History renders a period selector, a period label, previous and next
controls, and a summary computed for the selected range. Then it renders a list of
completed workouts computed for no range at all:

```ts
// WorkoutHistoryScreen.tsx, before this specification
const [page, summary, profile, performedExercises] = await Promise.all([
  useCases.list.execute(),
  useCases.getSummary.execute(periodDetails.range),
  // …
]);
```

`WorkoutHistoryPageQuery` carried only `cursor` and `limit`, and
`listCompletedPage` filtered on `status` and an optional cursor with no date
predicate anywhere.

What that cost, with workouts in July and August 2026 and the period moved back:

- The `Month · July 2026` summary sat directly above August workout cards.
- A period holding nothing showed a zeroed summary above the most recent
  workouts, from whichever month those happened to be in.
- Moving the period re-fetched the list and re-fetched the identical unfiltered
  page, because the `load` callback declared both range dates as dependencies and
  the read ignored them.
- `No completed workouts yet` could only ever mean "you have never completed a
  workout", so the screen could not say the one thing a period view most needs
  to.

Nothing stated an untruth. `Summary period` scoped itself to the summary and
`Recent workouts` claimed recency, not membership.
[Specification 0015](0015-workout-history-progress-foundation.md) lists the
periods and "a bounded recent-workout list" as separate things. This is an
unfinished design rather than a defect, and the repository says so three times
over: a dependency array that does nothing, an index built for a list no list
used, and an empty state that cannot name an empty period.
[Specification 0035](0035-owner-named-workouts.md) made rows distinguishable by
name, which turned a latent mismatch into a visible one.

## The period governs the list

[ADR 0026](../docs/decisions/0026-a-period-control-governs-every-list-beneath-it.md)
records the decision: **a control that scopes one read on a screen scopes every
read on that screen that presents the same subject.**

`Exercise progress` on the same screen is deliberately not governed. It lists what
a person has ever performed, which is a claim about their training rather than
about a period.

**Membership is decided by `started_local_calendar_date`**, the date the summary
already groups by, so a workout started at 23:00 and completed at 00:00 the next
day is listed and counted by the same period — the one it started in. The
alternative is not merely worse, it is unavailable: `workout_session` stores
`completed_at_epoch_ms` and no completed local calendar date, so a completion-date
filter needs a derived date per row and a migration, in exchange for putting a
midnight workout in one period's list and another period's total.
`docs/architecture/offline-workout-history.md` already states that a workout
crossing midnight remains on its start day.

## Ownership

**The domain is unchanged.** A calendar range is a read boundary. `packages/domain`
has no period, range, or list concept, and gains none.

**A new query type, not a wider shared one.**

```ts
export type CompletedWorkoutPageQuery = WorkoutHistoryPageQuery &
  Readonly<{ range?: WorkoutHistoryRange }>;
```

`WorkoutHistoryPageQuery` is shared with `listExercisePerformancePage`, whose
screen has no period control. An optional `range` there would declare a capability
one of two readers silently ignores — the failure
[ADR 0025](../docs/decisions/0025-a-workout-name-is-its-owners-label.md) spent a
sprint diagnosing in the `Snapshot` suffix. Only `listCompletedPage` changes
signature, and only `ListWorkoutHistoryUseCase` calls it.

**The use case validates with the rule it already had.** A query carrying a range
is checked by the same `requireValidRange` helper
`GetWorkoutProgressSummaryUseCase` uses, and refused with the same sentence before
any read. A query carrying no range behaves exactly as it did, proven by a test
asserting the repository receives no `range` key.

**The composition roots do not change.** `createWorkoutHistoryUseCases` wires the
same instances.

**The SQL gains one predicate**, the one `summarizeCompletedRange` already binds:

```sql
AND session.started_local_calendar_date BETWEEN ? AND ?
```

The ordering, the cursor clause, the `LIMIT`, and the three correlated subselects
are untouched, and no query is added per row.

## No migration, and the index that proves it

Migration 10 built:

```sql
CREATE INDEX workout_session_completed_local_date
ON workout_session (
  status, started_local_calendar_date DESC,
  started_at_epoch_ms DESC, id DESC
)
```

The bounded query applies equality on `status` (the leading column), a range on
`started_local_calendar_date` (the second), and orders by columns two, three, and
four in the index's own order and direction. SQLite seeks and scans in index
order, with no temporary b-tree for the sort. The unbounded query it replaces uses
the same index and scans every completed row until the limit is met, so **a
bounded page cannot be slower than the page it replaced**. This is asserted with
`EXPLAIN QUERY PLAN` against a real engine rather than claimed.

A `BETWEEN` aggregate needs no third and fourth key column. Those two are the
tie-breakers of a keyset-paginated list. The index was built for this query before
this query existed. **No migration, no index, and no dependency is added.** The
schema stays at user version 11.

## Paging within a period

The cursor already carries `(startedLocalCalendarDate, startedAtEpochMilliseconds,
id)` — every column the range predicate and the ordering use — so it needs
nothing new. The range bounds the window and the cursor bounds the position inside
it. Termination is unchanged: `limit + 1` rows decide whether a next cursor
exists.

The range is stored beside the page it produced, not read from the current
selection, so a `Load More Workouts` press after the period moved extends the
period still on screen. Sending the new range with the old cursor could append one
period's rows beneath another's, or silently return nothing. The reload the period
change already triggered replaces the whole page moments later.

## Concurrency and the error model

This specification writes nothing.

Moving quickly between periods starts one read per period, and a slower earlier
one finishing last would leave one period's summary above another period's
workouts — exactly the disagreement this specification exists to prevent. The
screen adopts the request-sequence guard `ProgressScreen` already uses: only the
newest read may call `setReady`, `setError`, or clear the loading state. That race
existed before and was invisible while the list was unbounded.

| Case                                           | Outcome                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Range start after its end, or a malformed date | Refused before any read. Nothing is queried.                         |
| Period holds no workouts                       | Not an error. An empty page, a null cursor, and its own sentence.    |
| Page load fails                                | The error state, as before.                                          |
| `loadMore` fails mid-list                      | The loaded page is retained and an inline message is announced.      |
| Period changed while a read is in flight       | The superseded read is discarded. The newest read writes the screen. |

Every sentence is one the application already had. None names SQL, a table, a
column, an identifier, a path, or a stack trace:

- `Workout history date range is invalid.`
- `Workout history could not be loaded.`
- `More workouts could not be loaded.`

The range the screen produces is always valid — `getCalendarPeriodDetails` derives
start before end by construction — so the refusal is defensive and exercised by
unit test only.

## User-facing behavior

No new screen and no new control. Two visible strings change and two are added.

| String                             | Before            | After                     |
| ---------------------------------- | ----------------- | ------------------------- |
| Period selector label              | `Summary period`  | `History period`          |
| Section heading above the workouts | `Recent workouts` | `Workouts in this period` |

`Summary period` understated a control that now governs the whole screen, and
`History period` matches `Progress period` on the sibling screen, so one
vocabulary covers both. `Recent workouts` stops being true the moment July is
viewed from August; those workouts are not recent, they are the period's.

New, for a period holding no workouts:

| String                                                        | Where                   |
| ------------------------------------------------------------- | ----------------------- |
| `No workouts in this period`                                  | empty state title       |
| `Choose another period, or finish a workout to add one here.` | empty state description |

`No completed workouts yet` and `Finish a workout with at least one performed set
to build your history.` are unchanged and still shown, only when no completed
workout exists at all. The screen distinguishes the two by reading one unbounded
page of one workout, because a bounded page cannot tell an empty period from an
empty history, and the performed exercises cannot answer it either: a completed
workout that recorded no set is history without being a performed exercise.

Every other visible string, every history card, the performed summary, and the
`Exercise progress` section are unchanged.

## Experience and accessibility

`EmptyState` renders a `Surface`, not a `Card`, with its title as
`accessibilityRole="header"` and its description as its own `AppText`. Both
sentences reach the accessibility tree independently, so
[ADR 0024](../docs/decisions/0024-labelled-containers-announce-their-contents.md)
is not engaged and no announced name changes.

**No labelled card gained a control and no card gained or lost a label.** Sprint
34's guarantee — 56 card usages, 19 labelled, none containing an interactive child
— is unchanged and asserted.

No accessible name changes anywhere. The period selector and the section heading
announce their new text; `Show previous {period}`, `Show next {period}`, every
history card label, and the performed summary's composed name are byte-identical
to what they were.

Focus order is unchanged: heading, period control, period label, previous and
next, summary, section heading, cards, `Load More Workouts`, exercise progress.
The empty state replaces the cards in the same position.

At the largest accessible text size, an empty period makes the screen shorter,
never taller, because one `Surface` of two lines replaces a list of cards.
`Workouts in this period` is eight characters longer than `Recent workouts` and
may wrap to a second line where the old heading did not; `SectionHeader` already
wraps and nothing truncates.

`Next` remains enabled past today, unlike Progress. A future period now says
`No workouts in this period`, which is true and useful. Disabling it is a separate
design question and stays out of scope.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, or dependency. The range comes
from the device clock and a three-option selector, is bound as SQL parameters, and
is never logged. Nothing is backed up anywhere.

The bounded page is strictly narrower than the unbounded page it replaces, on the
same index, proven above. One additional `LIMIT 2` seek per screen load answers
whether any completed workout exists, on the same index's leading column. No
per-row query is added.

## Data lifecycle

**Export, restore, local erasure, and replacement restore are untouched.** Export
serializes stored rows, not a screen's read model; no field is added, removed, or
retyped, and the format stays at version 1.

Personal records, their categories, values, ordering, ties, and evidence links are
unchanged. A record is an all-time claim and may cite a workout outside the
selected period, which is correct.

Correction, removal, addition, deletion, and naming are untouched. Each is reached
through a history card, and a card still opens the same workout. A renamed workout
stays in the period it started in, because a rename writes no instant and no date.

The exercise performance history screen, its query type, its SQL, its cursor, and
its paging are unchanged.

## Verification and completion

Application: a range is forwarded verbatim with the normalized limit; a query
without a range carries no `range` key at all; an inverted or malformed range is
refused before any read.

Infrastructure, against a statement-capturing fake: a bounded page binds the range
between the status and the cursor and keeps its ordering; an unbounded page
contains no date predicate and binds exactly what it always did.

Infrastructure, against a real SQLite engine with the repository's own migrations:
both boundary days are inclusive and the days beside them are excluded; a workout
started at 23:00 on the last day of a period and completed after midnight is
returned by that period and not the next; paging with a limit of two returns every
workout in a period exactly once, across three pages, and stops; a period holding
nothing returns an empty page and a null cursor; a query with no range still lists
all completed history and no active session; and the bounded statement's query
plan names `workout_session_completed_local_date` and contains no temporary
b-tree.

Presentation: the list and the summary are read for the same span and move
together when the period moves; paging uses the range of the page on screen; a
superseded period read cannot overwrite a newer one, proven by a test that fails
without the guard; an empty period with history elsewhere states its own sentence
and not the never-completed one; a history with nothing in it keeps the
never-completed one; and the renamed control and section render.

Regression: every existing assertion passes unmodified. No end-to-end assertion
ever targeted either renamed string.

## The end-to-end limit, stated plainly

**No end-to-end flow can create a workout in a previous period.** Start and
completion instants are captured from the device clock and are not editable, and
this specification does not make them so. A database fixture, a production seeder,
a hidden route, and a test-only bypass are all excluded.

Provable end to end, and covered by the Sprint 36 suite: a day period holding
today's workout shows it; the previous day says `No workouts in this period` and
not `No completed workouts yet`; returning to today restores the card; a future
period says the same period-empty sentence; and a history with no completed
workout at all still says `No completed workouts yet`.

Manual QA only, because the product cannot create the precondition: workouts in
two different months with the period moved between them, a period holding more
than one page, and a workout crossing midnight. These are recorded as manual
claims rather than written as scenarios that appear to prove them while only ever
exercising today.

## Explicit exclusions

Giving `listExercisePerformancePage` a range; disabling `Next` past today;
bounding `Exercise progress`; renaming the `Snapshot`-suffixed projected fields;
unit tests for the four untested Nutrition screens; removing the stale worktree.
