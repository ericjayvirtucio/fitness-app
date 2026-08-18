# ADR 0022: Let a personal record claim one dimension, ordered in a declared direction

**Status:** Accepted

**Amends:** [ADR 0017](0017-deterministic-workout-personal-records.md), in one
place — the clause excluding `assistance-and-repetitions`.

## Context

ADR 0017 derived personal records per logging mode at read time and claimed seven
categories, each ordering descending on exactly one canonical dimension. It gave
`assistance-and-repetitions` no category, reasoning that "assistance inverts load
semantics and trades against repetitions, so neither dimension orders alone and
combining them would be the score abstraction this architecture refuses."

Two of those three statements hold. Assistance does invert load semantics, and
combining assistance with repetitions would be a score. The middle one does not
survive its own precedent: `external-load-and-repetitions` also carries two
dimensions that cannot be combined, and it receives `heaviest-load` by claiming
the load and staying silent about the repetitions. Nothing distinguished
assistance except the direction of its ordering, and every branch of the records
query was written `DESC`.

The exclusion therefore rested on a mechanical limitation, while the screen
stated it as an impossibility:

> Personal records are not available for assisted work, because less assistance
> and more repetitions cannot be compared as one value.

The data was never missing. An assisted set persists as
`resistance-and-repetitions` with the assistance amount in `resistance_grams`,
and the starter exercise set ships `Assisted Pull-up`, so a fresh installation
could produce the history and then be told nothing could be said about it.

## Decision

**A category may claim one dimension and stay silent about the others. It may
never combine two.** This is the rule that replaces ADR 0017's assistance
exclusion, and it is what every existing category already obeys.

Add one category, `least-assistance`, eligible for `assistance-and-repetitions`
alone, comparing canonical grams, labelled `Least recorded assistance in a set`.
It claims the smallest assistance recorded on one completed set, with the workout
and set that prove it, and refuses to claim anything about repetitions, effort,
strength, or progression. The label carries the direction in its first word, so a
person reading only the label is not told a heavier number is better.

**Ordering direction becomes a required field on `PersonalRecordDescriptor`,**
beside the dimension. The dimension cannot determine it — `heaviest-load` and
`least-assistance` both order on resistance and order oppositely — so the
descriptor table is the only place that fully describes the comparison.
Specification 0022 required comparison rules to exist once rather than in SQL and
again in TypeScript; any other home for direction breaks that. Making the field
required rather than optional means adding a descriptor without deciding its
direction is a type error, not a silent descending default.

The boundary is unmoved. Column names, join shapes, index selection, and the
tie-break chain stay in infrastructure, so the table remains a description of
what may be claimed rather than a query plan. The statement builder interpolates
one token; there is no second query path for the ascending case.

Ties resolve exactly as before — the compared value in its declared direction,
then captured local date, start instant, exercise position, set position, and set
identifier ascending — so an equalled assistance credits the earliest completed
occurrence, as an equalled load already does.

Remove the assisted sentence from the screen rather than reword it, because the
card's own label now states the claim. Keep `unsupportedLoggingModes` and the
generic sentence: `exerciseLoggingModes` lives in `@fitness/domain` and the
descriptor table lives in `workout-history`, so a mode can enter the vocabulary
before a descriptor decides what may be claimed about it.

Zero assistance stays unrepresentable. `workout_set.resistance_grams` is
constrained above zero, and a repetition with no assistance is unassisted work
under a different logging mode, not an assisted set holding zero. No constraint
is relaxed or widened.

Repetitions under load stays excluded, on ADR 0017's own reasoning: it rewards the
lightest warm-up set. That is a claim about which comparison is truthful, and it
is untouched by this amendment.

Persist nothing. No migration, index, column, constraint, table, trigger,
dependency, domain change, reader-contract change, or use-case change.

## Consequences

- Every logging mode the domain defines now yields a personal record, so the
  descriptor table can be asserted exhaustively against the domain's own
  vocabulary with no exception list.
- A person working toward an unassisted repetition sees the progress the feature
  previously ignored, stated in words that are true.
- One sentence that claimed an impossibility is gone. Its true half survives in
  Specification 0031 and here, which is where a design reason belongs.
- Adding a category remains one descriptor row, one statement branch, and its
  tests — now including a direction, which is the point.
- `unsupportedLoggingModes` has no member in practice. It is retained
  deliberately, with a comment and a presentation test, rather than left as
  unexplained unreachable code.
- Assisted history stops at the mode boundary: somebody who reaches unassisted
  work starts a second record group rather than driving this one to zero. That is
  the per-mode partitioning working, not a gap.

## Alternatives considered

- **Keep the exclusion and fix only the sentence.** Rejected. Cheapest, but it
  leaves one of eight modes with nothing while the value sits in a column the
  reader already selects.
- **Combine assistance and repetitions into one value.** Rejected for the reason
  ADR 0017 gave, which this decision preserves intact.
- **Store assistance negated so a descending order works unchanged.** Rejected.
  It corrupts stored data to avoid one field, violates the positive-value
  constraint, and breaks formatting and export.
- **Infer the direction from the category name.** Rejected. A label convention
  would become load-bearing logic, and one badly named future category would
  silently invert a record.
- **Keep a direction map in infrastructure beside `comparedColumns`.** Rejected.
  It splits one comparison rule across two files, and a new descriptor could be
  added with no direction decided.
- **A second query path for the ascending case.** Rejected. It doubles the branch
  composition for one token.
- **Add repetitions-under-load in the same change.** Rejected. ADR 0017 rejected
  it on merit, and it would change what three existing modes already show.
