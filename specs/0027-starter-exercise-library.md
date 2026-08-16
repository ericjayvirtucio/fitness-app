# Specification 0027: Starter exercise library

- Status: Approved
- Date: 2026-08-16

## Objective and scope

Let a person populate an empty Exercise Library with twenty-six recognizable
Exercise Definitions in one deliberate action, so the Workout Planner, Workout
Sessions, Set logging, Personal Records, and Progress are reachable without first
authoring definitions by hand. Version 1 ships the content as code inside the
mobile application, offers it from the Exercise Library in both its empty and its
populated state, and writes the definitions the person does not already hold in
one exclusive transaction after an explicit press.

Every added definition is an ordinary user-owned row from the moment it is
written. It is editable, re-classifiable, favoritable, deletable, and exportable,
and no read model can tell it from a definition the person typed.

Automatic seeding of any kind, a first-run wizard, localization, images,
technique guidance, starter Workout Plans, content updates after an import, a
read-only catalog tier, a provenance column, any schema change, and any export
format change are excluded.

## The problem

A new installation contains nothing. `initializePersistence` runs migrations and
writes no row, so the Exercise Library's first screen is an empty state reading
"No exercises yet" with a single "Create first exercise" control.

Everything the Workout area offers is gated behind that screen. A person must
author an `ExerciseDefinition` — choosing equipment, a primary muscle group, and
a logging mode — before they can add an exercise to a plan, start a session that
holds anything, log a set, earn a personal record, or see a progress number that
is not zero. They must make those three classification choices before they have
any reason to know what they mean.

The repository already pays this cost explicitly in its own test harness:
`e2e/mobile/flows/exercise/create-exercise.yaml` and
`create-alternate-exercise.yaml` exist because no definition exists otherwise,
and forty-six suite files compose the first of them before they can test
anything.

## Why this is not a seed

The product makes three shipped promises that an automatic first-launch seed
would break.

[ADR 0014](../docs/decisions/0014-empty-installation-data-restore.md) restores an
export **only into an installation that holds no user-owned records**. Emptiness
is decided by eight `StoredDataProbe` implementations, and
`ExerciseCatalogStoredDataProbe` probes exactly one table:
`exercise_catalog_item`. One row in it makes the installation non-empty.
`GetRestoreTargetUseCase` would refuse on entry, and `RestoreDataExportUseCase`
would return `target-not-empty` inside the write transaction. A person who
reinstalled the application, holding a complete and valid export, could not
restore it — at the exact moment restore exists for.

[ADR 0015](../docs/decisions/0015-local-data-erasure.md) makes erasure the way a
person reaches an empty installation. A seed that re-applies itself at the next
launch produces an installation that is not empty; a seed that never re-applies
produces a different product than the one the person just used.

[ADR 0016](../docs/decisions/0016-atomic-local-data-replacement.md) replaces
everything in one transaction and verifies the result against the file with
`toExpectedCapabilityPresence`, which reads `exerciseCatalog` presence. Nothing
in that verification can distinguish a seeded row from an authored one.

Repairing any of this requires knowing which rows were seeded and whether the
person has touched them — an origin column, edit tracking, a decision about what
the version 1 export format carries, and an unanswered synchronization question.

Making the act explicit avoids all of it. When the offer is code and the rows are
written only on an explicit press:

- a fresh installation holds zero rows, so the restore precondition is untouched;
- erasure still reaches an empty installation, and the offer is available again
  afterwards **because it was never data**;
- replacement treats imported rows as ordinary rows, because they are;
- no marker, no column, no migration, and no export-format change is needed.

ADR 0014, ADR 0015, and ADR 0016 are therefore unaffected, and this
specification records the decision instead of a ceremonial fourth ADR.

## Ownership authority

An imported definition is an ordinary Exercise Definition from the moment it is
written. It is not read-only, not privileged, not undeletable, and not
distinguishable in any read model. Nothing in the application branches on where a
definition came from.

