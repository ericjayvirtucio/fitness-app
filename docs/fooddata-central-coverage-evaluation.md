# FoodData Central coverage evaluation

- Protocol fixed: 2026-08-26, before downloading or inspecting the evaluated
  release
- Evaluation release: USDA FoodData Central April 2026 bulk downloads
- **Current outcome: B — FoodData Central fails the coverage evaluation**
  (Sprint 52, executed 2026-08-28; see "Sprint 52: Independent sampled-coverage
  evaluation" below). Supersedes Sprint 50's Outcome C, retained further down
  as historical record.
- Decision governed by: [ADR 0035](decisions/0035-nutrition-provenance-and-unapproved-food-data-sourcing.md), [ADR 0036](decisions/0036-fooddata-central-coverage-remains-unproven.md), [ADR 0037](decisions/0037-initial-nutrition-market-and-independent-sampling-frame.md), [ADR 0038](decisions/0038-fooddata-central-coverage-evaluation-fails.md)
- Follow-up evaluation: [Sampling frame evaluation](nutrition-sampling-frame-evaluation.md) (Sprint 51)

## Question and decision rule

Phase 5 says that logging a food item must find it in a real database "most of
the time." For this evaluation, that means a person can identify an ordinary
food by a reasonable name or a packaged product by its exact barcode, receive
the intended item without accepting an ambiguous substitute, and obtain enough
nutrition information to create a useful local snapshot.

FoodData Central is adequate on its own only if every acceptance threshold below
is met by an independent sample. Dataset size and the fraction of FoodData
Central's own rows that contain a field are supporting evidence; neither proves
coverage of foods a person will actually try to log.

If a representative independent sample cannot be obtained, the result is
evidence-insufficient even when internal field population is high. Thresholds
will not be weakened after results are known.

## Populations

The evaluation keeps these populations separate:

1. **Common whole or foundation foods:** minimally processed ingredients and
   staple foods that a person would normally search by a generic name.
2. **Common branded packaged foods:** current retail products searched by brand,
   product name, variant, and package size where needed to distinguish them.
3. **Barcode-based branded products:** current retail packages with a
   independently observed GTIN, UPC-A, EAN-13, or EAN-8.
4. **Initial-market products:** products sampled from the application's approved
   launch market. Sprint 51 ([ADR 0037](decisions/0037-initial-nutrition-market-and-independent-sampling-frame.md),
   [Sampling frame evaluation](nutrition-sampling-frame-evaluation.md)) approved the
   **United States (US)** as the initial nutrition launch market.
5. **Products outside FoodData Central's strongest documented markets:** a
   separate stratum that prevents United States coverage from being described
   as global coverage.
6. **Person-created foods:** recipes, local dishes, unpackaged restaurant food,
   and private formulations. These are excluded from provider hit-rate
   denominators because the existing manual catalog, not an external provider,
   remains authoritative for them.

## Independent sampling plan

### Required sampling frame

The ordinary-food frame must come from an independent, dated source that
measures foods people consume or search for. The branded and barcode frames must
come from dated retail assortment or purchase data independent of FoodData
Central. A provider's own records, hand-picked products, search-engine results,
team members' cupboards, and another crowd-contributed food database cannot be
presented as representative.

The preferred design is a probability sample stratified by market and broad
food category, weighted by consumption or purchase frequency where the frame
provides weights. If only an unweighted retail assortment is available, results
must be labelled assortment coverage rather than user-attempt coverage.

### Sample size

Each population used for an adoption claim requires at least 385 independently
sampled items after exclusions and deduplication. At an observed rate near 50%,
385 gives an approximately ±5 percentage-point 95% margin of error. Ordinary
food, branded-name, exact-barcode, initial-market, and outside-strongest-market
results are reported separately; samples are not pooled to hide a weak stratum.

### Inclusion, exclusion, and deduplication

- Include foods or products current on the sampling frame's observation date.
- Include one observation per unique normalized generic food concept for the
  ordinary-food stratum.
- Include one observation per canonical GTIN for barcode strata. Validate the
  check digit and normalize UPC-A/EAN-13 representation without discarding
  meaningful leading zeroes.
- Treat package-size or formulation variants as distinct only when the sampling
  frame identifies them with distinct GTINs.
- Exclude non-food products, supplements, medicines, alcohol if the product
  direction excludes it, and records whose identity cannot be verified.
- Preserve excluded counts and reasons in the aggregate report.

Barcodes must come from the approved sampling frame or public product packaging,
never from a person's nutrition history, photos, account, device, or telemetry.
The committed report contains only aggregate counts and method metadata, not raw
product identifiers or provider rows.

### Search terms and review

Ordinary-food queries use the independent frame's common name with only
documented normalization of case, whitespace, punctuation, singular/plural
form, and common preparation qualifiers. Branded-name queries use brand,
product, variant, and package size from the frame. Reviewers record the query
before viewing results. A second reviewer resolves ambiguous ranked results; an
unresolved disagreement remains ambiguous rather than successful.

## Match definitions

- **Exact barcode match:** after check-digit validation and documented
  UPC/EAN normalization, one current FoodData Central Branded record has the
  same identifier and its brand, product, variant, and package identity do not
  conflict with the sampled package.
- **Exact normalized name match:** one result's normalized generic name or full
  branded identity equals the independently recorded identity. Name
  normalization never removes a brand, variant, preparation, or package-size
  distinction.
- **Acceptable ranked search result:** the intended food is within the first
  five results and has no conflicting identity. Generic-food synonyms may count
  only when the foods are compositionally interchangeable for logging.
- **Ambiguous match:** more than one plausible result remains, or the result
  lacks information needed to distinguish the sampled item. Ambiguous matches
  are failures for the discovery threshold.
- **Nutrition-usable match:** energy, protein, carbohydrate, and total fat are
  present as numeric values on a documented mass or volume basis. Zero counts
  only when the source reports zero; missing never becomes zero.
- **Nutrition-complete match:** a nutrition-usable match also contains fiber,
  total sugars, and sodium, matching the application's complete supported
  nutrient vocabulary.
- **No match:** no result satisfies the corresponding identity definition. A
  name resemblance cannot satisfy a barcode lookup.

## Acceptance thresholds fixed before evaluation

| Measure                             |                                                                                          Threshold | Rationale                                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ordinary-food discovery             | At least 90% acceptable top-five results, with the 95% confidence interval's lower bound above 85% | Generic staples should be the provider's strongest case; a one-in-ten miss is already noticeable.                                                |
| Branded-food name discovery         |                           At least 80% acceptable top-five results, with the lower bound above 75% | Four successful attempts in five is the minimum product interpretation of "most of the time" that is meaningfully stronger than a bare majority. |
| Exact barcode discovery             |                       At least 80%, with the lower bound above 75%, in every launch-market stratum | Barcode entry promises precise identity; a strong aggregate cannot compensate for a weak intended market.                                        |
| Nutrition-usable matches            |                                                                   At least 95% of accepted matches | A found record that cannot support energy and macro logging is not a useful success for this application's nutrition goal.                       |
| Nutrition-complete matches          |                                                                   At least 80% of accepted matches | The domain may preserve optional nutrients as unknown, but the database should usually fill the application's supported vocabulary.              |
| False-positive or ambiguous results |                                                                                         At most 5% | Correctness before novelty requires uncertain substitutions to remain visibly unresolved.                                                        |

The 80% discovery floor is a product policy, not a statistical synonym for
"more than half." It represents a repeatable four-in-five experience while the
confidence-bound rule prevents a small or unstable sample from passing by
chance.

## Internal dataset profiling

Internal profiling answers structural and operational questions but is not used
as the external coverage denominator. For the April 2026 Foundation Foods,
FNDDS 2021–2023, and Branded CSV releases, record:

- official archive URL, advertised compressed and uncompressed size, retrieval
  date, response metadata, and a locally computed SHA-256 digest;
- total current food records by data type;
- Branded records with a syntactically valid `gtin_upc`, distinct normalized
  identifiers, duplicates, market-country distribution, and discontinuation
  status;
- presence of energy, protein, carbohydrate, total fat, fiber, total sugars,
  and sodium, without imputing missing values;
- archive-to-normalized-size implications and the documented release cadence.

FoodData Central's field guide states that duplicate `gtin_upc` values can be
product updates distinguished by publication date. Therefore, barcode counts
must deduplicate to the latest non-discontinued record using documented product
identity and publication metadata before measuring nutrition completeness.

## Reproducibility and data handling

Raw archives, extracted files, indexes, samples, and row-level output stay in a
temporary directory outside the repository. No API key is needed for official
bulk downloads. The analysis uses Python's standard library or command-line
tools already installed on the review machine; it adds no repository or runtime
dependency.

USDA does not publish checksums on the download page. A reviewer must therefore
record a locally computed SHA-256 digest of the retrieved archive, alongside its
official release identifier and retrieval metadata; this proves which bytes were
evaluated but is not publisher authentication. Reproduction downloads the named
release from the official archive page and compares aggregate outputs. If the
historical archive's bytes later change, the digest difference is reported
rather than ignored.

Only this protocol, source register, scripts or exact commands small enough to
audit, and aggregate counts may enter Git. Raw provider records, sampled product
identifiers, credentials, archives, and large generated output may not.

## Official sources registered before evaluation

Accessed 2026-08-26:

| Page                                                                                                 | Publisher                          | Fact supported                                                                                                                                                                               | Statement type |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| [Downloadable Data](https://fdc.nal.usda.gov/download-datasets/)                                     | USDA Agricultural Research Service | April 2026 is the current Foundation and Branded bulk release; FNDDS 2021–2023 is the current survey-food release; official CSV/JSON downloads and advertised sizes are available.           | Direct         |
| [Data Type Documentation](https://fdc.nal.usda.gov/data-documentation/)                              | USDA Agricultural Research Service | Foundation, FNDDS, Branded, and SR Legacy have different purposes and source methods; Branded is manufacturer label data and FNDDS represents foods reported in WWEIA/NHANES.                | Direct         |
| [Global Branded Food Products Database Documentation](https://fdc.nal.usda.gov/GBFPD_Documentation/) | USDA Agricultural Research Service | Submission is voluntary; documented market countries are the United States and New Zealand; Branded API data update monthly and bulk downloads twice yearly; missing nutrients are not zero. | Direct         |
| [Download Field Descriptions](https://fdc.nal.usda.gov/docs/Download_Field_Descriptions_Oct2020.pdf) | USDA Agricultural Research Service | `gtin_upc` identifies a branded food, duplicates can denote updates, and `market_country`, publication date, discontinuation date, and nutrient fields have documented meanings.             | Direct         |
| [API Guide](https://fdc.nal.usda.gov/api-guide/)                                                     | USDA Agricultural Research Service | FoodData Central data are public domain and published under CC0; the API supports search/details but requires a key and has rate limits.                                                     | Direct         |
| [FoodData Central Help](https://fdc.nal.usda.gov/help/)                                              | USDA Agricultural Research Service | Users can search a Branded product by GTIN; name and identifier search behavior differ by data type.                                                                                         | Direct         |

This register records what each source establishes. Any conclusion about product
suitability drawn from those facts is explicitly labelled as an inference in the
results section.

## Evaluated material and retrieval evidence

The three official CSV archive links were retrieved on 2026-08-26 into a
temporary directory outside the repository. `unzip -tq` reported no compressed
data errors. USDA publishes no checksum beside these downloads, so the SHA-256
values below are locally computed retrieval identifiers, not publisher-signed
integrity claims.

| Dataset          | Official release                                                                                            | Response bytes | Archive contents bytes | Local SHA-256                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | -------------: | ---------------------: | ------------------------------------------------------------------ |
| Foundation Foods | [April 2026 CSV](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip) |      3,825,741 |             32,744,127 | `70457ee9d9342f43bda2010318c85f04210c689fdeb9cd2da4c513b0e8dbc655` |
| FNDDS 2021–2023  | [October 2024 CSV](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2024-10-31.zip)   |      3,325,692 |             25,504,473 | `5ccc25ec2777a8982fbb61378a42f415316173eb11e48c9a8ba4cb19f5a4f29c` |
| Branded Foods    | [April 2026 CSV](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_branded_food_csv_2026-04-30.zip)    |    448,767,220 |          3,091,857,579 | `26050a5d03197469813754743a21ee0fad4ccf22b6aac2a995846a987719fc49` |

The combined download was 455,918,653 bytes and the combined archive contents
were 3,150,106,179 bytes. Response metadata recorded `ETag` and
`Last-Modified` values locally; the Foundation URL's `Last-Modified` value was
2026-08-19 despite its April release name. This is why reproduction must compare
the digest rather than assuming a dated URL is immutable.

The download page's displayed FNDDS CSV sizes do not match the bytes served by
its official link. The table advertises a much larger CSV, while the link
returned the valid 3,325,692-byte archive described above. The measured file and
its digest govern these results. A production sizing exercise would need USDA to
clarify the page discrepancy instead of treating either number as stable.

## Reproduction

Run the committed standard-library profiler against the three archives; it
writes aggregate JSON and never writes a provider row:

```text
python3 scripts/evaluate-fooddata-central.py \
  --foundation <foundation.zip> \
  --fndds <fndds.zip> \
  --branded <branded.zip> \
  --output <aggregates.json>
```

The evaluated script has SHA-256
`cfaaa10124c3bea6cf04f877714f99027a93a6c1f6a4e1ec86fe81cb3f6c9447`.
Two runs produced byte-identical aggregate JSON with SHA-256
`72cdd7224b300236afa41eda013b15a5ffe3d277f3128d39c2d6e50a95f93c82`.
The script:

- streams CSV members from ZIP files without extracting them;
- recognizes USDA's identifier and nutrient-number representations for the
  seven application nutrients;
- validates GTIN-8, UPC-A/GTIN-12, EAN-13, and GTIN-14 check digits, then
  left-pads valid values to canonical GTIN-14 for deduplication;
- excludes records carrying a discontinuation date;
- selects the greatest publication date per canonical GTIN and uses FDC ID only
  as a deterministic tie-breaker; and
- counts a nutrient only when its amount is present, preserving missing as
  missing and reported zero as known zero.

The tie-breaker makes the aggregate reproducible but does not prove that two
same-date records describe the same retail product. Same-date ties are reported
as ambiguity rather than hidden.

## Directly measured aggregate results

### Ordinary-food datasets

| Dataset          | Searchable foods | Energy + protein + carbohydrate + fat | All seven application fields |
| ---------------- | ---------------: | ------------------------------------: | ---------------------------: |
| Foundation Foods |              469 |                          377 (80.38%) |                  90 (19.19%) |
| FNDDS 2021–2023  |            5,432 |                        5,431 (99.98%) |               5,431 (99.98%) |

Foundation's archive also contains 87,521 acquisition, sample, and subsample
rows. They are analytical support, not counted as the 469 searchable Foundation
foods. FNDDS is the stronger structural candidate for ordinary-food logging: it
has a much broader searchable list and nearly universal population of the seven
fields this application supports. This is an inference from internal structure,
not a measured search-discovery rate.

No independent ordinary-food query sample was available. Therefore neither the
90% ranked-discovery threshold nor its confidence-bound condition was tested.

### Branded identifiers and geography

- 1,999,950 Branded rows were present, and all carried a nonblank `gtin_upc`.
- 1,947,777 rows (97.39%) had a supported GTIN length and valid check digit.
- Removing 3,702 discontinued rows and collapsing update history produced
  430,240 distinct live, valid GTINs.
- 378,786 of those GTINs had multiple live rows before latest-publication
  selection; 4,976 (1.16%) were still tied on the latest publication date.
- The selected records were 421,536 `United States`, 7,614 `US`, and 1,090
  `New Zealand`. Treating the two U.S. labels together, 99.75% were U.S. and
  0.25% were New Zealand. No other market appeared.

The provider's own rows demonstrate that barcode identifiers exist at useful
scale. They do not establish the denominator of current products sold in any
market, so 430,240 cannot be converted into a real-world hit rate. The market
distribution directly supports U.S./New Zealand scope and directly contradicts
any claim of global representation.

### Nutrition completeness for selected branded records

| Field or group     | Present | Rate of 430,240 selected GTINs |
| ------------------ | ------: | -----------------------------: |
| Energy             | 423,800 |                         98.50% |
| Protein            | 425,154 |                         98.82% |
| Carbohydrate       | 422,852 |                         98.28% |
| Total fat          | 424,846 |                         98.75% |
| Fiber              | 358,902 |                         83.42% |
| Total sugars       | 402,804 |                         93.62% |
| Sodium             | 423,542 |                         98.44% |
| Nutrition-usable   | 417,550 |                         97.05% |
| Nutrition-complete | 348,260 |                         80.95% |

Both internal completeness thresholds pass: usable exceeds 95% and complete
exceeds 80%. This does not rescue an identifier absent from the database and is
not counted as barcode discovery.

## Threshold evaluation

| Predefined measure               | Result                                                                                   | Status                   |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------ |
| Ordinary-food discovery          | No independent sample; unmeasured                                                        | Not met                  |
| Branded-food name discovery      | No independent sample; unmeasured                                                        | Not met                  |
| Exact barcode discovery          | No independent sample or named launch market; unmeasured                                 | Not met                  |
| Nutrition-usable matches         | 97.05% of internally selected branded GTINs                                              | Structural threshold met |
| Nutrition-complete matches       | 80.95% of internally selected branded GTINs                                              | Structural threshold met |
| False-positive or ambiguous rate | External search ambiguity unmeasured; 1.16% internal same-latest-date GTIN ties observed | Not met                  |

"Not met" here means the evidence required by the protocol was not produced; it
does not manufacture a zero-percent provider hit rate. The three discovery
conditions are conjunctive adoption gates, so an unmeasured condition prevents
approval.

## Sampling and geographic limitations

- The repository does not identify an initial launch market. Market-specific
  barcode acceptance therefore cannot be evaluated against product intent.
- No dated, independent probability frame of food-search attempts, retail
  purchases, or retail assortment was supplied or identified in the reviewed
  USDA material. Sampling FoodData Central itself would be circular.
- FNDDS describes foods reported in a U.S. dietary survey, so it is useful for
  U.S. ordinary-food vocabulary but is not a global search frame.
- Branded submission is voluntary, and the official documentation names only
  the United States and New Zealand as market countries. The measured archive is
  99.75% U.S. after normalization.
- A crowd-contributed database, a personal cupboard, or a hand-picked list could
  support exploratory defect finding but would not satisfy the approved
  representativeness claim. None was substituted for the missing frame.
- Internal same-date update ties show that a future importer must define current
  product identity more carefully than "one row per barcode." The present
  deterministic tie-breaker is analysis bookkeeping, not an approved product
  reconciliation policy.

## Offline distribution and transformation cost

FoodData Central can be downloaded and redistributed under CC0. Offline use is
therefore legally possible on the official terms reviewed here, with USDA
requesting source citation even though permission is not required.

Operationally, shipping the raw Branded CSV is not responsible: its archive
expands to 3.09 GB, includes update history, and has almost two million rows for
430,240 selected identifiers. A future approved implementation would need a
deterministic transformation to current, checksum-valid records; nutrient and
unit mapping; a compact indexed representation; integrity metadata; atomic
updates; rollback; and safe deletion. Branded API data update monthly while bulk
downloads update twice yearly, creating an explicit freshness-versus-offline-
package trade. FNDDS updates with its survey cycle; SR Legacy is final; Foundation
updates with FoodData Central releases.

No size is estimated for a transformed application bundle because no schema,
field subset, compression choice, market scope, or update design is approved.
The raw measured sizes are sufficient to show that "bundle the CSV" is not the
smallest responsible implementation.

## Sprint 50 decision (superseded): Outcome C — evidence is insufficient

FoodData Central was **not approved** as Phase 5's sole food-data provider as
of Sprint 50. Internal data quality was promising, especially FNDDS
ordinary-food nutrient population and Branded energy/macro completeness, but
the evaluation could not answer the product question fixed in advance:
whether an independent set of foods and barcodes a person will actually try
is found at the required rate, because no independent sampling frame or
named launch market existed yet.

Sprint 51 ([ADR 0037](decisions/0037-initial-nutrition-market-and-independent-sampling-frame.md),
[Sampling frame evaluation](nutrition-sampling-frame-evaluation.md)) resolved both prerequisites
by defining the **United States (US)** as the initial market and approving the
independent NHANES WWEIA and Open Food Facts US assortment sampling frames,
leaving execution of the actual discovery measurement as the remaining step.
**Sprint 52 executed that measurement; see below. This section is retained as
the historical record of why Outcome C was chosen at the time, not as the
current decision.**

## Sprint 52: Independent sampled-coverage evaluation (executed)

- Execution date: 2026-08-28
- Sampling seed: `20260827` (fixed before any real data was inspected, per ADR 0037)
- Sampler: `scripts/sample-nutrition-frame.py`, `method_version` 2
- Discovery evaluator: `scripts/evaluate-fooddata-central-discovery.py`, `method_version` 2 (see disclosed defect correction below)
- Evaluated release: same USDA FoodData Central April 2026 bulk downloads as Sprint 50, re-verified byte-identical (same SHA-256 digests as recorded above) on 2026-08-28
- **Outcome: B — FoodData Central fails the coverage evaluation**

### Source provenance for the independent sampling frames

| Source                                                                                                                                  | Files                                                                                                                      | Retrieval date       | SHA-256                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| CDC/USDA NHANES 2021–2023, Dietary Interview – Individual Foods, Day 1                                                                  | `DR1IFF_L.xpt`                                                                                                             | 2026-08-28           | `97177395e5fd1322ec8cb72d271a3f8d46e6a83b1105f89f6ef6f39f156037b3`                                                           |
| CDC/USDA NHANES 2021–2023, food-code crosswalk                                                                                          | `DRXFCD_L.xpt`                                                                                                             | 2026-08-28           | `1101ce9dd5b58f138a4f44c14de39925664dda401588c130f5281ad289dfa34c`                                                           |
| USDA ARS FSRG, 2021–2023 FNDDS At A Glance – Foods and Beverages (food code → WWEIA category; `DRXFCD_L.xpt` carries no category field) | `fndds-foods-and-beverages.xlsx`                                                                                           | 2026-08-28           | `ae7e41d348ff0c9d63199c12746c9dfa8ee1444ce2efb32b824ae191814d7d15`                                                           |
| Derived ordinary-food frequency table (`scripts/prepare-wweia-frequency-table.py`)                                                      | `wweia-frequency-table.csv`                                                                                                | derived 2026-08-28   | 3,987 distinct food codes; 100,116 total DR1IFF respondent-day rows; 172 distinct WWEIA categories; 100% crosswalk join rate |
| Open Food Facts, full product export (US products filtered at sampling time via `countries_tags`)                                       | `en.openfoodfacts.org.products.csv.gz` (internally tab-delimited despite the `.csv` name — verified directly, not assumed) | 2026-08-28T01:47:09Z | `f72687ee8bc6522054fe69dbfda6b91902c16af1ec2e043cde27bc6c29ad8176`                                                           |

**Scoping disclosures, not silent choices:**

- The WWEIA frequency table uses only the NHANES 2021–2023 cycle, not a pooled
  2017–March 2020 / 2021–2023 estimate — pooling cycles requires NHANES's own
  combined-cycle sample-weight methodology, out of this sprint's scope. ADR
  0037 names both cycles as acceptable; using one complete cycle is within
  that approval.
- `reporting_frequency` is the **unweighted** count of DR1IFF respondent-day
  entries per food code, not a population-weighted prevalence estimate (which
  would require merging NHANES demographic sample-weight files). This is
  disclosed, not presented as population-weighted anywhere in this report.
- NHANES/WWEIA dietary data is published only in SAS Transport (XPT) format;
  no CSV alternative exists. `scripts/sas_xport.py` is a scoped,
  standard-library-only reader for it (no new dependency), validated against
  SAS's own published IBM-float reference vectors and against internal
  consistency checks on the real files (plausible row/code counts, a 100%
  crosswalk join rate) before being trusted.
- Open Food Facts's own "CSV" export is internally tab-delimited; this was
  verified directly against the downloaded bytes rather than assumed from the
  file's `.csv` extension.

### Matching protocol, frozen before this run

The match, ambiguity, nutrition-usability, and nutrition-completeness
definitions are exactly those already fixed above in this document (unchanged
since Sprint 50/51). The discovery evaluator operationalizes them as:
full-token-subset containment between the normalized query and a candidate
(the eligibility gate that prevents a semantically wrong food from counting
as a hit on partial overlap — e.g. a "chicken broth" query cannot match a
"chicken breast" candidate, since "broth" is absent from the candidate),
ranked by Jaccard token similarity among eligible candidates for top-five
ordering and a 0.05-margin near-tie rule for ambiguity classification. Exact
barcodes use canonical-GTIN-14 equality only, against the same latest-record,
non-discontinued selection rule Sprint 50's profiler already used, with a
same-date publication tie classified as ambiguous rather than arbitrarily
resolved. All constants and the full implementation were written and unit
tested against synthetic fixtures before any real archive or sample was
touched (`scripts/tests/test_evaluate_fooddata_central_discovery.py`).

### Disclosed post-hoc defect correction (method_version 1 → 2)

The evaluator's first real run (`method_version` 1) additionally gated
eligibility on a Jaccard score ≥ 0.6 on top of full token-subset containment.
Cross-checking the branded-name stratum's "no match" results against the
independently built, already-frozen exact-barcode index (a diagnostic lookup,
not a re-scoring) found that **102 of 277 branded-name "no match" results
were objectively present in FoodData Central under the same GTIN** — the
Jaccard floor was rejecting them because FoodData Central's `brand_owner`
field is frequently a verbose legal entity name (e.g. "Cooperative Region of
Organic Producer Pool" for a store-brand steak) rather than a retail brand,
which inflates the Jaccard denominator even though every query token is
genuinely present. Full subset containment already provides the
false-positive guard the floor was meant to add, so `method_version` 2
removes the floor as an eligibility gate and keeps Jaccard only for ranking
and ambiguity-tie detection among already-eligible candidates. This is a
disclosed correction to the scoring **implementation**, made after
identifying an objective defect via independent cross-validation — not a
retroactive change to the ADR 0037 / eval-doc match definitions themselves,
which never specified a token-similarity formula, and not a response to
disliking the outcome: the exact-barcode stratum (pure GTIN equality, no
Jaccard involved) and the ordinary-food stratum (already comfortably passing)
are both numerically unchanged by this correction, and the branded-name
stratum's own conclusion (fails) is also unchanged — only its reported margin
moved. Both runs' full results are reported below for auditability.

### Per-stratum results

**Ordinary foods** (`method_version` 1 and 2 identical — the correction does not affect this stratum):

| Measure                              |            Value |
| ------------------------------------ | ---------------: |
| Denominator                          |              385 |
| Acceptable top-five matches          |              381 |
| Ambiguous                            |                4 |
| No match                             |                0 |
| Discovery rate (point)               |           98.96% |
| Discovery rate, Wilson 95% CI        | [97.36%, 99.60%] |
| Nutrition-usable rate (of matches)   |           99.74% |
| Nutrition-complete rate (of matches) |           98.69% |

**Branded names** — `method_version` 1 (original, superseded) and `method_version` 2 (corrected, final):

| Measure                              |    v1 (original) | v2 (corrected, final) |
| ------------------------------------ | ---------------: | --------------------: |
| Denominator                          |              385 |                   385 |
| Acceptable top-five matches          |               80 |                   121 |
| Ambiguous                            |               28 |                    54 |
| No match                             |              277 |                   210 |
| Discovery rate (point)               |           20.78% |                31.43% |
| Discovery rate, Wilson 95% CI        | [17.02%, 25.11%] |      [26.99%, 36.23%] |
| Nutrition-usable rate (of matches)   |           97.50% |                97.52% |
| Nutrition-complete rate (of matches) |           78.75% |                80.17% |

**Exact barcodes** (`method_version` 1 and 2 identical — pure GTIN equality, unaffected by the name-matching correction):

| Measure                               |            Value |
| ------------------------------------- | ---------------: |
| Denominator                           |              385 |
| Exact matches                         |              214 |
| Ambiguous (same-date publication tie) |                0 |
| No match                              |              171 |
| Discovery rate (point)                |           55.58% |
| Discovery rate, Wilson 95% CI         | [50.59%, 60.47%] |
| Nutrition-usable rate (of matches)    |           97.20% |
| Nutrition-complete rate (of matches)  |           81.31% |

Branded-name and exact-barcode sample category distributions (Open Food
Facts, unweighted retail assortment): 48 items in each of 7 categories and 49
in beverages, summing to 385 per stratum, drawn independently from an
Open Food Facts US pool of 385-per-category-target items after excluding
254,188 US-market, valid-GTIN, named products that matched none of the 8
fixed retail-category keyword groups (`excluded_uncategorized_count`,
recorded rather than folded into an existing category). Ordinary-food sample
category distribution spans all 172 distinct WWEIA categories present in the
2021–2023 frequency table, each allocated 1–3 items by the deterministic
quota-and-backfill rule, summing to exactly 385.

### Threshold-by-threshold result (final, `method_version` 2)

| Measure                         | Threshold           | Result                                         |       Status       |
| ------------------------------- | ------------------- | ---------------------------------------------- | :----------------: |
| Ordinary-food discovery         | ≥90%, CI lower >85% | 98.96%, CI lower 97.36%                        |      **Pass**      |
| Branded-name discovery          | ≥80%, CI lower >75% | 31.43%, CI lower 26.99%                        |      **Fail**      |
| Exact-barcode discovery         | ≥80%, CI lower >75% | 55.58%, CI lower 50.59%                        |      **Fail**      |
| Nutrition-usable (all strata)   | ≥95% of matches     | 99.74% / 97.52% / 97.20%                       |      **Pass**      |
| Nutrition-complete (all strata) | ≥80% of matches     | 98.69% / 80.17% / 81.31%                       |      **Pass**      |
| Ambiguity / false-positive      | ≤5%                 | ordinary 1.04%; branded **14.03%**; barcode 0% | **Fail** (branded) |

The three discovery thresholds are conjunctive adoption gates (ADR 0036):
branded-name and exact-barcode discovery each independently fail by a wide
margin — barcode discovery's result is a clean exact-match measurement
entirely unaffected by the name-matching correction above, and its 95% CI
upper bound (60.47%) does not even reach the 75% lower-bound requirement.
Branded-name discovery additionally fails the ambiguity ceiling. One passing
stratum cannot offset two failing, conjunctive ones.

### Limitations and selection bias

- **Ordinary-food circularity, disclosed rather than corrected.** FoodData
  Central's bulk release republishes the same USDA FNDDS reference database
  NHANES uses to assign food codes during dietary recalls. Query text drawn
  from the WWEIA/FNDDS crosswalk is therefore close to guaranteed to appear
  verbatim in FoodData Central's own FNDDS records, for reasons of data
  lineage rather than measured real-world search quality. This was raised and
  a decision made before running the evaluation: proceed exactly as ADR 0037
  approved, without altering the frame, and disclose the relationship rather
  than treat the 98.96% ordinary-food result as evidence of general
  discoverability. The result should be read as "FoodData Central's own FNDDS
  vocabulary is present in FoodData Central's own FNDDS data" — a
  near-tautology — rather than as strong, independent proof that arbitrary
  staple-food searches succeed at that rate. It does not affect the overall
  Outcome B decision, which rests on the two failing, non-circular strata.
- **Branded-name matcher's remaining strictness.** Even after the
  `method_version` 2 correction, the matcher still requires full
  token-subset containment, which will not recognize a true match if the two
  sources' text diverges more than simple extra-token prefixing (different
  word order, abbreviations, or unit/size phrasing). The 31.43% branded-name
  result is therefore still plausibly a lower bound on FoodData Central's
  true branded-name discoverability, not a precise point estimate — but the
  margin to the 80% threshold (a further 48.6 percentage points) is far too
  large for this to plausibly change the conclusion.
- **Exact-barcode discovery is the cleanest, most decisive measurement in
  this evaluation**: pure canonical-GTIN-14 equality against FoodData
  Central's own already-deduplicated, latest-record Branded index, with no
  scoring, ranking, or normalization judgment involved. Its failure is not
  attributable to any matching-implementation choice.
- **Open Food Facts assortment coverage, not consumer-purchase coverage.**
  Per ADR 0037, the branded-name and barcode denominators are unweighted
  retail-assortment coverage — which products exist in Open Food Facts's
  crowdsourced US corpus — not a purchase-frequency-weighted sample. This
  affects which products were eligible to be sampled, not whether a sampled
  product is genuinely a real US retail item.
- **US-market evidence only**, per ADR 0037; this evaluation makes no claim
  about FoodData Central's suitability in any other market.
- No row-level Open Food Facts, NHANES, or FoodData Central record is
  reproduced anywhere in this document or in Git history; every number above
  is an aggregate statistic recomputed from the committed scripts and the
  publicly retrievable source archives.

## Decision: Outcome B — FoodData Central fails

**FoodData Central is not approved** as Phase 5's food-data provider.
Branded-name discovery (31.43%, required ≥80% with CI lower bound >75%) and
exact-barcode discovery (55.58%, required ≥80% with CI lower bound >75%) both
fail decisively, and branded-name ambiguity (14.03%, required ≤5%) fails as
well. These are conjunctive requirements: a person attempting to log a
packaged product by name or barcode — a common real-world path this
application must support — would not find it in FoodData Central "most of
the time" under this evaluation's terms. The strong ordinary-food result does
not offset this, both because it does not compensate for a failing
conjunctive stratum and because it carries the disclosed FNDDS-circularity
limitation above.

FoodData Central's structural completeness (Sprint 50's internal profiling)
and its strong ordinary-food/FNDDS performance remain genuinely useful facts
about the dataset — this Outcome does not contradict them — but they do not
establish that a person's actual branded-product or barcode search succeeds
at the required rate, which is the question this evaluation was designed to
answer.

**Next unblocking path.** Per ADR 0035 and ADR 0036, qualified legal review of
Open Food Facts's ODbL 1.0 / DbCL 1.0 bundling obligations remains the other
named, still-active path to unblock Phase 5's food-database half — independent
of this evaluation's result, since it addresses a different candidate source
under a different constraint (licensing rather than measured coverage). A
multi-source design (e.g. FoodData Central for ordinary foods, a second source
for branded/barcode) is not justified by this sprint: it would need its own
provenance, conflict, and update-policy review, and no second source is
currently approved to pair it with.

## Product and ownership consequences

- Phase 5 remains **Current**: Sprint 49 met only the macro-target half; the
  food-database half remains unmet, now with a completed (not merely
  insufficient-evidence) provider evaluation on record.
- Phase 6 remains blocked on Phase 5 reaching sufficient depth.
- `NutritionProvenance` remains `'provided' | 'estimated'`; no provider value is
  added prematurely.
- Person-created catalog items and diary snapshots remain authoritative. No
  provider refresh or reconciliation policy exists, and none may silently
  overwrite them.
- No provider record, archive, API key, secret, barcode, or raw sample enters
  repository history.
- No production file, runtime dependency, network client, cache, scanner, schema,
  migration, export format, restore path, or erasure behavior changes.

## Reproduction (Sprint 52 execution)

Raw archives, the derived WWEIA frequency table, the Open Food Facts export,
and all per-item sample rows stay outside Git, exactly as ADR 0037 requires.
Reproducing the aggregate results in the tables above requires re-acquiring
the same dated sources (hashes above) and running, in order:

```text
python3 scripts/prepare-wweia-frequency-table.py \
  --dr1iff <DR1IFF_L.xpt> \
  --food-code-crosswalk <fndds-foods-and-beverages.xlsx> \
  --output <wweia-frequency-table.csv> \
  --summary-output <wweia-frequency-table.summary.json>

python3 scripts/sample-nutrition-frame.py \
  --wweia-csv <wweia-frequency-table.csv> \
  --off-dump <en.openfoodfacts.org.products.csv.gz> \
  --seed 20260827 \
  --sample-size 385 \
  --samples-output <samples-raw.json> \
  --summary-output <samples-summary.json>

python3 scripts/evaluate-fooddata-central-discovery.py \
  --samples <samples-raw.json> \
  --foundation <FoodData_Central_foundation_food_csv_2026-04-30.zip> \
  --fndds <FoodData_Central_survey_food_csv_2024-10-31.zip> \
  --branded <FoodData_Central_branded_food_csv_2026-04-30.zip> \
  --output <discovery-evaluation.json>
```

Open Food Facts's export is internally tab-delimited despite its `.csv` name;
either rename the local copy to end in `.tsv.gz` before passing it as
`--off-dump`, or otherwise ensure the sampler's extension-based format
detection sees the correct delimiter. The fixed seed (`20260827`) and the
frozen matching constants make every step deterministic and independently
reproducible from the dated sources without committing any of them.
