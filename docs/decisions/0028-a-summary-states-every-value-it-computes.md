# ADR 0028: Let a summary state every value it computes, and let a value carry its own coverage

**Status:** Accepted

**Extends:** [ADR 0023](0023-displayed-totals-state-their-coverage.md), which
decided what a displayed total says about its own coverage, and was therefore
silent about a value that is never displayed at all.

## Context

[ADR 0023](0023-displayed-totals-state-their-coverage.md) audited every derived
total the application displays and found exactly one that excluded recorded work
without saying so. The audit's scope was the displayed set. Three values were
outside it, because they are displayed nowhere.

`GetProgressSummaryUseCase` computes, on every load, an average per logged day
for protein, carbohydrate, and fat; a period's non-water fluid; and an average
plain water per logged day. `progress-models.ts` types all five. `ProgressScreen`
renders none of them. A grep of `apps/mobile/src` excluding specifications finds
`averageGramsPerLoggedDay` and `averagePlainWaterMillilitersPerLoggedDay` in the
use case and the model and nowhere else, and `otherFluidMilliliters` in those two
files and in the hydration reader that produces it.

[Specification 0016](../../specs/0016-progress-analytics-and-qa-reporting.md) is
Approved and enumerates them by name: "Protein, carbohydrate, and fat
totals/averages", and "Hydration total fluid, plain water, other fluid, entry
count, logged days, and averages over hydration-logged days". The
[offline Progress architecture](../architecture/offline-progress-analytics.md)
describes shipped behavior and states a rule about how a nutrient's average is
presented — which presumes it is presented.

So the repository holds an approved promise, a described behavior, a computation,
a type, and no screen. That is not a curated presentation subset. A curated
subset does not type what it curates away.

The same audit surfaced two smaller shapes of the same problem. On
`ProgressNutrientSummary`, `isComplete` and `totalGrams === null` were one fact
written twice, because `totalGrams` was assigned `isComplete ? sum(...) : null`
and one consumer read the boolean. And `ProgressScreen` rendered
`formatProgressEnergy(value.averageEnergyKilojoulesPerLoggedDay ?? 0)`, which is
the exact untruth ADR 0023 exists to prevent, made unreachable by a branch rather
than by not being written.

## Decision

**A value an application computes for a screen is a value that screen states, or
it is a value the application does not compute.**

The rule applies to a derived read model, which is where a computed-and-discarded
value can survive review: it is typed, so it looks intentional; it is summed, so
it looks used; and it costs nothing visible, so nothing forces the question.

Three consequences are part of the decision.

**Deleting is a legitimate answer, and it must be priced rather than assumed
away.** The honest alternative to displaying an unused computation is removing
it. Progress displayed instead, on evidence: an Approved specification promises
the values, the day-level hydration screen already names the one a person would
otherwise compute by subtraction, and deleting the summary's other-fluid field
would have left the same value computed and discarded one layer lower, inside a
`SUM` in the hydration statement. Where that evidence is absent, deletion is the
right answer and this rule requires it.

**A value carries its own coverage, and an explanation of a word is not a
coverage statement.** This bounds ADR 0023 in the one place the two rules meet.
ADR 0023 requires a coverage claim to be unconditional because a person cannot
tell from a number whether a qualifier would have applied. When a value's own
rendered text is the coverage claim — `Incomplete` where a quantity would
otherwise stand, in every period, unconditionally — that requirement is already
satisfied by the value. A sentence that defines the word `Incomplete` is a
glossary entry, not a claim about a number, and it may render only when the word
it defines is on screen. Rendering a definition of a word that is absent explains
nothing and invites a search for something incomplete. The nutrition diary
already composes its explanation this way.

**Two representations of one fact are one representation.** `isComplete` is
removed from `ProgressNutrientSummary` and the screen names the condition it
needs from the null it implies. The nutrition reader contract keeps its own
`isComplete`, because the reader uses it to decide the null from
`knownCount === entryCount` and a reader contract was outside the change that
found this. That duplicate survives, recorded here, rather than being fixed under
a presentation change.

Persist nothing. No migration, index, column, constraint, table, trigger,
dependency, domain change, query change, SQL change, reader-contract change, or
export-format change. No value's arithmetic changes and no total's numeric value
changes. The schema stays at user version 11.

## Consequences

- Five values a person could not read become five lines they can, and every
  value the progress summary computes is now stated.
- The Nutrition card renders a fixed ten metrics whenever the period holds a
  logged day, because a nutrient's total and its average are null together and
  both say `Incomplete`. Its height stops varying with completeness, which
  closes a fixture-dependent height rather than opening one. The Hydration card
  gains two lines of fixed height for the same reason.
- Two labels are renamed. `Average per logged day` was unambiguous while one
  average existed per card and names no subject once four do, which a person
  navigating by accessible element would meet first.
- The unreachable `?? 0` fallbacks are gone. Each average renders only when its
  value exists, matching the null-`repetitions` and null-`changeGrams` lines
  already in the same file.
- A future value inherits the rule before a second consumer exists. A chart built
  on this summary inherits a summary that states what it counted.
- The rule stays repeatable rather than enforced. Nothing prevents the next
  author typing a field no screen reads; this record, the specification, and the
  mobile development guide are the mitigation.

## Alternatives considered

- **Delete the three values.** Real, and priced in the decision. Rejected on the
  specific evidence available here, not as a class.
- **Treat this as an application of ADR 0023.** Rejected. ADR 0023 governs what a
  displayed total says; these values are not displayed, and three of them
  survived that audit precisely because they fell outside its scope. Filing this
  underneath it would also leave the conditional-explanation boundary undecided,
  which is the question that actually took the work.
- **Make the completeness sentence unconditional.** Rejected for the reason
  stated in the decision: the coverage claim is the value, and the sentence
  defines a word rather than qualifying a number. An unconditional definition of
  a word that never appears is noise a person must resolve.
- **Render a total and its average as one metric.** Rejected. `Metric` composes
  `label, value` into one accessible element, so one metric carrying two numbers
  makes a single spoken utterance carry both, and gives the value a shape that
  varies with completeness. Two lines cost height, which is the cheaper problem
  and the one this repository already knows how to test against.
- **Add a formatter for averages.** Rejected. `formatProgressMass` and
  `formatProgressVolume` already produce every string required, and Sprint 30
  spent a sprint removing a second formatting path.
- **Add a coverage sentence to `Other fluids`.** Rejected on evidence. Migration
  11 constrains `fluid_type IN ('plain-water', 'other-fluid')` and the hydration
  statement sums two disjoint `CASE` expressions over exactly those values, so
  plain water and other fluids are exhaustive over the total. Nothing is
  excluded, so there is nothing to state.
- **Keep `isComplete` for readability at the call site.** Rejected.
  `item.isComplete` reads better than `item.totalGrams === null` at one call
  site, and a named local recovers that without a second field a future consumer
  could read instead of the null.
