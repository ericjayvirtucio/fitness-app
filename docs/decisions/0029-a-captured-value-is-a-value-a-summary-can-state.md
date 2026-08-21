# ADR 0029: Let a value the application captures be a value every summary of it can state

**Status:** Accepted

**Precedes:** [ADR 0028](0028-a-summary-states-every-value-it-computes.md), which
decided what happens to a value the application computes, and was therefore
silent about a value it captures and never computes over.

## Context

[ADR 0028](0028-a-summary-states-every-value-it-computes.md) decided that a value
an application computes for a screen is a value that screen states, or it is a
value the application does not compute. Every value inside its scope was already
being computed; the defect was that three of them reached a type and no screen.

That rule cannot reach the defect this record addresses, and saying so precisely
matters, because the two look similar.

The consumption entry form asks a person for six optional nutrients — protein,
carbohydrate, fat, fiber, sugar, and sodium. Migration 4 stores six, each
nullable with a non-negative `CHECK`. `summarizeConsumptionEntries` in
`@fitness/domain` totals six for a day, over a frozen field list, with strict
unknown propagation. The nutrition diary renders six lines and names the unknown
ones.

`NutritionProgressSqliteReader` projects three. Fiber, sugar, and sodium are
never summed over a period, never typed on `NutritionProgressDay`, and never
rendered on the Progress tab.

Under ADR 0028 alone that state is fully compliant. Nothing computes a period
fiber total, so there is no computed-and-discarded value to find. A person who
records sodium at every meal can read today's sodium and cannot read this
week's, and no rule in this repository was violated to produce that.

The gap was not a product decision. [Specification 0038](../../specs/0038-progress-states-everything-it-counted.md)
names the same three nutrients twice in its exclusions — "fiber, sugar, and
sodium in Progress" — which is a sprint drawing a scope boundary.
[Specification 0016](../../specs/0016-progress-analytics-and-qa-reporting.md)
states its completeness rule about "an optional nutrient" with no count, and only
its enumeration says three. No specification, decision record, or source comment
argues that a weekly sodium figure should be unreachable.

So the repository held a form asking for six, a schema storing six, a domain
function totalling six, a screen showing six for a day, and a period showing
three — with no recorded reason.

## Decision

**A value the application asks a person to record, stores under a constraint, and
already aggregates at one granularity is a value it aggregates at every
granularity it summarizes — or the product states why it does not.**

The rule is about the relationship between what an application captures and what
it gives back. Asking somebody for a number creates an obligation to return it;
returning it at one granularity and silently withholding it at another is the
shape of that obligation being half-met. Silence is the specific harm: a period
that shows no sodium line is indistinguishable, to the person reading it, from an
application that does not track sodium at all.

Two consequences are part of the decision.

**A nutrient is summarized over a period as both a total and an average per
logged day, and no nutrient is exempt.** The recorded quantity is a daily
quantity, so the period total's magnitude is an artifact of the period's length
rather than of the person, and the average is the figure that carries meaning
across periods of different lengths. This is the rule a seventh nutrient
inherits, and it exists because ADR 0028 makes the alternative expensive rather
than merely inconsistent: a nutrient with no displayed average must have no
computed average, so an asymmetric card requires a rule inside the summarizing
function that distinguishes two classes of nutrient.

Three candidate rules for such an asymmetry were tried and all three fail.
"Macronutrients get averages" inverts the utility ordering, because fiber and
sodium are the two nutrients whose published guidance is stated per day most
emphatically. "Averages where the period total is not meaningful" selects every
nutrient. "Averages for what the previous sprint shipped" is a description of
history rather than a rule.

**Stating why a value is not summarized is a real answer, and it must be written
down rather than left as absence.** The honest alternative to summarizing a
captured value is declining to, in the product's own words, where the person
looking for it will meet them. What this rule forbids is the third option the
repository actually had: capturing the value, storing it, aggregating it once,
and leaving the other surface blank.

Persist nothing. This rule never justifies a migration, a column, an index, or a
new query on its own. It is satisfied by widening a projection the application
already runs, or by writing a sentence.

## Consequences

- Three nutrients a person could record and never read over a period become six
  lines they can read, and every nutrient the application captures is now
  summarized at both granularities.
- The Nutrition Progress card carries sixteen metrics rather than ten. That cost
  is accepted rather than hidden: it is the price of the symmetry, and
  [Specification 0039](../../specs/0039-progress-counts-every-nutrient-you-logged.md)
  states it in lines, in accessibility stops, and in Dynamic Type height.
- Sprint 38's fixed-height property survives and extends. A nutrient's total and
  its average are null together and both read `Incomplete`, so the card renders
  exactly sixteen metrics whenever the period holds a logged day.
- A future capture inherits the rule before a second surface exists. A field
  added to an entry form now arrives with the question already asked: which
  summaries state it, and if one does not, what does that summary say instead.
- The rule composes with ADR 0028 rather than restating it. ADR 0028 governs the
  step from computation to screen; this record governs the step from capture to
  computation. A value that clears both is captured, summarized, and stated.
- The rule stays repeatable rather than enforced. Nothing prevents the next
  author adding a seventh nutrient to a form and three summaries out of four;
  this record, the specification, and the mobile development guide are the
  mitigation.

## Alternatives considered

- **File this under ADR 0028.** Rejected, and this was the closest call. ADR 0028
  decides what happens to a computed value; a period fiber total was never
  computed, so 0028 has nothing to bite on and the pre-existing state satisfied
  it completely. Filing this underneath would also leave the averages-symmetry
  rule undecided, which is the question that actually took the work.
- **Decide nothing and treat Sprint 39 as a product change.** Rejected. Without a
  recorded rule the seventh nutrient re-opens the same argument from scratch, and
  the three-nutrient list is itself the evidence that an unrecorded boundary
  survives review indefinitely.
- **Require every captured value to be summarized, with no escape.** Rejected. A
  captured value can legitimately have no period meaning, and a rule with no
  honest exit is a rule people route around. Requiring the product to state the
  exception keeps the exit visible.
- **Give the three new nutrients totals without averages.** Rejected on the
  absence of a defensible rule, as recorded in the decision. It would also teach
  a person that the six nutrients are two classes, when the form, the schema, and
  the diary treat them as one.
- **Remove all three existing averages instead, for six totals and ten metrics.**
  Real, and the only symmetric alternative that shrinks the card. Rejected
  because it withdraws values Specification 0016 promises and Sprint 38 shipped,
  and because under ADR 0028 it also requires deleting the computation.
- **Add a sub-heading or a disclosure control inside the card to absorb the
  height.** Rejected here as premature rather than wrong. It is a re-layout, and
  it would add a visible string to solve a problem no measurement has yet
  established. Manual QA counts VoiceOver stops at the largest accessible size;
  that measurement is what should authorize the layout change.
