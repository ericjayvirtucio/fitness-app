# ADR 0036: FoodData Central coverage remains unproven

**Status:** Accepted

**Extends:** [ADR 0035](0035-nutrition-provenance-and-unapproved-food-data-sourcing.md),
which made a representative coverage evaluation one of two ways to reopen the
food-data sourcing decision.

## Context

Phase 5 requires food logging to find an item in a real database "most of the
time." ADR 0035 declined to infer that experience from FoodData Central's size
or the existence of its `gtin_upc` field. Sprint 50 therefore fixed a sampling
protocol and acceptance thresholds before inspecting the April 2026 bulk
release. Commit `05aeb9f` preserves that ordering.

The [coverage evaluation](../fooddata-central-coverage-evaluation.md) profiled
the official Foundation, FNDDS, and Branded CSV archives without copying any
provider row into the repository. It found:

- 5,431 of 5,432 FNDDS foods contain energy and all six nutrient values the
  application supports;
- 430,240 distinct live, checksum-valid Branded GTINs remain after excluding
  discontinued rows and selecting the latest publication;
- 97.05% of those selected Branded records contain energy, protein,
  carbohydrate, and fat, and 80.95% contain all seven application fields;
- 99.75% of selected Branded records are labelled as U.S. market records and
  0.25% as New Zealand; and
- no independent, representative sample of ordinary-food queries, branded-name
  queries, or retail barcodes was available, while the application itself names
  no initial market.

The internal completeness thresholds passed. The discovery thresholds could not
be measured. Counting records from FoodData Central against FoodData Central
would answer field population, not the probability that a person's attempted
food exists, and was prohibited by the protocol fixed before evaluation.

## Decision

Choose **Outcome C: evidence is insufficient**. FoodData Central is not approved
as the application's sole food-data provider, and no production integration or
implementation specification follows from this sprint.

FoodData Central remains a credible candidate. The measured release shows that
its data are structurally capable of supporting the application's energy and
macronutrient fields when a matching record exists. That is a narrower statement
than coverage adequacy and must not be presented as provider approval.

The next coverage study must first name the initial market and obtain an
independent, dated frame of consumption, retail purchase, or retail assortment.
It must apply the already-fixed thresholds and use at least 385 observations per
claimed population or market stratum. A better representative sample could
change this decision; the thresholds may not be changed in response to its
results.

Qualified review of Open Food Facts's ODbL/DbCL bundling implications remains
ADR 0035's alternative unblocker. This evaluation does not make it the only
credible path, because a representative FoodData Central evaluation is still
possible in principle. It also does not justify a multi-source architecture:
there is no approved first source, no approved second source, and no measured
gap a source-assignment policy could truthfully allocate yet.

`NutritionProvenance` remains unchanged. Before any provider can be implemented,
a separately reviewed domain change must distinguish provider-sourced facts from
a person's own `'provided'` facts, and every import or refresh path must preserve
person-created catalog items and diary snapshots without silent overwrite.

## Consequences

- Phase 5 stays **Current**, with only its macro-target half implemented.
- Phase 6 stays blocked on Phase 5 reaching sufficient depth.
- FoodData Central's CC0 terms and downloadable form make offline redistribution
  possible, but the measured 3.09 GB raw Branded contents require a scoped
  transformation, update, integrity, rollback, and deletion design if adoption
  is later approved.
- The Branded bulk release's twice-yearly cadence trails monthly API updates.
  Any offline design must state the accepted freshness lag rather than silently
  presenting old provider facts as current.
- Same-date latest records exist for 4,976 distinct GTINs. A future
  transformation needs an approved identity/reconciliation rule; the evaluator's
  FDC-ID tie-breaker is deterministic analysis bookkeeping, not product policy.
- The official market evidence supports only United States and New Zealand
  claims. No global or unnamed launch-market claim is permitted.
- No provider data, barcode, archive, credential, runtime dependency, schema,
  production code, or implementation specification is added.

## Alternatives considered

**Approve FoodData Central because internal nutrition completeness passed.**
Rejected. Completeness is conditional on a record being present and cannot
establish how often an attempted food or barcode is found.

**Treat 430,240 distinct valid GTINs as proof of broad coverage.** Rejected. A
large numerator without an independent market denominator is not a hit rate, and
the measured records are almost entirely U.S.-labelled.

**Use a hand-picked, household, search-result, or crowd-contributed sample and
label it representative.** Rejected. Such samples may find defects but cannot
support the roadmap's adoption claim without a defensible selection probability
and geographic frame.

**Approve FoodData Central only for ordinary foods and adopt a second source for
barcodes.** Rejected for now. FNDDS's internal completeness is strong, but
ordinary-food ranked discovery was not measured, and a multi-source design would
prematurely introduce provenance, conflict, update, and licensing policy for two
unapproved sources.

**Lower "most of the time" to a bare majority.** Rejected before evaluation.
The protocol fixes four-in-five branded/barcode discovery as the minimum useful
experience and requires confidence-bound support; changing it after evidence is
known would manufacture progress rather than measure it.
