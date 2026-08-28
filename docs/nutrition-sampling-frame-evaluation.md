# Nutrition market and sampling frame evaluation

- Authoritative decisions: [ADR 0035](decisions/0035-nutrition-provenance-and-unapproved-food-data-sourcing.md), [ADR 0036](decisions/0036-fooddata-central-coverage-remains-unproven.md), [ADR 0037](decisions/0037-initial-nutrition-market-and-independent-sampling-frame.md)
- Evaluation date: 2026-08-27
- Outcome: A — Initial market approved (United States) and independent sampling frames approved (NHANES WWEIA for ordinary foods; Open Food Facts US snapshot for unweighted retail assortment)

---

## 1. Executive summary

Phase 5 (Nutrition Depth) requires that logging a food item finds it in a real database "most of the time." [ADR 0036](decisions/0036-fooddata-central-coverage-remains-unproven.md) established that internal dataset completeness alone cannot prove external coverage, and recorded Outcome C (evidence is insufficient) because:

1. The application had not formally approved an initial geographic nutrition launch market;
2. The evaluation had no independent, representative sampling frame to measure real-world discovery.

This document defines the market-selection rubric, evaluates candidate geographic markets, establishes the **United States (US)** as the approved initial nutrition launch market, and evaluates candidate sampling frames across ordinary-food search, branded-name search, and exact-barcode lookup.

Following this evaluation, **Outcome A** is approved:

- The **United States (US)** is the approved initial nutrition market;
- **CDC/USDA NHANES What We Eat in America (WWEIA)** food frequency data is the approved independent frame for ordinary foods;
- An **Open Food Facts (OFF) United States dated snapshot** is the approved independent frame for branded-food names and exact retail barcodes, explicitly characterized as an **unweighted retail assortment frame**;
- The Sprint 50 acceptance thresholds and match criteria remain fixed and unchanged.

FoodData Central remains **unapproved** until the external evaluation against these approved frames is executed and passes every predefined threshold.

---

## 2. Market-selection framework

To avoid selecting a market merely because a specific provider's data is concentrated there, candidates were evaluated across thirteen explicit product and architecture criteria:

1. **Intended users and product positioning:** Alignment with the product's focus on privacy-conscious, offline-first personal tracking of calories, macronutrients, fiber, sugars, and sodium.
2. **Language and localization requirements:** Translation, string length, and internationalization overhead.
3. **Supported measurements and labeling conventions:** Compatibility with the application's pure domain units (energy in kcal, mass in whole/decimal grams, sodium in milligrams).
4. **Ordinary-food vocabulary:** Consistency of common ingredient and staple names with user expectations.
5. **Branded-product and private-label ecosystem:** Structure of national brand manufacturers and supermarket private labels.
6. **Barcode standards and retail channels:** Alignment with GTIN standards (UPC-A, EAN-13, GTIN-8, GTIN-14) used in primary grocery retail.
7. **FoodData Central's documented geographic coverage:** Documented provider presence without treating provider bias as the sole selection factor.
8. **Availability of independent sampling data:** Access to independent, reproducible, and verifiable consumption surveys or retail assortment frames.
9. **Privacy and regulatory compliance:** Compatibility with the offline-first, zero-telemetry architecture under regional privacy laws (CCPA, GDPR, etc.).
10. **Distribution and operational support:** App store distribution requirements and operational surface area.
11. **Accessibility and inclusive language:** Plain-language readability and assistive technology labeling in English.
12. **Honest service capability:** Ability of the application's current domain model to serve the market truthfully without confusing conversions.
13. **Cost and legal feasibility:** Ability to evaluate and serve the market without commercial licensing barriers or copyleft contamination.

---

## 3. Geographic market evaluation

### 3.1 Market options considered

