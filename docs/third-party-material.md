# Third-party material

This document records which third-party code, data, and media the product may
use, which it may not, and what each obligation costs. It exists so that a
licensing answer is reached once and recorded, rather than rediscovered by
whoever opens the next phase.

**One import has happened.** Sprint 43 (Specification 0043) selected and
re-classified a subset of `hasaneyldrm/exercises-dataset`'s exercise names and
equipment/muscle classifications — no instruction text, no translation, no
image, no video — into
`apps/mobile/src/features/exercise-catalog/application/expanded-exercises.ts`.
The MIT notice this owes lives in [`THIRD-PARTY.md`](../THIRD-PARTY.md) at the
repository root. No other third-party code, data, or media ships in this
repository. A later phase that imports further material extends that file in
the same change, carrying the notices its terms require.

The [Engineering Constitution](../AGENTS.md) already requires reviewing a
dependency's license before adoption. This document is the standing result of
that review for the material the [product direction](../PRODUCT.md) depends on.

## Source code

**openGym** — `https://github.com/DuarteSantos8/openGym`, licensed AGPL v3.0.

The product direction was informed by studying this application. **Its source
code is not used in this repository and may not be.** This application is
private and unlicensed; incorporating AGPL-licensed code would place the entire
distributed work under the AGPL, including its network-served parts, and the
app-store permission the project grants covers a distribution channel rather
than removing that obligation.

What a study legitimately produces is knowledge and direction. Features,
interaction conventions, and layout are not copyrightable; source code is.
Anything traceable to that application is reimplemented from scratch against this
repository's own domain model, patterns, and design system, and its name, logo,
screenshots, and assets are not used.

The same reasoning applies to any other copyleft-licensed application studied
later. Read the license before reading the code.

## Exercise data and media

Exercise data and the imagery that illustrates it are licensed separately from
each other in every source examined, and the difference is the whole point.

**`hasaneyldrm/exercises-dataset`** — MIT for the data, tooling, and
instruction text specifically (its `LICENSE` file states this explicitly,
alongside a separate media exception — see below). Roughly 1,324 exercises
with names, categories, body parts, equipment, target muscles, and
step-by-step instructions, now in ten languages. Usable, provided the MIT
copyright notice travels with any copy. The complete dataset is roughly 17 MB,
which is more than an application bundle should carry.

Sprint 43 (Specification 0043) verified this license directly against the
repository's `LICENSE` file at commit
`7455efae41b330c265e7cd4b78dfa848e7ce5eb`, retrieved 2026-08-24, and used only
the English name, equipment, and target-muscle fields for 189 curated
Exercise Definitions — never the instruction text, translations, images, or
GIFs. The notice this owes is recorded in [`THIRD-PARTY.md`](../THIRD-PARTY.md).
How much more of it, if any, ships later remains an open question in the
product direction.

**The media in that same repository** — the animations and thumbnails in its
`images/` and `videos/` directories are **© Gym visual** and are explicitly **not**
covered by its MIT license. They are redistributed there under a separate written
permission granted to that project, at 180×180 resolution, with mandatory
attribution. **Cloning the repository grants this product no license to them.**
Using them would require obtaining a license directly from Gym visual. Until that
happens, they are unavailable and must not be fetched, bundled, cached, or
displayed.

**`yuhonas/free-exercise-db`** — released into the public domain under the
Unlicense, covering both its data and its photographs: 800-plus exercises with
two static images each. This is the free substitute for the media above. The
trade is still photographs rather than animation, and a smaller catalog.

**`melihcolpan/MuscleMap`** — MIT. Muscle-group outline geometry, usable with
notice, for any muscle-map or body-diagram presentation.

## Food data

