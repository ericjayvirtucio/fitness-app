# Specification 0043: Expanded exercise library

- Status: Approved
- Date: 2026-08-24

## Objective and scope

Let a person add 189 further Exercise Definitions to their library in one
deliberate action, alongside — never instead of — the twenty-six-definition
starter set Specification 0027 already offers. Version 1 ships the content as
code inside the mobile application, reuses Specification 0027's import
mechanism exactly (`AddStarterExercisesUseCase`, parametrized with different
content), and writes the definitions the person does not already hold in one
exclusive transaction after an explicit press.

Every added definition is an ordinary user-owned row from the moment it is
written, exactly as a starter or hand-authored one is. It is editable,
re-classifiable, favoritable, deletable, and exportable, and no read model can
tell it from any other definition.

Exercise images, illustrations, video, instructions, technique guidance,
multilingual content, a schema or export-format change, a new UI redesign, and
a generic content-import framework are excluded. This specification covers
structured Exercise Definitions only.

## The problem

Twenty-six starter exercises are enough to reach every logging mode and
almost every equipment and muscle-group value, but they are a small fraction
of what a person training seriously might expect a library to already offer.
`PRODUCT.md`'s "Direction from here" names this directly: "An openly licensed
dataset raises that by orders of magnitude, and obliges the repository to
carry the attribution that dataset requires."

## Content source and licensing

Entries are curated from `hasaneyldrm/exercises-dataset`
(github.com/hasaneyldrm/exercises-dataset), MIT-licensed for its structured
data, tooling, and instruction text, verified directly against its `LICENSE`
file at commit `7455efae41b330c265e7cd4b78dfa848e7ce5eb`, retrieved
2026-08-24. Only the English `name`, `equipment`, `body_part`, `target`, and
`muscle_group` fields were read. The dataset's images and GIFs are excluded by
a separate "MEDIA EXCEPTION" clause in its own `LICENSE` (© Gym visual,
gymvisual.com, not licensed for reuse by this application) and were never
fetched or referenced — they are out of scope for this specification
regardless of license, per the sprint's media pause.

No instruction text, translation, image, or GIF from the source dataset is
carried into this repository. What is retained is the smallest factual layer —
a name and a classification — re-derived and re-validated against this
catalog's own controlled vocabulary rather than copied structurally.

`docs/third-party-material.md` is updated with this record: source, revision,
retrieval date, exact field scope, and the media exclusion.

## Curation

Of 1,324 source entries, 189 were selected after:

1. mapping the source's `equipment` and `target`/`muscle_group` vocabulary
   onto this catalog's fixed enums (10 equipment values, 13 muscle groups, 8
   logging modes — see `packages/domain/src/workout/exercise-definition.ts`);
2. discarding any entry whose equipment or muscle classification has no
   confident mapping onto that vocabulary, rather than stretching the fit or
   widening the schema;
3. discarding flexibility/stretch content, gendered name variants, and
   version-suffixed duplicates, none of which are exercise definitions this
   catalog logs sets against;
4. discarding ambiguous, incomplete, or non-neutral names (e.g. standalone
   words with no clear movement, joke or brand-adjacent names);
5. capping and balancing the survivors across equipment, muscle group, and
   logging mode so the pack is broad rather than dominated by one category.

Like the starter set, no entry uses the `other` equipment or `other` muscle
group value: `other` is the fallback for what content does not confidently
cover, not content itself. Unlike the starter set, `full-body` is not
independently covered by this pack — the source vocabulary has no full-body
classification, and the starter set already covers it with Burpee, so nothing
here is mischaracterized to claim the label. Every other equipment and muscle
group value the vocabulary defines appears at least once.

No entry carries notes, for the same reason the starter set carries none: a
note is where technique or coaching guidance would creep in. No entry is
favorited.

The content is a product surface. A change to it is an edit to
`apps/mobile/src/features/exercise-catalog/application/expanded-exercises.ts`
and to this specification, reviewed together, exactly as Specification 0027
treats the starter array.