[ADR 0008](../docs/decisions/0008-historical-workout-session-snapshots.md) is
unaffected. A Workout Session still copies the exercise name and logging mode
when the exercise enters the session, `source_exercise_definition_id` remains
non-relational provenance, and history keeps reading its own snapshots. An
imported definition that is later renamed or deleted behaves exactly as an
authored one does.

Silent creation stays forbidden. No migration, background task, application
start, failed restore, failed replacement, or erasure may create an Exercise
Definition. Only an explicit press may.

## The content

Twenty-six definitions ship in
`apps/mobile/src/features/exercise-catalog/application/starter-exercises.ts` as a
frozen array of plain data. Every entry carries no notes and is not favorited.

| Name                       | Equipment       | Primary muscle group | Logging mode                         |
| -------------------------- | --------------- | -------------------- | ------------------------------------ |
| Push-up                    | bodyweight      | chest                | bodyweight-and-repetitions           |
| Pull-up                    | bodyweight      | back                 | bodyweight-and-repetitions           |
| Chin-up                    | bodyweight      | biceps               | bodyweight-and-repetitions           |
| Dip                        | bodyweight      | triceps              | bodyweight-and-repetitions           |
| Bodyweight Squat           | bodyweight      | quadriceps           | bodyweight-and-repetitions           |
| Lunge                      | bodyweight      | glutes               | bodyweight-and-repetitions           |
| Calf Raise                 | bodyweight      | calves               | bodyweight-and-repetitions           |
| Sit-up                     | bodyweight      | core                 | bodyweight-and-repetitions           |
| Weighted Pull-up           | bodyweight      | back                 | bodyweight-plus-load-and-repetitions |
| Assisted Pull-up           | machine         | back                 | assistance-and-repetitions           |
| Barbell Back Squat         | barbell         | quadriceps           | external-load-and-repetitions        |
| Barbell Deadlift           | barbell         | hamstrings           | external-load-and-repetitions        |
| Barbell Bench Press        | barbell         | chest                | external-load-and-repetitions        |
| Barbell Overhead Press     | barbell         | shoulders            | external-load-and-repetitions        |
| Barbell Row                | barbell         | back                 | external-load-and-repetitions        |
| Dumbbell Lateral Raise     | dumbbell        | shoulders            | external-load-and-repetitions        |
| Dumbbell Biceps Curl       | dumbbell        | biceps               | external-load-and-repetitions        |
| Dumbbell Romanian Deadlift | dumbbell        | hamstrings           | external-load-and-repetitions        |
| Kettlebell Swing           | kettlebell      | glutes               | external-load-and-repetitions        |
| Cable Triceps Pushdown     | cable           | triceps              | external-load-and-repetitions        |
| Machine Leg Press          | machine         | quadriceps           | external-load-and-repetitions        |
| Resistance Band Row        | resistance-band | back                 | external-load-and-repetitions        |
| Burpee                     | none            | full-body            | repetitions                          |
| Plank                      | bodyweight      | core                 | duration                             |
| Stationary Bike            | cardio-machine  | conditioning         | distance                             |
| Run                        | none            | conditioning         | distance-and-duration                |

Twenty-six is the smallest set that reaches the coverage this specification
requires, and each further name is another row a person may have to scroll past
or delete.

- **All eight logging modes are represented**, so no logging mode requires
  authoring a definition to reach.
- **Nine of ten equipment values are represented.** `other` is deliberately
  absent: it is the fallback for what content does not cover, not content.
- **Twelve of thirteen primary muscle groups are represented**, `other` absent
  for the same reason.
- **Ten definitions need no equipment at all** — the first nine plus Plank —
  covering chest, back, biceps, triceps, quadriceps, glutes, calves, and core, so
  a person with no equipment can plan and log a full week.

Names are recognizable, unbranded, non-trademarked, and chosen to be unambiguous
across regions where a movement has more than one common name. No entry carries
notes, because notes are where technique, physiological, or programming guidance
would creep in; their absence is asserted by a test rather than left to judgment.
Nothing is favorited, because a favorite is the person's own statement.

The content is a product surface. A change to it is an edit to that one file and
to this specification, reviewed together.

