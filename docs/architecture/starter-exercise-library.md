# Starter exercise library architecture

## Boundary and ownership

The starter exercise import belongs to `exercise-catalog`. It adds Exercise
Definitions the person did not have to author, and it adds nothing else.

```text
ExerciseLibraryScreen (starter section, both states)
  -> visible explanation: the count, and that definitions are ordinary
  -> explicit press
  -> AddStarterExercisesUseCase
  -> StarterExerciseImportContext (one exclusive transaction)
  -> ExerciseCatalogRepository (getByIds, findByNormalizedName, insert)
  -> refreshed library with a stated result
```

Files:

- `application/starter-exercises.ts` — the content, as frozen plain data.
- `application/starter-exercise-import-context.ts` — the catalog, and nothing
  else, inside the transaction.
- `application/add-starter-exercises-use-case.ts` — validation, skip decision,
  transaction, outcomes.
- `presentation/starter-exercise-messages.ts` — the explanation, the result
  sentences, and one fixed sentence per refusal.
- `presentation/ExerciseLibraryScreen.tsx` — the section and its live region.
- `composition/exercise-catalog.ts` — the transaction runner it is given.

## Why an explicit import and not a seed

This is the decision the design rests on, and it is not a preference.

`ExerciseCatalogStoredDataProbe` probes exactly one table,
`exercise_catalog_item`, through `hasStoredRows`. Restore refuses into any
installation whose probes report a row, both on screen entry
(`GetRestoreTargetUseCase`) and again inside the write transaction
(`RestoreDataExportUseCase`). A first-launch seed would therefore make every
fresh installation non-empty, and a person reinstalling the application with a
valid export in hand could not restore it.

Erasure reaches an empty installation through the same probes. A seed that
re-applies at the next launch leaves an installation that is not empty; a seed
that never re-applies changes the product after the person erases it.

Because the offer is code rather than data, none of that happens. A fresh
installation holds nothing until the person presses the control, erasure returns
to nothing, and the offer is still there afterwards. See
[ADR 0014](../decisions/0014-empty-installation-data-restore.md),
[ADR 0015](../decisions/0015-local-data-erasure.md), and
[ADR 0016](../decisions/0016-atomic-local-data-replacement.md), none of which
this capability changes, and
[Specification 0027](../../specs/0027-starter-exercise-library.md).

## Content

Twenty-six definitions covering all eight logging modes, nine of ten equipment
values, and twelve of thirteen muscle groups, with ten that need no equipment at
all. `other` is absent from both vocabularies on purpose: it is the fallback for
what content does not cover.

Nothing carries notes, and nothing is favorited. Both are asserted by
`starter-exercises.spec.ts` rather than left to review, because notes are where
technique or programming guidance would creep in and a favorite is the person's
own statement.

Identifiers are UUID version 5 literals derived offline from the URL namespace
`6ba7b812-9dad-11d1-80b4-00c04fd430c8` and each entry's normalized name. Nothing
is hashed at run time. They cannot collide with a definition the person creates,
because `expo-crypto` emits version 4.

## Ownership of what it writes

An imported definition is an ordinary catalog row from the moment it exists. It
is editable, re-classifiable, favoritable, deletable, and exportable, and no read
model distinguishes it. Nothing branches on where a definition came from, and no
column, marker, or tier records it.

[ADR 0008](../decisions/0008-historical-workout-session-snapshots.md) is
unaffected: a session copies the name and logging mode when the exercise enters
it, `source_exercise_definition_id` stays non-relational provenance, and a
snapshot survives the definition's deletion.

## Duplicates

An entry is skipped when the catalog already holds its normalized name or its
identifier. The name test covers a person who authored "Push-up" by hand; the
identifier test covers one who restored an export from an installation that
imported and then renamed it.

Skipping rather than adding anyway matters because `exercise_catalog_item` has
no unique constraint on `normalized_name` — the editor deliberately lets a
person save a second definition under a name already in use — so adding anyway
would create rows nobody asked for.

## Transaction

Items are built through `buildExerciseCatalogItem` **before** the transaction
opens, so invalid content refuses without a write having started. Inside one
exclusive transaction the import reads which identifiers are present, checks each
normalized name, and inserts the survivors in content order. Presence is read
inside the transaction rather than trusted from the screen, because a definition
can be created between a read and a press.

Any throw rolls the whole transaction back and the use case returns
`write-failed`. `starter-exercise-import-sqlite.spec.ts` proves this on a real
engine with a test-owned `DatabaseConnection` decorator; the application has no
failure switch.

## Experience

The library renders the section in both states, above "Create exercise". The
empty state keeps its own "Create first exercise" action, so authoring is offered
beside importing rather than replaced by it.

No destructive alert. The act creates data and destroys nothing, and every row it
writes is deletable, so it follows the additive precedent set by completed
workout exercise addition: a named control with the explanation visible before
the press.

The result is stated in a polite live region and counts come from the outcome, so
a skipped definition can never be reported as added. The library updates in
place, which keeps the result on screen and announced.

## Performance

One short exclusive transaction: one identifier query, twenty-six indexed name
lookups, at most twenty-six single-row inserts, all against indexes migration 7
created. No migration, index, worker, or persisted summary is added, and
`user_version` stays 11.
