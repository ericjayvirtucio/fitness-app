# ADR 0038: FoodData Central fails the independent coverage evaluation

**Status:** Accepted

**Extends:** [ADR 0037](0037-initial-nutrition-market-and-independent-sampling-frame.md),
which approved the United States as the initial nutrition market and approved
NHANES WWEIA (ordinary foods) and an Open Food Facts US snapshot (branded
names and exact barcodes) as independent sampling frames, and fixed Sprint
50's acceptance thresholds unchanged. This ADR records the result of actually
executing that evaluation.

## Context

[ADR 0036](0036-fooddata-central-coverage-remains-unproven.md) withheld
approval (Outcome C) because no independent sampling frame or named launch
market existed to measure real-world discovery. ADR 0037 resolved both
prerequisites. Sprint 52 executed the remaining step: draw at least 385
independent, reproducible samples per stratum and measure FoodData Central's
April 2026 bulk release against them, under the thresholds fixed before
Sprint 50 examined any data.

The full protocol, source provenance, matching-implementation details, and
per-stratum results are recorded in the [coverage evaluation
document](../fooddata-central-coverage-evaluation.md), Sprint 52 section.
Summarized:

| Measure                         | Threshold           | Result                                     |       Status       |
| ------------------------------- | ------------------- | ------------------------------------------ | :----------------: |
| Ordinary-food discovery         | ≥90%, CI lower >85% | 98.96%, CI lower 97.36%                    |        Pass        |
| Branded-name discovery          | ≥80%, CI lower >75% | 31.43%, CI lower 26.99%                    |      **Fail**      |
| Exact-barcode discovery         | ≥80%, CI lower >75% | 55.58%, CI lower 50.59%                    |      **Fail**      |
| Nutrition-usable (all strata)   | ≥95% of matches     | 99.74% / 97.52% / 97.20%                   |        Pass        |
| Nutrition-complete (all strata) | ≥80% of matches     | 98.69% / 80.17% / 81.31%                   |        Pass        |
| Ambiguity / false-positive      | ≤5%                 | ordinary 1.04%; branded 14.03%; barcode 0% | **Fail** (branded) |

Two of the three conjunctive discovery gates fail by a wide margin. The
exact-barcode result is a clean canonical-GTIN-14 equality measurement against
FoodData Central's own already-deduplicated Branded index — no name-matching,
scoring, or ranking judgment is involved — and its 95% CI upper bound (60.47%)
does not reach the required 75% lower-bound floor. The branded-name stratum
additionally fails the ambiguity ceiling.

**A defect was found and corrected in the discovery evaluator during this
sprint, before this ADR was drafted, disclosed rather than hidden.** The
first real run's matcher (`method_version` 1) gated eligibility on a Jaccard
score ≥0.6 in addition to full token-subset containment. An independent
cross-check (looking up branded-name "no match" results by their GTIN in the
separately built, unaffected barcode index) found 102 of 277 such results
were objectively present in FoodData Central under the same GTIN — the
Jaccard floor was rejecting them because FoodData Central's `brand_owner`
field is frequently a verbose legal entity name rather than a retail brand,
inflating the Jaccard denominator despite full token containment. Full
subset containment already provides the false-positive guard the floor was
meant to add, so `method_version` 2 removed the floor as an eligibility gate,
keeping Jaccard only for ranking and ambiguity-tie detection. This raised
branded-name discovery from 20.78% to 31.43% — still far short of the 80%
threshold, and the correction did not touch the exact-barcode stratum (no
Jaccard involved) or the ordinary-food stratum (already passing). Both runs
are reported in the coverage evaluation document for auditability. This is
recorded here as a defect correction made via independent verification before
being satisfied with the result, not a retroactive loosening of the
thresholds or match definitions themselves — those remain exactly as ADR
0037 fixed them.

**The ordinary-food result carries a disclosed limitation, not a correction.**
FoodData Central's bulk release republishes the same USDA FNDDS reference
database NHANES uses to code dietary recalls, so query text drawn from the
WWEIA/FNDDS crosswalk is close to guaranteed to appear verbatim in FoodData
Central's own FNDDS records — a data-lineage relationship, not measured
real-world search quality. This was identified before running the evaluation
and the decision made then (not after seeing results) was to proceed exactly
as ADR 0037 approved, without altering the frame, and disclose the
relationship. It does not change this ADR's decision, which rests on the two
failing, non-circular strata (branded-name and exact-barcode).