| Market                              | Primary Language                     | Barcode Standard                 | Mandatory Nutrition Label Units                                                                 |                 Non-domain build cost (corrected)                  | FoodData Central Branded Records | Independent Consumption / Assortment Data    |
| :---------------------------------- | :----------------------------------- | :------------------------------- | :---------------------------------------------------------------------------------------------- | :----------------------------------------------------------------: | :------------------------------: | :------------------------------------------- |
| **United States (US)**              | English (`en-US`)                    | UPC-A (GTIN-12), GTIN-8, GTIN-14 | Calories (kcal), Protein (g), Total Carb (g), Fat (g), Fiber (g), Total Sugars (g), Sodium (mg) |            No i18n needed (content already US English)             |         429,150 (99.75%)         | CDC/USDA NHANES WWEIA (Public domain)        |
| **United Kingdom (UK)**             | English (`en-GB`)                    | EAN-13                           | Energy in kJ + kcal, declared strictly **per 100g/ml**, **Salt (g)** instead of Sodium (mg)     | No domain rework; needs a salt-vs-sodium field and UI display work |            0 (0.00%)             | UK NDNS, McCance & Widdowson's CoFID         |
| **Canada (CA)**                     | English (`en-CA`) & French (`fr-CA`) | UPC-A, EAN-13                    | Calories (kcal), Protein (g), Carb (g), Fat (g), Fiber (g), Sugars (g), Sodium (mg) — bilingual |        No domain rework; needs bilingual UI infrastructure         |            0 (0.00%)             | Health Canada CCHS Nutrition, CNF            |
| **Australia / New Zealand (AU/NZ)** | English (`en-AU`/`en-NZ`)            | EAN-13                           | Energy in **kJ** (mandatory), declared **per 100g/ml** and per serving, Sodium (mg)             |     No domain rework (kJ already the canonical `Energy` unit)      |      1,090 NZ (0.25%), 0 AU      | AUSNUT 2011–13, AFCD                         |
| **European Union (EU)**             | Multilingual (DE, FR, ES, IT, etc.)  | EAN-13                           | Energy in kJ + kcal, declared **per 100g/ml**, **Salt (g)** instead of Sodium (mg)              | No domain rework; needs multilingual UI and a salt-vs-sodium field |            0 (0.00%)             | EFSA Comprehensive Food Consumption Database |
| **Philippines (PH)**                | Filipino / English (`en-PH`)         | EAN-13 (prefix 480), UPC-A       | Calories (kcal), Protein (g), Carb (g), Fat (g), Sodium (mg)                                    |     No domain rework; needs Filipino/English UI infrastructure     |            0 (0.00%)             | FNRI Food Composition Tables                 |
| **Global / Multi-Market**           | All                                  | All (UPC/EAN)                    | Incompatible conflicting statutory formats                                                      |  No single representative frame; inconsistent per-market UI needs  |              Mixed               | No single representative global frame exists |

**Correction:** an earlier draft of this table used a "Domain Model Fit" column marking the UK, EU, and AU/NZ as domain-level "Mismatch" for requiring kilojoules, salt-in-grams, or a per-100g declaration basis. That was inaccurate: `Energy` (`packages/domain/src/nutrition/energy.ts`) already stores kilojoules as its canonical unit, `Mass` (`packages/domain/src/shared/measurement/mass.ts`) already converts mg/g freely, and `NutritionReference` already represents an arbitrary mass/volume declaration basis — none of these markets requires a domain change on that basis. The column above states the real, narrower build cost instead: UI/localization work and, for salt-declaring markets, a generic salt-or-sodium field — not a domain rework. This does not change the market decision below, but it changes why the US was chosen.

---

### 3.2 Detailed market analysis and decision rationale

#### 1. United States (US) — Recommended and Approved

- **Nomenclature match, not domain requirement:** The pure domain model in `packages/domain/src/nutrition/nutrition-facts.ts` defines nutrients as `energy`, `protein` (g), `carbohydrate` (g), `fat` (g), `fiber` (g), `sugars` (g), and `sodium` (mg), and `Energy` (`packages/domain/src/nutrition/energy.ts`) stores kilojoules canonically with kilocalorie as a supported display unit. These field names happen to correspond to the United States FDA Nutrition Facts label (21 CFR 101.9), but the underlying `Energy` and `Mass` types already support the units other markets require — this is a naming correspondence, not a structural constraint that rules out other markets. See the correction note in section 3.1.
- **Measurement units:** US packaging displays sodium directly in milligrams (`mg`), matching the application's field name. `Mass` converts mg/g freely regardless of market, so this is a convenience, not a technical requirement.
- **Language:** The application's interface, error text, and design-system typography are currently written in American English, matching US grocery terminology (e.g., "ground beef", "bell pepper", "zucchini"). No locale/i18n infrastructure exists for any market, so this reflects what has been built so far, not a constraint that favors the US over another English-speaking market.
- **Barcode infrastructure:** The US retail supply chain is dominated by 12-digit Universal Product Codes (UPC-A / GTIN-12). No GTIN parser or check-digit validator exists anywhere in production code; the only such logic is `scripts/sample-nutrition-frame.py`, added in this sprint for evaluation purposes, and it validates GTIN-8/12/13/14 generically rather than being US-specific.
- **Independent data availability:** The US federal government provides the world's most rigorous, unencumbered, public-domain dietary recall survey: the CDC/USDA NHANES What We Eat in America (WWEIA) dataset. This is the actual, load-bearing reason the US was selected: a qualifying independent frame is known to exist and be accessible, which was not separately confirmed for the other candidate markets in this sprint's discovery pass.

