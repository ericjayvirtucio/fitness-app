# ADR 0039: Open Food Facts licensing review packet and unresolved provider status

**Status:** Accepted

**Extends:** [ADR 0035](0035-nutrition-provenance-and-unapproved-food-data-sourcing.md),
which identified Open Food Facts (ODbL 1.0 / DbCL 1.0) as requiring qualified
legal review to determine whether bundling a filtered subset inside a mobile
application triggers database share-alike obligations, and [ADR
0038](0038-fooddata-central-coverage-evaluation-fails.md), which confirmed
FoodData Central failed its independent discovery evaluation and left Open Food
Facts as the sole remaining named path to unblock Phase 5's food-database
capability.

---

## Context

Phase 5 (Nutrition Depth) requires both goal-derived macronutrient targets
(shipped in Sprint 49 as [Specification
0047](../../specs/0047-goal-derived-macro-targets.md)) and an offline-first food
database behind the catalog. Sprint 52 executed the independent FoodData
Central coverage evaluation ([ADR
0038](0038-fooddata-central-coverage-evaluation-fails.md), [coverage
evaluation](../fooddata-central-coverage-evaluation.md)), where FoodData Central
failed its branded-name (31.43%) and exact-barcode (55.58%) discovery gates
against pre-fixed thresholds. FoodData Central is not approved.

Open Food Facts is the sole remaining candidate named in the repository roadmap.
Its dataset provides the requisite barcode density and product metadata for the
United States launch market ([ADR
0037](0037-initial-nutrition-market-and-independent-sampling-frame.md)), but its
database structure is licensed under the **Open Database License (ODbL) 1.0**,
its contents under the **Database Contents License (DbCL) 1.0**, and its product
images under **Creative Commons Attribution-ShareAlike (CC BY-SA)**.

Under `AGENTS.md` and ADR 0035, an automated assistant must not invent or
substitute its own legal interpretation for qualified legal advice. To enable a
conclusive determination without guessing, Sprint 53 was tasked with producing an
exhaustive, counsel-ready technical review packet and recording the resulting
licensing boundary.

---

## Decision

**Choose Outcome C: Qualified evidence remains unavailable or incomplete.**

1. **No External Qualified Legal Opinion Yet Supplied**: As of Sprint 53, no
   formal opinion from qualified legal counsel authorized by the repository
   owner has been delivered. Therefore, Outcome A (approval of a production
   pattern) cannot be selected without violating the repository's core
   principle of evidence over assumptions.
2. **Counsel-Ready Review Packet Established**: The complete technical review
   packet has been authored and committed to
   [`docs/open-food-facts-licensing-review-packet.md`](../open-food-facts-licensing-review-packet.md).
   It defines the exact build-time extraction pipeline, physical SQLite storage
   isolation, user-owned snapshot model, complete exclusion of CC BY-SA
   images, and comprehensive analysis of 15 concrete distribution questions
   under ODbL 1.0 and DbCL 1.0.
3. **Open Food Facts Remains Unapproved**: No Open Food Facts data, provider
   code, barcode scanner, schema migration, network client, or runtime
   dependency is approved or introduced.
4. **Operative Licensing Boundary Recorded**:
   - **Permitted Use**: Build-time evaluation and benchmark testing using dated
     snapshots (as executed in Sprints 51 and 52) without committing raw data to
     Git remains permitted analytical use under ODbL 1.0 / DbCL 1.0.
   - **Prohibited Use**: Distributing, bundling, downloading, caching, or
     querying Open Food Facts records in production remains prohibited until
     qualified counsel reviews the packet and confirms acceptable terms.
   - **Mandatory Exclusions**: Product images are permanently excluded from all
     consideration due to separate CC BY-SA licensing, trademark risks, and
     extreme storage overhead.

---

## Consequences

- Phase 5 remains **Current** (macro targets complete, food database unmet).
- Phase 6 (Energy Balance) remains **blocked** on Phase 5 completion.
- No provider integration, schema change, barcode scanner, network client, or
  runtime dependency enters the repository.
- The repository owner is equipped with an actionable, structured review packet
  ([`docs/open-food-facts-licensing-review-packet.md`](../open-food-facts-licensing-review-packet.md))
  to present to external legal counsel.
- The next step for the food-database capability is external legal review of
  the review packet. Upon receipt of counsel's opinion, a future sprint will
  record Outcome A or Outcome B in a subsequent ADR before architecture design
  or implementation begins.

---

## Alternatives Considered

- **Select Outcome A based on internal interpretation of ODbL Produced Work / Collective Database clauses.**
  _Rejected_: Violates the Engineering Constitution (`AGENTS.md`) and ADR 0035.
  An automated assistant cannot provide legal advice or bind the repository owner
  to licensing liabilities.
- **Select Outcome B and abandon Open Food Facts entirely without counsel input.**
  _Rejected_: Premature and unsupported. ODbL 1.0 explicitly distinguishes
  between a database and software using that database (Produced Work). If
  counsel confirms that physical database separation and public source offering
  satisfy ODbL §4.4 without affecting proprietary application code, Open Food
  Facts provides a viable, high-quality offline food catalog.
- **Adopt a live-query-only pattern to bypass database bundling.**
  _Rejected_: Violates the core **offline-first** product principle (`PRODUCT.md`)
  and does not eliminate database licensing questions regarding client-side
  caching.