## Identity

Each definition carries a fixed identifier hardcoded as a UUID version 5
literal, generated offline the same way the starter set's are: the namespace
`6ba7b812-9dad-11d1-80b4-00c04fd430c8` plus the entry's normalized name.
Verified disjoint from every starter identifier and from every starter
normalized name by a dedicated content test — the two packs are additive, not
competing, and a person who imports both gets every entry from both.

## Duplicate policy

Identical to Specification 0027: the import skips, never overwrites, and
never refuses the whole set, when an entry's identifier or normalized name is
already held. A second import adds nothing and says so.

**A regression discovered during this sprint changes what "delete then
import" does, for both packs, not only this one.** Specification 0027 states:
"Deleting an imported definition and importing again re-adds it, because
after the deletion the person is asking again." That was true when it was
written. Specification 0042 (schema synchronization readiness) changed
deletion for `exercise_catalog_item` from a hard `DELETE` to a tombstone
(`deleted_at_epoch_ms`), and the import's duplicate-identifier check
(`getByIds`, `findByNormalizedName`) filters to non-deleted rows only. A
re-import therefore attempts to `INSERT` a row whose identifier still
physically exists — deleted or not — and collides with the table's
`PRIMARY KEY`, refusing the _whole_ import (`write-failed`) rather than
reviving the one row. The net effect a person sees is that the deletion
holds — nothing is silently undone — but the refusal is generic rather than a
specific "already deleted" statement, and every other pending addition in
that same import attempt is refused along with it.

This specification does not fix that interaction. Doing so is a design
decision about what "delete, then ask for it again" should mean under
Specification 0042's tombstone model — resurrect the row with a fresh
revision and a new outbox entry, or leave it refused — and belongs to its own
approval-gated change, not a side effect of adding content. It is recorded
here, in `docs/manual-testing/sprint-43-usable-exercise-library.md`, and in a
dedicated real-SQLite test (`expanded-exercise-import-sqlite.spec.ts`) so a
future fix has to notice and deliberately change this behavior rather than
regress it again silently.

## Architecture

```text
ExerciseLibraryScreen (expanded section, both states, beside the starter section)
  -> visible explanation: the count, and that definitions are ordinary
  -> explicit press
  -> AddStarterExercisesUseCase(expandedExercises)  (exercise-catalog/application, reused as-is)
  -> StarterExerciseImportContext                   (one exclusive transaction, shared runner)
  -> ExerciseCatalogRepository                       (getByIds, findByNormalizedName, insert)
  -> refreshed library with a stated result
```

No new use case, repository method, or transaction context was introduced.
`AddStarterExercisesUseCase` already accepted its content as a constructor
parameter; this specification is the second caller of that parameter, not a
parallel mechanism. `apps/mobile/src/composition/exercise-catalog.ts`
constructs a second instance, `addExpandedExercises`, sharing the same
transaction runner the starter import uses, because neither import ever does
anything but add and neither needs the planner reference reader the mutation
context also carries.

## Transaction and rollback

Identical to Specification 0027: every entry is validated through
`buildExerciseCatalogItem` before the transaction opens; the transaction reads
live presence and skips matches; any throw during the write rolls the whole
transaction back and reports `write-failed`. The catalog is exactly as it
was, including every starter, hand-authored, and previously-imported
expanded-pack definition.

## Confirmation and experience

The expanded pack is offered as a second, equally-explicit section directly
beneath the starter section, using a named control with its explanation
visible before the press — never a destructive alert, for the same reasons
Specification 0027 gives. It is additive, not a replacement: the starter
section, its wording, and its behavior are untouched.

The wording says what the pack adds and who owns the result, avoiding
"default", "built-in", "system", "official", and "recommended", for the same
reason Specification 0027's wording does — the application is offering
content, not ranking it above what the person writes themselves, and not
above the starter set either.

After a press the library reloads and states the result in a polite live
region:

- everything added: "Added 189 exercises to your library."
- some skipped: "Added N exercises. M were already in your library and were
  left unchanged."
