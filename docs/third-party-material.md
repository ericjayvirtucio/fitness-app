# Third-party material

This document records which third-party code, data, and media the product may
use, which it may not, and what each obligation costs. It exists so that a
licensing answer is reached once and recorded, rather than rediscovered by
whoever opens the next phase.

**No third-party code, data, or media ships in this repository today.** There is
no `THIRD-PARTY.md` at the repository root, and none is needed until the first
import. The phase that imports any material below creates that file in the same
change, carrying the notices its terms require.

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

**`hasaneyldrm/exercises-dataset`** — MIT for the data. Roughly 1,324 exercises
with names, categories, body parts, equipment, target muscles, and step-by-step
instructions in six languages. Usable, provided the MIT copyright notice travels
with any copy. The complete dataset is roughly 17 MB, which is more than an
application bundle should carry; how much of it ships is an open question in the
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

**USDA FoodData Central** — a work of the United States federal government, in
the public domain. Free to bundle and redistribute, and therefore the candidate
for offline food lookup. Its coverage is oriented toward foods rather than retail
products, and toward the United States.

**Open Food Facts** — licensed ODbL 1.0. Broad international coverage and the
barcode data a scanner needs. The obligation is share-alike on a _derived
database_: building one from it obliges offering that derived database under the
same terms. Querying it live over the network creates no derived database and
therefore no obligation, at the cost of barcode lookup requiring connectivity.
That cost lands directly against the offline-first philosophy, so the choice is
recorded as an open question in the product direction rather than settled here.

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