#### 2. United Kingdom (UK) and European Union (EU) — Excluded from Initial Launch

- **Statutory declaration convention, not a domain blocker:** Under UK and EU FIC Regulation No 1169/2011, nutrition panels are legally required to declare energy in kilojoules (`kJ`) alongside kilocalories (`kcal`), declare values strictly **per 100g or per 100ml** (with serving sizes optional), and declare **salt in grams** (`salt = sodium × 2.5`) rather than elemental sodium in milligrams. `Energy` already stores kilojoules canonically, `Mass` already converts mg/g freely, and `NutritionReference` already represents an arbitrary mass/volume declaration basis, so none of this requires a domain change.
- **Actual gap:** `NutrientAmounts.sodiumMilligrams` names sodium specifically; serving a salt-declaring market honestly needs a generic salt-or-sodium field and display-layer conversion, not a new domain concept.
- **Localization:** EU markets require multi-language translation (French, German, Spanish, etc.) that does not exist yet in the application, which remains a real reason to exclude the EU from this sprint's launch-market decision.

#### 3. Canada (CA) — Excluded from Initial Launch

- **Bilingual labeling mandate:** Health Canada regulations require bilingual English and French food packaging and labeling. The application has no i18n infrastructure and is currently single-language, which is a real reason to exclude Canada from this sprint's decision.
- **Provider coverage:** Zero Canadian records exist in FoodData Central Branded bulk releases, though this describes FoodData Central specifically and was not treated as disqualifying on its own — an independently sourced Canadian frame was simply not evaluated in this sprint's discovery pass.

#### 4. Australia / New Zealand (AU/NZ) — Excluded from Initial Launch

- **Energy unit mandate — not a domain blocker:** Food Standards Australia New Zealand (FSANZ) mandates kilojoules (`kJ`) as the primary energy metric, which `Energy` already stores as its canonical unit.
- **Actual reason for exclusion:** an independently sourced, representative AU/NZ consumption-survey sampling frame was not evaluated in this sprint's discovery pass, and FoodData Central's own AU/NZ coverage is negligible (0 AU, 1,090 NZ records / 0.25%), which limits how useful that provider specifically would be for this market even if it were otherwise approved.

#### 5. Global / Multi-Market — Excluded from Initial Launch

- **Geographic honesty:** Claiming global coverage when provider data and barcode formats vary dramatically across jurisdictions violates the repository's core principle of evidence over assumptions. A launch market must be concrete, bounded, and measurable.

**Market Decision:** The **United States (US)** is approved as the initial nutrition-data launch market.

---

## 4. Independent sampling frame discovery

To measure real-world discovery without circularity, candidate sampling frames were evaluated for three distinct strata:

1. Ordinary-food search (generic staples and whole foods);
2. Branded-product name search;
3. Exact retail barcode lookup (UPC-A, EAN-13, GTIN-8, GTIN-14).

### 4.1 Evaluation of candidate sampling frames

Each frame was evaluated against the eighteen required attributes specified in Sprint 51:

