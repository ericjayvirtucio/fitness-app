# ADR 0037: United States initial nutrition market and independent sampling frame selection

**Status:** Accepted

**Extends:** [ADR 0035](0035-nutrition-provenance-and-unapproved-food-data-sourcing.md) and [ADR 0036](0036-fooddata-central-coverage-remains-unproven.md), which established that FoodData Central adoption requires naming an initial launch market, evaluating coverage against an independent representative sample, and achieving pre-fixed discovery thresholds.

## Context

Sprint 50 evaluated USDA FoodData Central's April 2026 bulk release and found promising internal completeness (97.05% energy/macro completeness across 430,240 distinct live GTINs, and 99.98% completeness in FNDDS 2021–2023). However, [ADR 0036](0036-fooddata-central-coverage-remains-unproven.md) recorded Outcome C (evidence is insufficient) and withheld provider approval because two critical prerequisites were missing:

1. The application had not formally approved an initial geographic nutrition launch market;
2. The evaluation lacked an independent, dated sampling frame to measure real-world discovery of ordinary foods, branded product names, and exact retail barcodes.

Without an approved market, barcode validity cannot be judged against actual retail standards, and without an independent frame, measuring database rows against themselves only tests internal population rather than whether an attempted food is found.

Sprint 51 was tasked with defining the initial nutrition launch market and evaluating candidate independent sampling frames across ordinary-food search, branded-name search, and exact-barcode lookup.

## Decision

1. **Approve the United States (US) as the initial nutrition-data launch market.**
   The United States is chosen based on strict alignment with the application's domain foundation, measurement conventions, language, and regulatory standards:
   - **Nutrient model alignment:** The pure domain model (`packages/domain/src/nutrition/nutrition-facts.ts`) tracks energy in kcal, macronutrients/fiber/sugars in whole or decimal grams, and sodium in whole milligrams (`mg`). This exact vocabulary matches the mandatory United States FDA Nutrition Facts labeling regulations (21 CFR 101.9). Alternative markets (e.g., UK and EU under FIC Regulation 1169/2011) mandate energy in kilojoules (`kJ`), declaration strictly per 100g/100ml rather than serving size, and salt in grams (`g`) rather than elemental sodium (`mg`), which would require substantial domain alterations.
   - **Language and vocabulary:** The application shell, UI strings, accessibility labels, and documentation are authored in standard American English (`en-US`), consistent with US culinary and grocery terminology.
   - **Barcode format:** US retail grocery is standardized on Universal Product Code (UPC-A / GTIN-12), with supplementary GTIN-8, EAN-13, and GTIN-14 support, matching the application's GTIN validator and normalization rules.
   - **Privacy and architecture alignment:** The application's offline-first, device-local persistence model complies with US consumer privacy standards (CCPA/CPRA) without requiring external consent frameworks prior to cloud synchronization.
   - Geographic honesty requires that evidence gathered for the US market must never be claimed as global coverage.

2. **Approve a two-source independent sampling frame strategy:**
   - **Ordinary-food search stratum:** Approve the **CDC/USDA National Health and Nutrition Examination Survey (NHANES) What We Eat in America (WWEIA) 2017–March 2020 / 2021–2023 Dietary Recall Food Frequency distribution** as the independent ordinary-food frame. This provides a nationally representative probability sample of foods actually consumed by the civilian non-institutionalized US population across ~170 food categories. A stratified sample of at least 385 unique food concept queries weighted by reported intake frequency will form the ordinary-food discovery denominator.
   - **Branded-product name search and exact-barcode lookup strata:** Approve the **Open Food Facts (OFF) United States dated snapshot** as an **unweighted retail assortment sampling frame**. An independent extraction filtered to US-market products (`countries_tags: en:united-states`), deduplicated to canonical GTIN-14, and validated for check-digit correctness will supply at least 385 branded name queries and at least 385 exact barcodes across major retail grocery categories.
   - **Analytical evaluation use under ODbL/DbCL:** Using an Open Food Facts snapshot strictly as an external benchmark query frame to evaluate another dataset's hit rate is an analytical evaluation use permitted under ODbL 1.0 and DbCL 1.0. Because only aggregate statistical metrics (accuracy rates, confidence intervals, sample counts) and non-proprietary sampling code are published, no derived database is distributed and no copyleft obligation attaches to this repository's codebase.

3. **Choose Outcome A: Market and sampling frame approved.**
   The prerequisites for executing an external coverage evaluation are satisfied. The Sprint 50 acceptance thresholds (>=90% ordinary top-5 discovery with lower CI >85%, >=80% branded name top-5 with lower CI >75%, >=80% exact barcode with lower CI >75%, >=95% usable, >=80% complete, <=5% false-positive/ambiguous) remain fixed and unchanged.

4. **FoodData Central remains unapproved.**
   Approving the market and sampling frame establishes the evaluation methodology but does not approve the provider. FoodData Central will be approved only if the external evaluation against the approved frames is executed and passes every predefined discovery and completeness threshold.

5. **Open Food Facts legal review remains the alternative unblocking path.**
   Independent of the FoodData Central evaluation, qualified legal review regarding bundling a filtered subset inside a distributed application remains an active, valid alternative unblocker per ADR 0035.

6. **Domain constraints and provenance remain intact.**
   `NutritionProvenance` remains `'provided' | 'estimated'`. Person-created catalog items and diary snapshots remain authoritative. No provider integration, barcode scanner, schema migration, network client, or runtime dependency is added in this sprint.

## Consequences

- The application's nutrition feature direction is explicitly anchored to the United States market as its initial launch territory.
- An external evaluation against FoodData Central can now be conducted using reproducible, independent samples of at least 385 items per stratum without circular self-sampling.
- Results from the Open Food Facts frame must be explicitly reported as **unweighted retail assortment coverage**, not consumer-weighted purchase coverage.
- Raw sample records and third-party database dumps remain outside Git; only aggregate counts, confidence intervals, and standard-library scripts enter version control.
- Phase 5 remains **Current** (Track A complete, Track B unapproved); Phase 6 remains **blocked**.

## Alternatives considered

**Select a global or multi-country launch market.** Rejected. Global launch would violate the core principle of geographic honesty, conflate conflicting national labeling laws (e.g., US FDA vs EU/UK FIC vs FSANZ), and lack a unified representative sampling frame.

**Select the United Kingdom or European Union.** Rejected. UK and EU regulations mandate nutritional declarations per 100g/100ml, energy in kJ, and salt in grams rather than elemental sodium in mg. Adopting these markets would require immediate breaking changes to the core domain model and UI formatting tokens.

**Use USDA ERS FoodAPS-1 as the barcode sampling frame.** Rejected. FoodAPS-1 was fielded in 2012–2013. A 13-year-old retail sample suffers extreme product discontinuation and barcode churn, making it unfit as a current market representation.

**Use commercial purchase panels (NielsenIQ / Circana via Kilts Center) as the primary sampling frame.** Rejected. Academic panel access is legally restricted to accredited university researchers in closed data enclaves and strictly forbids publishing audit queries or public verification workflows, violating repository auditability standards.

**Treat Open Food Facts as a representative consumer purchase panel.** Rejected. Open Food Facts is crowdsourced and unweighted; treating it as a purchase panel would misstate its selection bias. It is approved strictly as an unweighted retail assortment frame.
