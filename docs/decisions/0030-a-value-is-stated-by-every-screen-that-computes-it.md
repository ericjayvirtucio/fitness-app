# ADR 0030: Let a value be stated by every screen that computes it, not by one screen somewhere

**Status:** Accepted

**Extends:** [ADR 0028](0028-a-summary-states-every-value-it-computes.md), which
decided what happens to a value computed and displayed nowhere, and was
therefore silent about a value computed by two screens and displayed by one.

## Context

[ADR 0028](0028-a-summary-states-every-value-it-computes.md) decided that a value
an application computes for a screen is a value that screen states, or it is a
value the application does not compute. Its audit scope was explicit: a grep of
`apps/mobile/src` finding a field "in the use case and the model and nowhere
else". Five values matched, and all five were displayed by nothing.

That scope cannot reach the defect this record addresses, and the two look
similar enough that saying so precisely matters.

`WorkoutHistorySqliteRepository.summarizeCompletedRange` produces one
`WorkoutProgressSummary` of eight fields from one statement. Two capabilities
consume it. `WorkoutHistoryScreen` renders all eight. `ProgressScreen` renders
five, and withholds performed duration, performed distance, and recorded load
volume.

Under ADR 0028 read at application granularity that state is compliant. The grep
finds all three fields in a screen, so nothing is computed and discarded, and no
rule in this repository was violated to produce it. Under the same rule read at
screen granularity it is not compliant: the Progress screen computes three values
on every load and states none of them.

Nothing in the repository chose between those readings, and the difference
decides a real question. A person whose training is running, rowing, cycling, or
a timed hold opened the tab named Progress and read a session count, a set count,
an exercise count, and a wall-clock elapsed time — no distance, no performed
duration, and no way to tell from the screen that the application had computed
both. A person lifting read no volume on that tab while the number sat on another
one.

The gap was not a product decision.
[Specification 0016](../../specs/0016-progress-analytics-and-qa-reporting.md) is
Approved and promises the selected period presents "logging-mode-eligible result
totals" — the phrase for exactly these values. The
[offline Progress architecture](../architecture/offline-progress-analytics.md)
states "Every value the summary computes is a value the screen states" and the
[mobile development guide](../mobile-development.md) states "Every value the
summary computes is displayed"; both sentences were written about nutrition and
hydration and were never true of workouts. No specification, decision record, or
source comment argues that a weekly distance should be unreachable from Progress.

## Decision

**A value is stated by every screen that computes it, not by one screen
somewhere.** "It is displayed elsewhere" is not an answer to ADR 0028. The unit
of that rule is the screen, and a screen that loads a value and says nothing
about it owes the same answer as an application that computes a value and shows
it nowhere: state it, or do not compute it, or say why not.

Three consequences are part of the decision.

**A shared read model makes "do not compute it" expensive, and that cost is a
reason to display rather than an excuse to do neither.** ADR 0028 required
deletion to be priced rather than assumed away. Here it is priced and closed: the
three fields are produced by one statement and rendered by Workout History and
the per-exercise screen, so deleting them from `WorkoutProgressSummary` would
break two surfaces to satisfy a rule about a third. When a second consumer
forecloses deletion, the remaining exit is to state the value. What is not
available is the third option the repository actually took — loading it,
discarding it, and pointing at the other screen.

**The harm this rule addresses is smaller than ADR 0028's, and the record says
so.** A value nobody can reach is a value the application effectively does not
have. A value on another screen is a value behind a navigation, and since
[ADR 0023](0023-displayed-totals-state-their-coverage.md) gave the Workout
History summary card its contents as its accessible name, a screen-reader user
reaches these three as readily as a sighted one. Overstating that difference
would make this record less useful, not more. What is lost is not access but
placement: a person reading a period summary is told four things about a period
that had eight to say, and nothing on the screen indicates the other four exist.