```
+-------------------------------------------------------------------------------------------------------------------------+
| Candidate Frame 1: CDC / USDA NHANES What We Eat in America (WWEIA) Dietary Recall Frequency (Approved: Ordinary Foods) |
+-------------------------------------------------------------------------------------------------------------------------+
1.  Publisher / Owner:              CDC National Center for Health Statistics (NCHS) & USDA Agricultural Research Service
2.  URL / Procurement Channel:       https://www.ars.usda.gov/nea/bhnrc/fsrg/wweia/ and https://wwwn.cdc.gov/nchs/nhanes/
3.  Observation Period:             2017–March 2020 (Pre-pandemic) & 2021–2023 Survey Cycles
4.  Geographic Coverage:            United States (Nationally representative)
5.  Population Represented:         Civilian non-institutionalized US population (all age groups)
6.  Sampling / Collection Method:   Multistage probability cluster sampling; 24-hr recalls via Automated Multiple-Pass Method
7.  Category Coverage:              171 mutually exclusive WWEIA food categories covering all dietary intakes
8.  Product Names & Barcodes:       Standardized common food concept descriptions with consumption frequency counts. No barcodes.
9.  Update Cadence:                 Biennial (every 2 years)
10. Deduplication Behavior:         Standardized 8-digit USDA Food Codes with unique descriptions
11. Known Selection Bias:           Self-reported recall; weighted by population consumption frequency
12. Licensing & Evaluation Use:     Public Domain / US Federal Government Work (Free for evaluation and reproduction)
13. Aggregate Results Publication:  Fully permitted without restriction
14. Temporary Storage:              Permitted in local scratch workspace
15. Raw Records in Git:             Excluded (not committed)
16. Cost & Contractual Burden:      $0; no contract; no private credentials; no procurement
17. Reproducibility:                100% reproducible via public federal data files and fixed random seed
18. Sample Size Capacity:           Supports >= 385 observations (drawn from >5,000 unique food codes across 171 categories)
```

```
+-------------------------------------------------------------------------------------------------------------------------+
| Candidate Frame 2: Open Food Facts (OFF) US Dated Snapshot (Approved: Branded Names & Exact Barcodes)                  |
+-------------------------------------------------------------------------------------------------------------------------+
1.  Publisher / Owner:              Open Food Facts (non-profit international association)
2.  URL / Procurement Channel:       https://data.openfoodfacts.org/ (Official daily/monthly bulk JSONL/CSV exports)
3.  Observation Period:             Dated snapshot (August 2026 release)
4.  Geographic Coverage:            United States (`countries_tags: en:united-states`)
5.  Population Represented:         Packaged food and beverage products sold in US retail channels
6.  Sampling / Collection Method:   Crowdsourced product scans and manufacturer open-data contributions
7.  Category Coverage:              Comprehensive packaged grocery categories (dairy, snacks, beverages, cereals, bakery, etc.)
8.  Product Names & Barcodes:       Brand names, product titles, variants, package sizes, and canonical GTIN barcodes
9.  Update Cadence:                 Continuous / Daily snapshots / Monthly archives
10. Deduplication Behavior:         Deduplicated by canonical GTIN-14; check-digit validation
11. Known Selection Bias:           Unweighted crowdsourced retail assortment; overrepresents popular/specialty packaged items
12. Licensing & Evaluation Use:     ODbL 1.0 (database) / DbCL 1.0 (contents); analytical evaluation use permitted
13. Aggregate Results Publication:  Fully permitted (publishing aggregate statistical discovery rates distributes no derived DB)
14. Temporary Storage:              Permitted in local scratch workspace outside Git
15. Raw Records in Git:             Excluded (only aggregate statistics, CI bounds, and sampling script committed)
16. Cost & Contractual Burden:      $0; no contract; no API key required for bulk open export
17. Reproducibility:                100% reproducible by fixing snapshot URL, archive SHA-256 digest, and random sampling seed
18. Sample Size Capacity:           Supports >= 385 observations (drawn from >150,000 live valid US GTIN records)
```

```
+-------------------------------------------------------------------------------------------------------------------------+
| Candidate Frame 3: USDA ERS National Household Food Acquisition and Purchase Survey (FoodAPS-1) (Disqualified)          |
+-------------------------------------------------------------------------------------------------------------------------+
1.  Publisher / Owner:              USDA Economic Research Service (ERS) & Food and Nutrition Service (FNS)
2.  URL / Procurement Channel:       https://www.ers.usda.gov/data-products/foodaps/
3.  Observation Period:             April 2012 – January 2013 (13+ years old)
4.  Reason for Disqualification:    Fails currency requirement. Retail packaged foods undergo rapid reformulation, brand
                                    repositioning, and barcode reassignment. A 2012–2013 sample cannot represent the 2026 market.
```