No food data has been imported, bundled, or approved for use. Sprint 48
(2026-08-26) reviewed both candidates against their current primary sources
and recorded the licensing decision in [ADR
0035](decisions/0035-nutrition-provenance-and-unapproved-food-data-sourcing.md).
Sprint 50 profiled FoodData Central's current bulk release and recorded the
evidence-insufficient coverage decision in [ADR
0036](decisions/0036-fooddata-central-coverage-remains-unproven.md). Sprint 51
(2026-08-27) defined the **United States (US)** as the approved initial launch
market and approved the independent sampling frame strategy in [ADR
0037](decisions/0037-initial-nutrition-market-and-independent-sampling-frame.md)
and the [sampling frame evaluation](nutrition-sampling-frame-evaluation.md). This
section restates the licensing and sourcing facts those decisions rest on.

**USDA FoodData Central** — public-domain data published under CC0 1.0. No
permission or share-alike obligation applies; USDA requests that users identify
FoodData Central as the source even though that citation is not a license
condition. Official bulk CSV/JSON downloads and a documented API exist
([fdc.nal.usda.gov/download-datasets](https://fdc.nal.usda.gov/download-datasets/),
accessed 2026-08-26; licensing terms at the [official API
guide](https://fdc.nal.usda.gov/api-guide/), accessed 2026-08-26). Free to
download, transform, bundle, and redistribute on those terms. Its Branded Foods
dataset carries a `gtin_upc` field intended for barcode identification.

Sprint 50's [coverage evaluation](fooddata-central-coverage-evaluation.md)
measured 430,240 distinct live, valid GTINs in the April 2026 Branded CSV after
excluding discontinued rows and selecting the latest publication. Of those
selected records, 97.05% contained energy plus protein, carbohydrate, and fat,
and 80.95% contained all seven fields this application supports. FNDDS contained
all seven for 5,431 of 5,432 searchable foods. These are internal completeness
measures, not real-world discovery rates. No independent representative sample
or named launch market existed, and 99.75% of selected Branded records were
U.S.-labelled, so FoodData Central remains unapproved rather than being described
as globally or launch-market adequate.

**Open Food Facts** — database structure licensed ODbL 1.0, individual
records licensed under the Database Contents License (DbCL) 1.0, images
separately under CC BY-SA
([world.openfoodfacts.org/terms-of-use](https://world.openfoodfacts.org/terms-of-use),
accessed 2026-08-26). Broad international coverage and the barcode data a
scanner needs. The obligation is share-alike on a _derived database_:
combining Open Food Facts data into another database obliges releasing that
resulting database under the same terms, and attribution to Open Food
Facts with a link back is required regardless. **Whether shipping a
filtered, non-further-redistributable subset inside a distributed mobile
application counts as "distributing the database" in the sense that
triggers this obligation on that bundled subset is not addressed by Open
Food Facts's own terms or API FAQ** — this is not an assumption this
repository is declining to research further; it is a gap in the source's
own published documentation, and ADR 0035 names qualified legal review as
the way to close it. Querying it live over the network avoids building a
derived database at build time, at the cost of barcode lookup requiring
connectivity, which lands directly against the offline-first philosophy —
so live querying is not treated here as a way around the licensing
question, only as a different trade against a different principle.

Sprint 51 ([ADR 0037](decisions/0037-initial-nutrition-market-and-independent-sampling-frame.md))
approved an Open Food Facts United States dated snapshot strictly as an **external,
unweighted retail assortment evaluation frame** for testing FoodData Central discovery.
Using an external snapshot to extract query terms and barcode check values for benchmark
testing, while publishing only aggregate statistical metrics and committing no raw records
or derived database to Git, is an analytical evaluation use permitted under ODbL 1.0 / DbCL
1.0 that does not trigger copyleft obligations on the application codebase. Qualified
legal review remains the requirement before any Open Food Facts data may be bundled in
production.

## Rules that follow

- Data and the media illustrating it are licensed separately until proven
  otherwise. Check both, and record both.
- A permissive license on a repository says nothing about assets inside it that
  the repository redistributes under someone else's permission.
- Cloning is not licensing. A file being fetchable is not a right to ship it.
- Attribution owed is created in the same change as the import that owes it, not
  before the phase and not after review.
- A share-alike obligation that attaches to a derived database is avoided by not
  deriving one, which is an architecture decision with an offline cost rather
  than a formality.
