# ADR 0026: Let a period control govern every list beneath it

**Status:** Accepted

**Generalizes:** [ADR 0023](0023-displayed-totals-state-their-coverage.md), which
decided what a displayed total says about its own coverage, as a rule about a
sentence rather than about what a screen shows beside it.

## Context

Workout History renders a period selector, a period label, previous and next
controls, and a summary computed for the selected range — and then a list of
completed workouts computed for no range at all.
`WorkoutHistoryScreen.tsx` called `useCases.list.execute()` with no argument
while the same `Promise.all` passed `periodDetails.range` to the summary.

Nothing on that screen stated an untruth. `Summary period` scoped itself to the
summary and `Recent workouts` claimed recency rather than membership.
[Specification 0015](../../specs/0015-workout-history-progress-foundation.md)
lists "Day, Week, and Month periods, previous/next navigation, deterministic
summaries, a bounded recent-workout list" as four separate things and never binds
the fourth to the first.

The screen was nonetheless incoherent, and three pieces of repository evidence
said so rather than one preference.

The `load` callback declared both range dates in its dependency array, so
changing the period re-fetched the list and re-fetched the identical unfiltered
page. That dependency did nothing. It is only explicable as a list that was meant
to be bounded and never was.

Migration 10 built `workout_session_completed_local_date` on
`(status, started_local_calendar_date DESC, started_at_epoch_ms DESC, id DESC)`.
A `BETWEEN` aggregate needs no third and fourth key column. Those two columns are
the tie-breakers of a keyset-paginated list ordered by exactly those three
columns. The index is a list index, and no list used it.

And `No completed workouts yet` — the screen's only empty state — can only ever
mean "you have never completed a workout". A period view's most useful sentence,
"there are none in this one", was unsayable. That is a capability the screen could
not reach, not merely a wording it had not chosen.

The cost was a person reading a July summary and scrolling into August workouts
beneath it, and a period holding nothing showing a zeroed summary above unrelated
cards. [Specification 0035](../../specs/0035-owner-named-workouts.md) made rows
distinguishable by name, which turned a latent mismatch into a visible one.

## Decision

**A control that scopes one read on a screen scopes every read on that screen
that presents the same subject.**

Workout History's period control therefore governs the completed workout list as
well as the summary. The two describe the same span of time, always.

Three consequences are part of the decision.

**Membership is decided by the date the summary already groups by.** A workout
belongs to the period containing its `started_local_calendar_date`, so a workout
started before midnight and completed after it is listed and counted by the same
period. The alternative — the completion instant — is not merely worse; it is
unavailable. `workout_session` stores `completed_at_epoch_ms` and no completed
local calendar date, so filtering by completion would need a derived date per row,
a new column, and a migration, in exchange for splitting a midnight workout across
one period's list and another period's total.
[ADR 0008](0008-historical-workout-session-snapshots.md) and
`docs/architecture/offline-workout-history.md` already state that a workout
crossing midnight remains on its start day.

**A read that does not present the same subject is not governed.** `Exercise
progress` on the same screen lists the exercises a person has ever performed and
stays deliberately unbounded, because it is a claim about a person's training and
not about a period. A rule that swept it in would have made the screen say less,
not more.

**The empty states are two sentences, not one.** A period with no workouts and a
history with no workouts are different facts and a bounded page cannot tell them
apart, so the screen reads one unbounded page of one workout to decide which
sentence is true. `No workouts in this period` names a period a person can leave;
`No completed workouts yet` names a history a person can start.

Persist nothing. No migration, column, index, constraint, table, trigger,
dependency, domain change, or export-format change. The range predicate is the one
`summarizeCompletedRange` already binds, on the same column, inclusive at both
ends, and it seeks the second column of an index whose remaining columns are the
query's own ordering — so a bounded page scans a strict subset of what the
unbounded page scanned, in index order, without a sort.

`WorkoutHistoryPageQuery` does not gain the range. It is shared with
`listExercisePerformancePage`, whose screen has no period control, and an optional
field there would declare a capability one of two readers silently ignores —
which is the failure
[ADR 0025](0025-a-workout-name-is-its-owners-label.md) spent a sprint diagnosing
in the `Snapshot` suffix. `CompletedWorkoutPageQuery` carries it instead.

## Consequences

- A summary and the list beneath it can no longer describe different spans of
  time, in any period, in either direction of travel.
- A period that holds nothing says so in its own words, which the screen could
  not previously do at all.
- An index built for a bounded, ordered, cursor-paginated list is finally used by
  one, and the bounded query cannot be slower than the unbounded one it replaced.
- The list is shorter in most periods than it was. Someone accustomed to scrolling
  all of history now moves periods instead, and the section heading and the empty
  state both say why.
- Two visible strings change to match what they now govern:
  `Summary period` becomes `History period`, matching `Progress period` on the
  sibling screen, and `Recent workouts` becomes `Workouts in this period`, because
  July's workouts viewed from August are not recent.
- Only the newest read may write what the screen shows. Moving quickly between
  periods starts one read each, and a slower earlier one finishing last would
  restore exactly the disagreement this decision forbids. `ProgressScreen` already
  guarded this; Workout History did not, and the guard was invisible while the
  list was unbounded.
- Progress is unaffected. It performs one read, bounded to its own range, and
  renders nothing that is not derived from it. It already satisfies this rule.
- Searching history by workout name, charts, adherence, and streaks all consume a
  period-bounded list, and each can add its own optional field to
  `CompletedWorkoutPageQuery` behind the same index prefix.

## Alternatives considered

**Rename the control and the section, and leave the list unbounded.** The
cheapest option, and defensible: `Summary period` and `Recent workouts` already
almost say it. Rejected on the three pieces of evidence above — a dependency array
that does nothing, an index whose shape only a bounded list explains, and an empty
state permanently unable to name an empty period. It also leaves every future
period-scoped capability to reopen the same question.

**Filter by the completion instant.** Rejected: no completed local calendar date
column exists, so it needs a migration, and it puts a midnight workout in one
period's list and another period's total.

**Add the range to the shared `WorkoutHistoryPageQuery`.** Rejected: declares a
capability `listExercisePerformancePage` ignores.

**Filter a fetched page in memory.** Rejected: breaks keyset paging. A page of
twenty could yield no in-period rows while still reporting a next cursor.

**Add an index for the bounded query.** Rejected: proven unnecessary from the
column order of the existing one, and asserted with `EXPLAIN QUERY PLAN` against a
real engine rather than claimed.
