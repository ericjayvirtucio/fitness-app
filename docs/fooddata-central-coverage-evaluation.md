# FoodData Central coverage evaluation

- Protocol fixed: 2026-08-26, before downloading or inspecting the evaluated
  release
- Evaluation release: USDA FoodData Central April 2026 bulk downloads
- Outcome: C — evidence is insufficient to approve FoodData Central
- Decision governed by: [ADR 0035](decisions/0035-nutrition-provenance-and-unapproved-food-data-sourcing.md)

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
   launch market. The repository does not currently name that market, so no
   release decision may claim this population has been tested until the product
   direction names it.
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

## Decision: Outcome C — evidence is insufficient

FoodData Central is **not approved** as Phase 5's sole food-data provider.
Internal data quality is promising, especially FNDDS ordinary-food nutrient
population and Branded energy/macro completeness, but the evaluation cannot
answer the product question it fixed in advance: whether an independent set of
foods and barcodes a person will actually try is found at the required rate.

FoodData Central remains a credible candidate and could still become a bounded
source in a multi-source design, but this sprint does not justify that design
yet. Introducing a provider abstraction before one source is approved would be
speculative, and using Open Food Facts as a second source still carries ADR
0035's unresolved legal question.

A better sample could materially change this decision. The smallest responsible
follow-up is:

1. name the application's initial market;
2. acquire or commission an independent, dated sampling frame for that market;
3. draw at least 385 ordinary-food queries, 385 branded-name queries, and 385
   current barcodes per adoption stratum under this fixed protocol;
4. publish only aggregate results and reviewer disagreements; and
5. approve an implementation specification only if every predefined threshold
   and lower-bound condition passes.

Qualified review of Open Food Facts's bundling obligations remains the other
credible unblocker, but it is not the only one because the representative USDA
study remains feasible in principle. Neither path is implemented or approved by
this evaluation.

## Product and ownership consequences

- Phase 5 remains **Current**: Sprint 49 met only the macro-target half.
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