## Decision

**Choose Outcome B: FoodData Central fails the coverage evaluation.**
FoodData Central is **not approved** as Phase 5's food-data provider. A
person attempting to log a packaged product by name or by scanning its
barcode — a common real-world logging path — would not find it in FoodData
Central "most of the time" under this evaluation's pre-fixed terms.

The acceptance thresholds and match definitions were not weakened, loosened,
or reinterpreted after inspecting results. The one implementation defect
found and corrected (above) was identified through independent
cross-validation against an unaffected measurement, disclosed with
before/after numbers, and did not change the stratum's own fail/pass
conclusion or the overall outcome.

FoodData Central's structural completeness (Sprint 50) and strong
ordinary-food/FNDDS performance remain genuine, useful facts about the
dataset. This ADR does not contradict them; it establishes that they do not
answer the question this evaluation was designed to answer, and that a
strong ordinary-food result — itself carrying a disclosed circularity
limitation — cannot offset two failing, conjunctive strata.

**Next unblocking path.** Per ADR 0035 and ADR 0036, qualified legal review
of Open Food Facts's ODbL 1.0 / DbCL 1.0 bundling obligations remains the
other named, still-active path to unblock Phase 5's food-database half,
independent of this result. A multi-source design is not justified by this
sprint and is not proposed here.

**Domain constraints remain intact.** `NutritionProvenance` remains
`'provided' | 'estimated'`. Person-created catalog items and diary snapshots
remain authoritative. No provider integration, barcode scanner, schema
migration, network client, or runtime dependency is added by this sprint.

**Geographic and licensing limits.** This evaluation is US-market evidence
only, per ADR 0037, and makes no claim about any other market. It measures
discovery, not licensing; ADR 0035's Open Food Facts licensing question is
unaffected by this result and remains open.

## Consequences

- Phase 5 remains **Current**: Sprint 49 met only the macro-target half; the
  food-database half remains unmet, now with a completed provider evaluation
  on record rather than insufficient evidence.
- Phase 6 remains **blocked** on Phase 5 reaching sufficient depth.
- No provider record, archive, API key, secret, barcode, or raw sample from
  NHANES, Open Food Facts, or FoodData Central enters Git history; only
  aggregate statistics, source hashes, and the evaluation scripts are
  committed.
- No production file, runtime dependency, network client, cache, scanner,
  schema, migration, export format, restore path, or erasure behavior
  changes.
- A future sprint proposing FoodData Central again must show new evidence —
  a materially different release, a corrected sampling frame, or a
  methodology change reviewed and approved before results are inspected —
  rather than re-running this evaluation unchanged and expecting a different
  outcome.
- A future sprint proposing the Open Food Facts legal-review path picks up
  directly from ADR 0035; this ADR does not re-open or re-litigate that
  question.

## Alternatives considered

**Report Outcome A because ordinary-food discovery passed comfortably.**
Rejected. The three discovery thresholds are conjunctive adoption gates
(ADR 0036); a single passing stratum — one that additionally carries a
disclosed data-lineage limitation — cannot offset two strata that fail by
wide margins on a clean, bug-free (barcode) or independently corrected
(branded-name) measurement.

**Silently loosen the branded-name matcher further, or lower the discovery
threshold, until the result passes.** Rejected outright. This is exactly the
"tune queries, matching rules, exclusions, or thresholds after observing
provider results" behavior Sprint 52's own governing rules forbid. The one
correction that was made (the Jaccard-floor removal) was identified through
independent cross-validation against an unaffected measurement, is fully
disclosed with both before/after numbers, and did not change either the
branded-name stratum's own conclusion or the overall outcome — it is
categorically different from tuning toward a desired result.

**Treat the branded-name matcher's remaining strictness as grounds for
Outcome C on that stratum.** Considered and rejected for the overall
decision: even a materially more lenient matcher would need to roughly
triple the corrected 31.43% branded-name rate to clear 80%, and the
exact-barcode stratum's clean, matcher-independent 55.58% result already
fails on its own. Evidence-insufficiency does not apply when a decisive,
unambiguous measurement already exists.

**Approve a bounded, multi-source design now (FoodData Central for ordinary
foods, a second source for branded/barcode).** Rejected for this sprint, per
ADR 0036's prior reasoning: no second source is currently approved, and
introducing a provider abstraction, provenance policy, and conflict/update
design for two unapproved sources at once would be speculative.