- nothing to add: "Your library already has all 189 of these exercises.
  Nothing was added."

## Errors

One fixed sentence per refusal, in `presentation/expanded-exercise-messages.ts`,
distinct text from the starter set's so a person (and an E2E assertion) can
tell which import a message describes:

| Refusal           | Sentence                                                      |
| ----------------- | ------------------------------------------------------------- |
| `content-invalid` | The expanded library could not be added. Nothing was changed. |
| `write-failed`    | The expanded library could not be added. Nothing was changed. |

## Data lifecycle

Identical to Specification 0027: the restore precondition, erasure, and
replacement are all untouched, because expanded-pack rows are ordinary
catalog rows with no marker distinguishing them. `ExerciseCatalogExportReader`
emits them in format version 1, unchanged.

## Accessibility

Identical presentation pattern to the starter section: a header, real
explanatory text, an `AppButton` with a matching accessible label, and a
polite live-region announcement of the result.

## Privacy, security, and performance

No network request, no telemetry, no new dependency. The content ships in the
application bundle and is never fetched. One exclusive transaction runs one
identifier query, up to 189 indexed name lookups, and up to 189 single-row
inserts — the same shape as the starter import at roughly seven times the
row count, well within `listAll`'s existing limits and the repository's
existing indexes.

Bundle impact was measured directly: `pnpm build` (`expo export --platform
all`) produces a `.hbc` bundle per platform; comparing one built with this
change against one built without it (same command, same machine) shows the
iOS bundle growing by 18,605 bytes (3,647,998 → 3,666,603) and the Android
bundle by 18,712 bytes (3,931,143 → 3,949,855) — about 18 KB, roughly 0.5% of
either bundle, for 189 additional definitions. No bundle-size measurement
process previously existed in this repository; this comparison is the first
one and is not yet wired into `scripts/qa.sh` or CI.

## Migration and dependencies

No migration. No column, index, trigger, marker, or dependency is added, and
the export format stays version 1.

## Verification and completion

Content tests (`expanded-exercises.spec.ts`) assert the pack holds exactly
189 entries, that every entry builds a valid `ExerciseCatalogItem`, that
identifiers are unique, well-formed, and version 5, that names are unique
after normalization and at most 80 characters, that every entry uses a
vocabulary member other than the `other` fallback, that every equipment value
and every muscle group except `full-body` is reached, that no entry carries
notes or is favorited, and that the pack shares no identifier or normalized
name with the starter set.

Real-SQLite tests (`expanded-exercise-import-sqlite.spec.ts`) assert import
into an empty catalog, that both packs together add their full combined
count in either order, that a second import adds nothing, that both packs
export as ordinary rows, that erasure removes both together, and document the
delete-then-reimport interaction above as a passing, asserted test rather than
an unverified claim.

Presentation tests extend `ExerciseLibraryScreen.spec.tsx` to assert the
expanded section appears beside the starter section, states its own count and
result independently, and that both sections' offers and results stay above
the catalog lists they write.

End-to-end coverage adds a Sprint 43 suite exercising the offer from an empty
library, the stated result across a representative equipment/muscle/logging-mode
spread (verified by search, not scroll, per `e2e/mobile/README.md`'s existing
guidance on populated-catalog navigation), an imported exercise treated as
ordinary data, idempotent repeated import, both packs coexisting without
collision, a hand-authored name preserved and reported as skipped, and
survival across a relaunch.

## Explicit exclusions

Exercise images, illustrations, GIFs, or video; instructions, form cues, or
technique guidance; multilingual content; categories, tags, or filters beyond
what the library already has; content versioning or updates to the pack after
import; downloaded or network-fetched content; AI-generated definitions; a
schema, domain-model, or export-format change; a fix for the delete-then-import
regression this specification documents but does not resolve; a new primary
tab; a generic content-import framework; cloud synchronization; authentication;
backend endpoints; notifications; guided-workout behavior; charts; and any
Progress redesign.