## Identity

Each definition carries a fixed identifier hardcoded as a UUID version 5 literal,
derived offline from the URL namespace `6ba7b812-9dad-11d1-80b4-00c04fd430c8` and
the definition's normalized name. Nothing is hashed at runtime, so no dependency
is added.

Stable identifiers mean the same starter exercise means the same thing across
installations, which matters for comparing exports, for restoring an export taken
from an installation that imported, and for eventual synchronization, where a
per-installation identifier would make one movement look like many.

A fixed identifier cannot collide with a generated one. `expo-crypto`'s
`randomUUID` emits version 4, which carries `4` in the version position; these
carry `5`. The two spaces are disjoint by construction, and `DomainId` accepts
both.

The identifiers are, in principle, recognizable to somebody reading the database
file directly. No code reads them, no read model branches on them, and nothing in
the product treats such a row differently. Any scheme that gives one exercise one
meaning across devices has this property.

## Duplicate policy

The import **skips**, never overwrites, and never refuses the whole set.

A starter entry is skipped when the catalog already holds a definition with

- the same normalized name, or
- the same identifier.

Both tests are needed. The first covers a person who authored "Push-up" by hand.
The second covers a person who restored an export taken from an installation that
had imported and then renamed one of the definitions: the identifier is present
under a different name, and only the identifier test sees it.

Skipping rather than adding anyway is correct because `exercise_catalog_item` has
no unique constraint on `normalized_name` and the editor deliberately lets a
person save a second definition with a name already in use. Adding anyway would
hand the person duplicate rows they did not ask for. Refusing the whole import is
wrong because one hand-authored name would block twenty-five useful ones.

A second import adds nothing and says so. Deleting an imported definition and
importing again re-adds it, because after the deletion the person is asking
again; remembering the deletion would require exactly the hidden state this
design refuses.

Nothing skipped is ever reported as added.

## Architecture

The workflow belongs to `exercise-catalog`.

```text
ExerciseLibraryScreen (starter section, both states)
  -> visible explanation: the count, and that definitions are ordinary
  -> explicit press
  -> AddStarterExercisesUseCase           (exercise-catalog/application)
  -> StarterExerciseImportContext         (one exclusive transaction)
  -> ExerciseCatalogRepository            (getByIds, findByNormalizedName, insert)
  -> refreshed library with a stated result
```

The content lives in the application layer of the capability that owns the
catalog. It is not in `packages/domain`, because it is product content rather
than a domain rule: the domain owns the vocabularies, and the content is one
valid arrangement of them with no invariant of its own. It is not in the
database, because that is the seed this specification rejects. It is not fetched,
and it is not embedded in a screen component.

Every entry is validated through the same path any definition takes:
`buildExerciseCatalogItem` calls `DomainId.create`, `ExerciseDefinition.create`,
and `ExerciseCatalogItem.create`. There is no second creation path, and the
domain's equipment and logging-mode compatibility rule applies to the content
exactly as it applies to a typed one.

The repository contract is unchanged. `getByIds`, `findByNormalizedName`, and
`insert` are sufficient, and every statement runs against an index created in
migration 7. A bulk insert would add a method for one caller with its own
atomicity story, which twenty-six rows do not justify.

## Transaction and rollback

The import is atomic: either every definition it decided to add exists, or none
does.

1. **Before the transaction opens**, every entry is built through
   `buildExerciseCatalogItem`. Any failure refuses the whole import with
   `content-invalid`, having opened nothing.
2. One exclusive transaction begins through `SqliteTransactionRunner`, which
   delegates to `DatabaseConnection.runExclusive`.
3. Inside it, `getByIds` reads which starter identifiers are already present.
4. Inside it, `findByNormalizedName` is called once per entry.
5. An entry whose identifier or normalized name is present is skipped.
6. The surviving items are inserted in content order.
7. The counts are returned and the transaction commits.

Presence is read inside the transaction and never trusted from a previous screen
read, for the same reason `RestoreDataExportUseCase` rechecks emptiness inside
its own write transaction: a row can be created between a screen's read and a
press.

