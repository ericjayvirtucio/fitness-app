# ADR 0035: No food-data provider is approved, and nutrition provenance is not yet ready for one

**Status:** Accepted

**Bounds:** The Engineering Constitution's rule that "AI output never
silently overrides deterministic rules or user-provided facts"
(`AGENTS.md`), extended here to a second kind of external input this
repository has not previously had to guard against: provider-supplied data.
Related precedent: [ADR
0032](0032-schema-synchronization-readiness.md) (what a person owns and what
metadata is invisible to them); Specification 0044 (the only prior example
of importing curated external data, and why its pattern cannot be reused
as-is here).

## Context

`docs/product-roadmap.md` and `PRODUCT.md` have recorded, since before this
sprint, an open question blocking Phase 5 (Nutrition Depth): how food-product
data can be obtained without inheriting a share-alike obligation on a
derived database, while keeping the application's offline-first logging
intact. `docs/third-party-material.md` already contained a substantially
complete comparison of the two obvious candidates — USDA FoodData Central
and Open Food Facts — before this sprint began. Sprint 48 was tasked with
verifying that comparison against current primary sources rather than
guessing it had gone stale, and with deciding what, if anything, is
approved as a result.

**Primary-source research confirms the comparison, and confirms the
blocker is a real, unresolved ambiguity rather than a solved problem no one
had recorded:**

- **USDA FoodData Central** is public domain (a US federal government
  work), carries no attribution requirement, no share-alike obligation, and
  no redistribution restriction of any kind. It publishes official bulk
  CSV/JSON downloads and a documented API. Its Branded Foods dataset
  includes a `gtin_upc` field intended for barcode identification, but this
  sprint's research did not verify — and no primary source consulted
  states — how complete that barcode coverage is against real-world
  packaged products a person is likely to scan. USDA's foundation/legacy
  datasets are strong for ordinary, non-branded foods.
- **Open Food Facts** licenses its database structure under ODbL 1.0 and
  its individual records under the Database Contents License (DbCL) 1.0,
  both of which carry a share-alike obligation: combining Open Food Facts
  data into another database obliges releasing that resulting database
  under the same terms. Open Food Facts has strong, crowdsourced,
  international barcode coverage — the coverage USDA's barcode data is
  unverified against. **Open Food Facts's own terms and API documentation
  do not state whether shipping a filtered, non-further-redistributable
  subset inside a distributed mobile application counts as "distributing
  the database"** in the sense that triggers the share-alike obligation on
  that bundled subset. This is not a gap in this sprint's research; it is a
  gap in the source's own published terms, confirmed by reading them
  directly rather than inferred from a summary.

Separately, this sprint's repository review found that `NutritionFacts`
(`packages/domain/src/nutrition/nutrition-facts.ts`) declares
`nutritionProvenances` as a closed, two-value union: `'provided'` (a
person typed it) and `'estimated'` (the application inferred it, a path
reserved for a future AI-estimation adapter and not yet built). Neither
value describes "a provider supplied this fact, and a person accepted or
edited it." The only prior precedent in this repository for importing
curated external data into a person-owned table — Specification 0043's
exercise pack, corrected by Specification 0044 — imports rows as ordinary,
indistinguishable content: nothing about a `PlannedExercise` or
`ExerciseDefinition` row states it came from a pack rather than being
hand-authored, and 0044's fix (reviving a tombstoned row rather than
overwriting it on re-import) exists to protect an edit, not to preserve a
visible distinction between imported and authored content. That pattern
cannot be reused verbatim for nutrition, because this sprint's own
objective requires the opposite: provider information must remain visibly
distinct from what a person entered, and must never silently overwrite it.

## Decision

**No food-data provider is approved for use in this repository as of this
ADR.** Neither USDA FoodData Central nor Open Food Facts nor any other
source is cleared to be queried, downloaded, bundled, or cached by this
application. This is a deliberate non-decision, not an oversight: the
Engineering Constitution requires a concrete, reviewed answer to
redistribution rights, share-alike implications, and coverage adequacy
before adoption, and this sprint's research shows neither candidate clears
that bar today, for different reasons.

**Two conditions each independently unblock a future sourcing decision.**
Either is sufficient on its own to reopen this question with a stronger
basis than exists today:

1. **Qualified legal review** resolving whether bundling a filtered,
   non-further-redistributable ODbL/DbCL-derived subset inside this
   application constitutes "distributing the database" under Open Food
   Facts's terms, obliging that bundled subset to be offered back under
   ODbL. This is a legal question this repository's own engineering review
   cannot answer, and this ADR does not attempt to answer it — it names the
   question precisely so legal review has something exact to review rather
   than a vague concern.
2. **A scoped technical or product evaluation** establishing whether USDA
   FoodData Central's Branded Foods dataset, on its own, gives a person
   scanning a barcode a "finds it in a real database most of the time"
   experience — Phase 5's own exit-criterion language — without Open Food
   Facts. If that evaluation succeeds, USDA alone may be sufficient for
   both the barcode and ordinary-food halves of Phase 5, with no share-alike
   question to resolve at all.

**Nutrition provenance must widen before either path can be implemented.**
Whichever source is eventually approved, `NutritionProvenance` needs at
least one new value distinguishing provider-supplied facts from a person's
own `'provided'` entry, and the write path that imports or refreshes
provider data must never overwrite a `NutritionCatalogItem` or
`ConsumptionEntry` whose facts a person supplied or edited. This is a
domain-level change with its own review, not an incidental detail of
whichever provider is chosen — recording it now means the eventual sourcing
specification starts from a stated constraint instead of discovering it
under implementation pressure.

**Macro targets are not blocked by any of the above.** Goals & Energy
(`packages/domain/src/goals-energy`) has no code-level dependency on
`NutritionFacts`, the nutrition catalog, or any food data — confirmed by
this sprint's code review. [Specification
0047](../../specs/0047-goal-derived-macro-targets.md) proceeds
independently, approved in the same sprint as this ADR, addressing exactly
the half of Phase 5's exit criterion that does not require a food-data
provider.

## Consequences

- `docs/product-roadmap.md` records Phase 5 as **Current**, not
  **Complete** and not **Planned** — work has genuinely begun (Specification
  0047 is approved), but the phase's own exit criterion has two halves and
  only one has an approved path.
- `docs/third-party-material.md`'s food-data section is updated with the
  refined, source-cited findings above, so a future sprint reopening this
  question starts from evidence already gathered rather than re-researching
  it.
- A future sprint proposing a food-data source must show that one of the
  two named conditions has actually been met — a legal opinion, or a
  completed coverage evaluation — rather than re-asserting the same
  open questions as if they were new.
- A future sprint proposing to widen `NutritionProvenance` should read this
  ADR's constraint (provider data must never silently overwrite
  person-provided facts) as a requirement on that change, not a suggestion.

## Alternatives considered

**Approve USDA FoodData Central now, accepting its unverified barcode
coverage as a risk.** Rejected: Phase 5's exit criterion is explicitly
about the barcode and ordinary-food experience "finding it... most of the
time." Building an implementation on an unverified coverage assumption
risks discovering the gap only after the architecture is committed, which
is more expensive to unwind than running the evaluation first.

**Approve Open Food Facts now, treating the bundling-scope question as a
low-risk interpretation rather than a blocker.** Rejected: this is exactly
the kind of unsupported legal conclusion this sprint was instructed to
avoid producing. The source's own FAQ does not resolve the question, and
reaching a confident answer requires legal expertise this review does not
have.

**Adopt Option C (query Open Food Facts live, with a local cache) to avoid
bundling at build time.** Rejected: a live-only barcode lookup reintroduces
exactly the offline-first cost `PRODUCT.md` already named as the reason
this question was left open rather than answered with "just query it
live." A persistent local cache of the same data plausibly re-triggers the
same share-alike scope question in a different technical shape (a cache is
also a database), so caching does not avoid the legal question — it only
relocates it.

**Defer Specification 0047 (macro targets) until a food-data provider is
approved, so Phase 5 ships as one combined capability.** Rejected: no code
or product evidence requires this coupling — Goals & Energy and the
nutrition catalog share no code today — and deferring macro targets would
leave Phase 5 with no shipped progress for an indefinite period pending a
legal or evaluation outcome this repository does not control the timeline
of.
