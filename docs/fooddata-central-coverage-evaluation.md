# FoodData Central coverage evaluation

- Protocol fixed: 2026-08-26, before downloading or inspecting the evaluated
  release
- Evaluation release: USDA FoodData Central April 2026 bulk downloads
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