Any throw inside steps 3 to 6 rolls the whole transaction back, and the use case
returns `write-failed`. The catalog is exactly as it was, including every
hand-authored definition.

## Stale state and repeated submission

The control is disabled while a request is in flight, so a double press cannot
open two transactions. Two overlapping imports are serialized by
`runExclusive`, and the second reads the first's committed rows and skips them,
so the worst outcome is a truthful "nothing was added".

Stale screen state cannot cause a wrong write, because the skip decision is made
inside the transaction from live rows rather than from the list on screen. If the
screen unmounts mid-write, the transaction still commits or rolls back; the next
focus reload shows the true catalog.

## Confirmation and experience

Adding starter exercises creates data and destroys nothing, and every added row
is deletable through the existing `DeleteExerciseUseCase`. It therefore uses a
named control with the explanation visible **before** the press, not a
destructive alert. This follows Specification 0026, where adding an exercise to a
completed Workout — a change to recorded history — deliberately uses an
explanatory screen rather than an alert. Alerts in this repository belong to acts
that destroy.

The Exercise Library renders a starter section in both its empty and its
populated state, immediately above the existing "Create exercise" control. The
empty state keeps its own "Create first exercise" action unchanged, so a person
who wants to author their own is not pushed into the starter set; the two are
offered side by side. Rendering the section in both states keeps the offer
reachable after erasure and for a person who authored a definition or two and
then wants the rest, and keeps one code path rather than two.

The section states how many definitions will be added, that they behave exactly
like definitions the person creates, that they can be renamed, changed, or
deleted, and that definitions already held are left alone.

After a press the library reloads through the same path focus uses, and the
result is stated in a polite live region:

- everything added: "Added 26 exercises to your library."
- some skipped: "Added N exercises. M were already in your library and were left
  unchanged."
- nothing to add: "Your library already has all 26 starter exercises. Nothing was
  added."

Counts come from the outcome, never from the length of the content array.

The wording says "starter exercises". It does not say default, built-in, system,
official, or recommended, and it does not imply the application endorses these
movements or that they are more legitimate than definitions the person writes.

## Errors

One fixed sentence per refusal, in
`presentation/starter-exercise-messages.ts`. Nothing interpolates a name, an
identifier, a table, a statement, or a path, so a failure cannot leak the catalog
it protects.

| Refusal               | Sentence                                                       |
| --------------------- | -------------------------------------------------------------- |
| `content-invalid`     | Starter exercises could not be added. Nothing was changed.     |
| `write-failed`        | Starter exercises could not be added. Nothing was changed.     |
| `storage-unavailable` | Your exercises are unavailable right now. Nothing was changed. |

## Derived behavior

Nothing derived is persisted. After an import:

- the Exercise Library lists the added definitions in the order it already uses,
  `normalized_name` then `id`;
- search and favorites work against them with no special case;
- the Workout Planner references them like any definition, including
  `ON DELETE RESTRICT` and the trigger that prevents a logging-mode change on a
  referenced definition;
- a Workout Session adds and snapshots them under ADR 0008 unchanged;
- the Exercise Picker's recents-first behavior is unchanged in logic; its
  whole-catalog fallback now has content, which changes what a person sees but
  not what the code does;
- Personal Records, Progress, per-exercise history, and the performed-exercise
  list are unaffected until work is actually recorded, because every one of them
  derives from completed sessions rather than from the catalog;
- the next version 1 export includes them as ordinary catalog rows;
- externally saved exports are unchanged.

## Data lifecycle

- **Restore.** The precondition is untouched. An installation that has not
  imported holds no rows and still restores. An installation that has imported is
  refused, identically to one where the person authored the same definitions by
  hand.
- **Erasure.** `ExerciseCatalogDataEraser` removes imported definitions like any
  other row, the installation reaches empty, and the offer is available again
  afterwards because it is code.
- **Replacement.** Imported rows are deleted and replaced like any other, and
  presence verification is unchanged.