**Stating why a screen declines a value it computes remains a real answer.** As
in [ADR 0029](0029-a-captured-value-is-a-value-a-summary-can-state.md), the
escape is visible rather than silent. A summary may legitimately decline a
dimension its reader carries — but it declines it in the product's own words,
where the person looking for it will meet them, not by omission.

Persist nothing. This rule never justifies a migration, a column, an index, a
query, or a widened reader contract on its own. It is satisfied by rendering a
value a screen already holds, or by writing a sentence.

## Consequences

- Three dimensions a person could record and not read on the Progress tab become
  two metrics and one sentence they can read, and every value the Progress
  summary computes is now stated by the screen that computes it.
- The Progress Workouts card carries up to seven metrics and one sentence rather
  than five metrics. That cost is accepted rather than hidden:
  [Specification 0040](../../specs/0040-the-workouts-card-states-what-it-recorded.md)
  states it in lines, in accessibility stops, and in Dynamic Type behavior.
- Progress and Workout History state the same eight values in the same order in
  the same vocabulary, from the same formatters. One announces them inside a
  labelled card; the other exposes each as its own accessibility element. That
  redundancy is deliberate — the two screens answer different questions about the
  same period — and the shared wording is what keeps them from becoming two
  claims.
- Recorded load volume carries ADR 0023's coverage on a second surface, in both
  directions, from the same two strings. Nothing is reworded and no second
  sentence exists.
- Two documentation sentences that were false become true, rather than being
  narrowed to describe the defect.
- A future shared read model inherits the question before its second consumer
  exists: which screens state this, and if one does not, what does that screen
  say instead.
- The rule composes with the two records beneath it. ADR 0029 governs capture to
  computation; ADR 0028 governs computation to screen; this record fixes the
  granularity of "screen" in that sentence. A value clearing all three is
  captured, summarized, and stated wherever it is loaded.
- The rule stays repeatable rather than enforced. Nothing prevents the next
  author reading a shared summary and rendering half of it; this record, the
  specification, and the mobile development guide are the mitigation.

## Alternatives considered

- **File this under ADR 0028 and write nothing.** Rejected, and this was the
  closest call — closer than ADR 0029's equivalent, because ADR 0028's rule as
  written does arguably reach this while ADR 0029's did not reach fiber. It is
  rejected for the reason ADR 0029 recorded about its own near-miss: the reading
  that makes 0028 bite is not the reading 0028's audit used, and an unrecorded
  reading re-opens the argument the next time a read model feeds two screens.
  Filing it underneath would also leave the shared-model deletion question
  undecided, which is what actually took the work.
- **Treat the pre-existing state as deliberate curation.** Rejected on evidence,
  not on preference: an Approved specification enumerates the values, two
  documents claim they are displayed, and no document, comment, or record argues
  for withholding them. A curated subset does not leave two live sentences
  asserting it does not exist.
- **Delete the three fields from `WorkoutProgressSummary`.** Real, and priced in
  the decision. Rejected on the specific evidence that two other surfaces render
  them from the same statement.
- **Rule that a value need only be stated once in the application.** Rejected.
  It is the rule the pre-existing state implicitly followed, and it makes any
  omission defensible by pointing at any other screen — which is indistinguishable
  from having no rule.
- **Require a screen to state every field of every model it loads.** Rejected as
  the same rule with no honest exit. A screen can legitimately load a field for a
  condition rather than for display — `actualSetCount` decides whether the
  coverage sentence renders at all — and a rule people must route around stops
  being consulted.
- **Give Progress its own narrower reader so the question disappears.** Rejected.
  It answers a presentation question with a query, adds a second statement over
  the same rows, and would leave the same three values computed for Workout
  History and absent from Progress with the defect merely relocated.
- **Rename `Workout time` in the same change, since two durations now sit
  together.** Rejected here as out of scope rather than wrong. It is a changed
  visible string on two screens and it would rewrite an accessible name ADR 0023
  shipped. Specification 0040 records the ambiguity and the proposal instead of
  leaving it as absence.