```
+-------------------------------------------------------------------------------------------------------------------------+
| Candidate Frame 4: NielsenIQ / Circana Consumer Purchase Panel via Kilts Center (Disqualified)                         |
+-------------------------------------------------------------------------------------------------------------------------+
1.  Publisher / Owner:              NielsenIQ / Circana & University of Chicago Booth School of Business
2.  URL / Procurement Channel:       https://www.chicagobooth.edu/research/kilts/datasets/nielsenIQ-nielsen
3.  Reason for Disqualification:    Fails open accessibility and public auditability requirements. Access is restricted to
                                    academic tenure-track faculty and PhD students under strict non-disclosure agreements.
                                    Terms prohibit public publication of item-level queries or reproducible open-source audits.
```

```
+-------------------------------------------------------------------------------------------------------------------------+
| Candidate Frame 5: Commercial Retailer Developer APIs (Kroger / Walmart / Target) (Disqualified)                        |
+-------------------------------------------------------------------------------------------------------------------------+
1.  Publisher / Owner:              Individual retail corporations
2.  Reason for Disqualification:    Fails legal stability and open reproducibility. Commercial developer terms strictly prohibit
                                    bulk automated scraping, caching, and use for external benchmarking.
```

---

### 4.2 Comparison matrix of candidate frames

| Evaluation Dimension         | NHANES WWEIA Frequency  | Open Food Facts US Snapshot |   USDA FoodAPS-1   | NielsenIQ Kilts Panel |    Retailer APIs    |
| :--------------------------- | :---------------------: | :-------------------------: | :----------------: | :-------------------: | :-----------------: |
| **Independence from FDC**    | Yes (intake frequency)  |             Yes             | Partial (ERS/USDA) |          Yes          |         Yes         |
| **Observation Currency**     |   Current (2017–2023)   |       Current (2026)        | Stale (2012–2013)  |        Current        |       Current       |
| **Geographic Match (US)**    |    Yes (Nationwide)     |  Yes (`en:united-states`)   |        Yes         |          Yes          |         Yes         |
| **Barcode Coverage**         |     No (Names only)     |    Yes (GTIN-8/12/13/14)    |        Yes         |          Yes          |         Yes         |
| **Sample Size (>= 385)**     |   Yes (>5,000 foods)    |    Yes (>150,000 GTINs)     |        Yes         |          Yes          |         Yes         |
| **Legal / Licensing Safety** |      Public Domain      |     ODbL evaluation use     |   Public Domain    |      Strict NDA       |  Restricted Terms   |
| **Open Reproducibility**     |   High (Public files)   |  High (Dated dump + seed)   |        High        | Zero (Closed enclave) | Low (Key-dependent) |
| **Cost**                     |           $0            |             $0              |         $0         | High / Academic only  |   $0 with limits    |
| **Status**                   | **Approved (Ordinary)** |  **Approved (Assortment)**  |  **Disqualified**  |   **Disqualified**    |  **Disqualified**   |

---

## 5. Rights, privacy, and data handling

### 5.1 Open Food Facts analytical evaluation licensing

[ADR 0035](decisions/0035-nutrition-provenance-and-unapproved-food-data-sourcing.md) identified that bundling a filtered subset of Open Food Facts inside a distributed mobile application creates an unresolved ODbL 1.0 share-alike question.

Using an Open Food Facts snapshot **strictly as an external query and evaluation benchmark frame** differs fundamentally from bundling data in production:

- The evaluation script processes the external snapshot in an offline environment outside the application.
- It extracts search queries and barcode numbers solely to test whether FoodData Central's database contains matching entries.
- The repository commits only aggregate statistical findings (percentages, confidence intervals, sample counts) and standard-library evaluation code.
- **No row-level Open Food Facts records, descriptions, or database contents are committed to Git or distributed with the mobile application.**
- Under ODbL 1.0 Section 4.3 and DbCL 1.0, conducting an analytical evaluation and publishing non-substantial aggregate statistical summaries does not constitute distributing a Derived Database and incurs no share-alike obligation on the fitness application source code.

### 5.2 Privacy and data protection

- **Zero personal data:** Sampling uses only published national survey frequencies and public product packaging barcodes. No personal nutrition history, user logs, photos, telemetry, or device identifiers are collected or used.
- **Clean repository history:** All raw provider archives, intermediate CSV/JSONL dumps, and extracted sample files reside in a local scratch directory outside the Git repository.

---

## 6. Sampling, stratification, and deduplication protocol

### 6.1 Sample size and statistical power

To ensure statistical rigor, each evaluated population must satisfy the sample size requirement fixed in Sprint 50:

- Minimum **$N = 385$** independently sampled items per stratum.
- For an observed proportion $p = 0.50$, $N = 385$ yields a 95% confidence interval margin of error of approximately $\pm 5.0\%$.
- Confidence intervals are computed using the **Wilson score interval** without continuity correction:

$$\hat{p} \pm \frac{z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}} \quad \text{where } z = 1.95996$$

### 6.2 Stratum 1: Ordinary foods (Generic staples)

- **Source:** CDC/USDA NHANES WWEIA food frequency distribution.
- **Sampling method:** Stratified probability sampling across major food categories, weighted by reporting frequency in 24-hour dietary recalls.
- **Sample target:** 385 distinct generic food concepts.
- **Normalization:** Common American English terminology; standard singular/plural normalization; documented preparation qualifiers (e.g., "raw", "cooked", "whole").

### 6.3 Stratum 2: Branded-product names

- **Source:** Open Food Facts US snapshot (`countries_tags: en:united-states`).
- **Sampling method:** Stratified random sampling across 8 major retail categories:
  1. Dairy & Plant-Based Alternatives
  2. Cereals, Grains & Bakery
  3. Snacks, Sweets & Confectionery
  4. Beverages (Non-Alcoholic)
  5. Packaged Meats, Poultry & Seafood
  6. Prepared & Frozen Meals
  7. Condiments, Sauces & Dressings
  8. Canned & Preserved Foods
- **Sample target:** 385 distinct branded product queries (Brand + Product Name + Variant/Size).
- **Labeling requirement:** Results must be explicitly labelled **"Unweighted Retail Assortment Coverage"**, not "Consumer Purchase Coverage".

### 6.4 Stratum 3: Exact retail barcodes

- **Source:** Open Food Facts US snapshot (`countries_tags: en:united-states`).
- **Validation rules:**
  - Length must be 8, 12, 13, or 14 numeric digits.
  - GTIN check digit must be mathematically valid.
  - Normalized to canonical GTIN-14 with leading zeroes preserved for exact matching.
  - Discontinued or non-food items (e.g., cosmetics, pet food) excluded.
- **Sample target:** 385 distinct canonical GTINs distributed across the 8 retail categories.

---

## 7. Next action and execution plan (Outcome A)

### 7.1 Decision: Outcome A — Market and frame approved

All prerequisites for measuring external discovery are now satisfied:

- Initial launch market approved: **United States (US)**.
- Independent ordinary-food frame approved: **NHANES WWEIA Frequency**.
- Independent branded and barcode frame approved: **Open Food Facts US Assortment Snapshot**.
- Legal and privacy boundaries verified.

### 7.2 Retained evaluation thresholds (Sprint 50)

The thresholds fixed in Sprint 50 are retained without modification:

| Metric                                      | Minimum Threshold | 95% CI Lower Bound Requirement |
| :------------------------------------------ | :---------------: | :----------------------------: |
| **Ordinary-food top-5 discovery**           |    $\ge 90\%$     |            $> 85\%$            |
| **Branded-name top-5 discovery**            |    $\ge 80\%$     |            $> 75\%$            |
| **Exact-barcode lookup discovery**          |    $\ge 80\%$     |            $> 75\%$            |
| **Nutrition-usable rate (energy + macros)** |    $\ge 95\%$     |               —                |
| **Nutrition-complete rate (all 7 fields)**  |    $\ge 80\%$     |               —                |
| **Ambiguity / False-positive rate**         |     $\le 5\%$     |               —                |

### 7.3 Step-by-step execution roadmap for the next sprint

1. **Acquire snapshots:** Download the dated Open Food Facts US export and NHANES WWEIA frequency table into an external scratch directory.
2. **Execute sampling script:** Run `scripts/sample-nutrition-frame.py` with a fixed seed (`20260827`) to extract 385 ordinary queries, 385 branded name queries, and 385 valid GTINs.
3. **Execute coverage measurement:** Query the sampled items against FoodData Central's April 2026 bulk datasets (Foundation, FNDDS, and Branded).
4. **Compute statistics:** Calculate point estimates, Wilson 95% confidence intervals, and nutrient completeness rates.
5. **Report findings:** Publish aggregate results in an update to `docs/fooddata-central-coverage-evaluation.md`.
6. **Provider decision:** Approve FoodData Central if and only if all thresholds pass; otherwise, document the measured shortfall and pursue the alternative Open Food Facts legal unblocking path.