- **Export.** `ExerciseCatalogExportReader` emits them as ordinary rows in
  format version 1.

## Accessibility

The starter section carries a header, real explanatory text rather than a
tooltip, and an `AppButton` whose accessible label matches its visible label. The
result is announced through a polite live region. Nothing is conveyed by icon or
colour alone, text scales with Dynamic Type, and the control meets the minimum
touch target the design system enforces.

## Privacy, security, and performance

The import runs only on an explicit press. It performs no network request, adds
no telemetry, analytics, AI, permission, or dependency, and reads nothing about
the person to decide what to write. The content ships in the application bundle
and is never fetched. Every SQL parameter is bound. No refusal sentence carries
internal detail, and nothing sensitive is logged.

One short exclusive transaction runs a single identifier query, twenty-six
indexed name lookups, and at most twenty-six single-row inserts. No index,
worker, or persisted summary is added, and `listAll`'s default limit of 100 is
comfortably above the set size.

## Localization

English only for version 1. A later localization would need translated display
names that leave identifiers untouched, because identity is the identifier and
not the name; a rule that an already-imported definition's name never changes
with the device language, because by then it is the person's own row; and a
normalized-name collision policy across languages. Naming those constraints now
is what makes the change possible later.

## Migration and dependencies

No migration. The schema stays at `user_version` 11 with eleven migrations. No
column, index, trigger, marker, or dependency is added, and the export format
stays version 1.

## Verification and completion

Content tests assert that every entry builds a valid `ExerciseCatalogItem`, that
identifiers are unique and well-formed, that names are unique after
normalization, that all eight logging modes appear, that every equipment and
muscle-group value is a vocabulary member, that no entry carries notes or is
favorited, and that the set holds exactly twenty-six entries.

Application tests assert that an empty catalog receives everything, that a
partially populated one skips exactly the matching names and reports the counts,
that a fully populated one reports that nothing was added, that a second import
adds nothing, that an entry is skipped by identifier when the name differs, that
invalid content refuses without any write, that a write failure preserves the
catalog, that refusals translate to fixed sentences, and that nothing is
favorited.

Integration tests run against a real SQLite engine with the repository's own
migrations and assert the import into an empty catalog, every stored column, that
none is favorited, that a hand-authored definition sharing a name is untouched
while the starter one is skipped, that a second import adds nothing, that a
forced failure mid-import rolls back to exactly the previous catalog, that no
other table is written, that an imported definition updates and deletes through
the existing use cases, that a session snapshot survives that definition's
deletion, that the export reader emits imported definitions as ordinary rows, and
that `user_version` is unchanged. Failures are injected through a test-owned
`DatabaseConnection` decorator, never through a production switch or a hidden
route.

Presentation tests assert that the empty state offers both authoring and
importing, that the explanation states the count and that definitions are
ordinary and editable, that the result states what was added and what was
skipped, that repeated submission is disabled, that a failure states nothing was
changed, that labels and the announcement are accessible, and that an imported
definition can immediately be renamed, favorited, and deleted.

End-to-end coverage adds a Sprint 27 suite and regression scenario 21 exercising
the offer from an empty library, the stated result, renaming and deleting an
imported definition, a second import that adds nothing, a hand-authored name
preserved and reported as skipped, a workout planned and completed against an
imported definition without authoring anything, and survival across a relaunch.

The starter import is a product feature, not a test fixture. It must never become
a way for the harness to skip a public screen, and the existing authoring flows
stay, because they are the only automated proof that a person can still write a
definition by hand.

## Explicit exclusions

Automatic seeding of any kind, onboarding or first-run wizards, profile setup
prompts, localization or translated content, exercise images, illustrations or
video, instructions, form cues or technique guidance, categories, tags, or
filters beyond what the library already has, recommended or suggested workouts,
starter Workout Plans, content versioning or updates to the starter set after
import, downloaded content, AI-generated definitions, a read-only or system-owned
catalog tier, an origin or provenance column, export format changes, cloud
synchronization, authentication, backend endpoints, notifications, new personal
record categories, charts, and any Progress redesign.
