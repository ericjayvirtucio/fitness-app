# ADR 0023: Let a displayed total state its own coverage

**Status:** Accepted

**Extends:** [ADR 0010](0010-derived-workout-history-progress.md), which defined
recorded load volume and its eligible modes without deciding what a screen says
about them.

## Context

[ADR 0010](0010-derived-workout-history-progress.md) derives history and progress
at read time and defines recorded load volume as resistance multiplied by
repetitions for external load and added bodyweight load. Assistance is excluded
because greater assistance does not represent greater performed load, and
[ADR 0022](0022-personal-record-ordering-direction.md) later established the
general form of that reasoning: a claim may state one dimension and never combine
two.

The exclusion is correct and remains correct. What was never decided is what the
application says about it. Every derived total was audited against the SQL that
produces it, and exactly one — recorded load volume — excludes recorded work.
That single exclusion produced two failures on the screen where a person meets it.

A period mixing a bench press with assisted pull-ups displayed `160 kg-reps
recorded load volume`: correct by its own definition, and silent about the
assisted sets it did not count. A period holding only assisted work displayed
nothing at all — no line, no zero, no explanation.

[Specification 0032](../../specs/0032-recorded-result-meaning.md) solved the same
shape one level down, for a single recorded set, by passing the captured logging
mode into the formatter so a stored mass could say what it meant. A derived total
needs no new parameter. It needs a sentence.

## Decision

**A displayed total either covers every recorded thing of its own dimension, or
states its coverage in the sentence that carries it.**

The statement of coverage is unconditional, positive, and short. It never states
a reason, never names the excluded work, and never compares eligible work with
ineligible work. A reason belongs in a specification and an architecture document,
which is where this one already was.

Two consequences keep the rule cheap, and both are part of the decision.

**Coverage wording is unconditional, so no contract widens.** Saying "this does
not count your assisted sets" is truthful only when assisted sets exist, and
knowing that would require the reader to report the presence of ineligible work.
Saying "from weighted sets" is true in every period, needs nothing the reader does
not already return, and reads identically from one week to the next. A qualifier
that appears only sometimes is a qualifier a person cannot rely on.

**An absent total states its absence when anything was recorded, and stays absent
when nothing was.** `No recorded load volume from weighted sets` is the covered
sentence with the number removed. It is rendered when the period holds actual sets
and no eligible ones, and omitted entirely when the period holds no sets, because
the summary already says there were no completed workouts.

Eligibility stays in SQL, where it already lives, expressed once per query.
Presentation never consults the list, because unconditional wording does not
depend on it. The coupling between the list and the word "weighted" is guarded by
a test driven by `exerciseLoggingModes`, so a ninth logging mode fails the suite
until somebody decides whether it contributes.

The reader contract does not change. `WorkoutProgressSummary` already
distinguishes recorded work with no eligible sets — an absent volume with a
non-zero actual set count — from nothing recorded at all.

**A labelled summary card's accessible name carries its contents.** A `Card`
carrying an `accessibilityLabel` is one accessible element, so its children never
reach the accessibility tree: the Workout History summary announced its own name
and not one of the numbers it displayed. A coverage sentence that only sighted
users can read does not satisfy the rule, and announcing the coverage of a total
that is itself never announced would be worse than silence. The name is composed
from the same strings the card renders, so the announced sentence and the read
sentence stay identical.

Persist nothing. No migration, index, column, constraint, table, trigger,
dependency, domain change, query change, use-case change, or reader-contract
change. No total's numeric value changes.

## Consequences

- One number stops depending on the reader remembering how their exercises were
  configured, and one absence stops being invisible.
- Exactly one load volume line renders for every period that recorded any set, so
  this dimension no longer changes the height of Workout History with the data.
  That height cost Specification 0032 an end-to-end scenario; it is now closed
  rather than compensated for.
- A screen-reader user hears the summary's numbers for the first time.
- A future total inherits the rule: it is full over its dimension, or it says
  what it covers. A chart of load volume inherits a sentence that is already
  honest.
- The per-exercise screen takes the same covered wording from the same function
  and keeps its absent case silent, because its rows cannot mix modes and each
  ineligible row already states its own dimension. That asymmetry is deliberate
  and recorded.
- The eligible-mode list stays duplicated across two queries. That predates this
  decision and is left as debt rather than refactored under a wording change.

## Alternatives considered

- **Explain the exclusion in the sentence.** Rejected. `No recorded load volume,
because assistance and bodyweight work are not counted as load` is honest and
  long, and it names and implicitly compares the excluded work in the one place
  the application must not.
- **Stay silent when nothing is eligible, and qualify only where the number
  appears.** Rejected on three grounds: it declines to explain an absence a person
  can encounter for weeks; an absence inside a single-element card cannot be
  proven end to end at all; and it leaves the fixture-dependent height that has
  already broken a run.
- **Qualify only when ineligible work is present.** Rejected. Contextual wording
  is inconsistent week to week, and it widens a reader contract that Progress also
  consumes in order to say something no more true than the unconditional form.
- **Render zero instead of omitting.** Rejected. Zero is a false claim about
  ineligible work, and an absent dimension has never been rendered as zero.
- **Report a second, assistance-aware volume.** Rejected. It is the score
  abstraction this architecture refuses, and ADR 0022's rule forbids the
  combination it would require.
- **Lead with the qualifier, as Specification 0032 does.** Rejected here. That
  rule exists because a set row can lose its tail and an unqualified mass is
  ambiguous. `kg-reps` is unambiguous alone, the qualifier states coverage rather
  than meaning, and a summary card is a list of totals read by number.
- **Name the eligible-mode list once in the domain.** Rejected. `@fitness/domain`
  owns the modes; which of them a read-time aggregate sums is a query decision
  with one consumer, and ADR 0017 refused the same move for record labels.
