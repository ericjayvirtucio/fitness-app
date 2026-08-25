# Specification 0044: A deleted exercise pack definition can be deliberately added again

> Testing-policy note: this specification's testing plan already follows
> [ADR 0033](../docs/decisions/0033-risk-based-manual-device-testing.md).
> Use command-line Jest/Vitest checks plus risk-based manual device testing.
> No Maestro, simulator, emulator, or automated UI suite is introduced.

- Status: Approved
- Date: 2026-08-25

## Objective and scope

Let a person who deleted a starter or expanded-pack exercise definition bring
it back by explicitly requesting that pack again, without discarding any
edit they made to it before deleting it, and without refusing the rest of
that same import.

Sprint 43 ([Specification 0043](0043-expanded-exercise-library.md))
recorded a regression and deliberately left it unresolved: once
[Specification 0042](0042-schema-synchronization-readiness.md) turned
deletion into a tombstone (`deleted_at_epoch_ms`) rather than a hard delete,
re-importing a pack that contained a definition the person had since deleted
collided with that row's still-present primary key and refused the whole
import (`write-failed`) instead of reviving the one row. This specification
resolves that interaction. It does not change pack content, add a general
restoration or undo feature, or touch synchronization, migration, or schema.

## Current failure — verified root cause

The collision is in `AddStarterExercisesUseCase.execute` /
`importInto` (`apps/mobile/src/features/exercise-catalog/application/add-starter-exercises-use-case.ts`),
which both packs share as their only import path
(`composition/exercise-catalog.ts`'s `addStarterExercises` and
`addExpandedExercises`, both constructed from the same class).

1. `importInto` reads presence with
   `ExerciseCatalogRepository.getByIds` and `.findByNormalizedName`.
2. Both are implemented in `ExerciseCatalogSqliteRepository`
   (`apps/mobile/src/features/exercise-catalog/infrastructure/exercise-catalog-sqlite-repository.ts`)
   with `WHERE ... AND deleted_at_epoch_ms IS NULL` — deliberately, so an
   ordinary read never surfaces a tombstoned row. `getById` carries the same
   clause.
3. A definition the person deleted therefore reads as absent by both checks,
   so `importInto` places it in `additions` alongside genuinely new
   definitions.
4. The write loop calls `catalog.insert(item)` for every entry in
   `additions`. `insert` executes
   `INSERT INTO exercise_catalog_item (id, ...) VALUES (?, ...)` with `id`
   as the table's `PRIMARY KEY`. The tombstoned row's `id` still physically
   exists, so the `INSERT` violates the primary key and the driver throws.
5. `SqliteTransactionRunner` runs the whole `importInto` call inside one
   exclusive transaction; the throw propagates out of `catalog.insert`,
   out of `importInto`, out of `transactionRunner.run`, and is caught only
   in `AddStarterExercisesUseCase.execute`'s outer `try`/`catch`, which
   returns `{ reason: 'write-failed', status: 'refused' }`.
6. Because the whole transaction rolled back, every other definition in the
   same `additions` batch — definitions that were genuinely absent and would
   otherwise have inserted cleanly — is refused along with the one that
   collided. Nothing partial is written; the deletion holds; but the
   message is a generic write failure rather than anything specific to the
   one colliding identifier, and the person's explicit request to add the
   pack again accomplishes nothing.
7. Both packs share this exact call path with different content only
   (`starterExercises` vs. `expandedExercises`), so the failure is
   identical for both, as Specification 0043 already noted.

## Chosen option

**Option A — restore matching tombstones.** The pack request is already a
deliberate, person-initiated action (an explicit press behind explanatory
text, per Specification 0027), and Specification 0027 originally promised
that "deleting an imported definition and importing again re-adds it." This
option keeps that promise under the tombstone model instead of introducing a
new confirmation step (Option D) or a permanently-refusing behavior (Options
B and C) for something the person is already asking for a second time.

Rejected alternatives:

- **Option B (skip tombstones)** would make deletion irreversible through
  the only mechanism (a second import) that Specification 0027 designed to
  reverse it, silently changing a documented product promise.
- **Option C (refuse with a specific message)** improves the message but
  still leaves the person unable to get back a definition they are
  explicitly asking for, and still refuses unrelated genuinely-absent
  definitions in the same request unless it is also taught to partially
  succeed — at which point it is most of Option A's complexity without
  Option A's benefit.
- **Option D (ask for confirmation)** adds a dialog Specification 0027 and
  0043 both deliberately avoid ("never a destructive alert") for an action
  that is already explicit and whose consequence (bringing back exactly what
  the person deleted) is not destructive.

## Resurrection semantics

Explicit consent to add the definition again is consent to bring the row
back, not consent to discard what the person had already changed on it. A
resurrected row is undeleted in place rather than reinserted from the
bundled content:

| Field                                       | Behavior on restore                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                        | Unchanged — the same physical row, same stable identifier.                                                                                                                                                                                                                                                                                |
| `display_name` / `normalized_name`          | Unchanged — whatever the person last had stored, including a rename.                                                                                                                                                                                                                                                                      |
| `equipment`                                 | Unchanged — including a re-classification made before deletion.                                                                                                                                                                                                                                                                           |
| `logging_mode`                              | Unchanged.                                                                                                                                                                                                                                                                                                                                |
| `primary_muscle_group`                      | Unchanged.                                                                                                                                                                                                                                                                                                                                |
| `notes`                                     | Unchanged.                                                                                                                                                                                                                                                                                                                                |
| `is_favorite`                               | Unchanged — a favorite made before deletion survives.                                                                                                                                                                                                                                                                                     |
| `deleted_at_epoch_ms`                       | Cleared to `NULL`. This is the only column the resurrect is ever "about."                                                                                                                                                                                                                                                                 |
| `revision`                                  | Incremented from its current value, exactly as any other mutation increments it — never reset to 1.                                                                                                                                                                                                                                       |
| `updated_at_epoch_ms`                       | Set to the current time on the device performing the restore.                                                                                                                                                                                                                                                                             |
| `originating_device_id`                     | Unchanged — stays the device that first created the row, matching `update`, `setFavorite`, and `delete`, none of which touch it either.                                                                                                                                                                                                   |
| Outbox                                      | A `sync_outbox` row for `(exercise_catalog_item, id)` is upserted with `operation = 'upsert'`, the new `revision`, and the new `queued_at_epoch_ms`, replacing any pending `delete` entry the deletion queued — the outbox's `ON CONFLICT (table_name, row_id) DO UPDATE` primary key already collapses this correctly with no new logic. |
| References from plans, sessions, or history | Untouched. A plan or a completed-workout snapshot references the row by `id`, which never changed; nothing about restoration is visible to them.                                                                                                                                                                                          |

Restoration does not merge bundled and stored values and does not restore
the bundled definition exactly — it restores exactly what was stored. A
definition that was never edited comes back identical to the bundled
content only because that is what was stored.

## Collision matrix

| Case                                                                               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identifier and normalized name both absent                                         | Inserted.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Identifier exists as a live row                                                    | Skipped (unchanged) — the existing live-identifier check.                                                                                                                                                                                                                                                                                                                                                                                                            |
| Identifier exists as a tombstone                                                   | Restored in place.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Normalized name matches a live hand-authored row with a different identifier       | Skipped (unchanged) — the existing live-name check; the hand-authored row is never touched.                                                                                                                                                                                                                                                                                                                                                                          |
| Normalized name matches a tombstoned hand-authored row with a different identifier | Not reachable for bundled content: a bundled identifier is a UUID v5 hash of its own normalized name, so two bundled entries never share a name under different identifiers, and a hand-authored identifier is UUID v4 and can never equal a bundled UUID v5. The bundled entry inserts (or restores under its own identifier if it was separately deleted); the unrelated tombstoned hand-authored row is untouched by this import, exactly as a live one would be. |
| Identifier and normalized-name matches refer to different rows                     | Not reachable for the reason above — an identifier match and a name match for one bundled entry always resolve to the same physical row.                                                                                                                                                                                                                                                                                                                             |
| Multiple tombstoned pack definitions in one import                                 | Each is restored independently in the same transaction.                                                                                                                                                                                                                                                                                                                                                                                                              |
| Live, tombstoned, and absent definitions together                                  | Live ones are skipped, tombstoned ones are restored, absent ones are inserted, all in one transaction; the result names only the added count (insert + restore combined) and the skipped count.                                                                                                                                                                                                                                                                      |
| Starter and expanded packs imported in either order                                | Unaffected — each pack's own identifiers are disjoint from the other's (Specification 0043's identity guarantee), so one pack's restore or insert never interacts with the other's rows.                                                                                                                                                                                                                                                                             |
| An import requested twice in quick succession                                      | Unaffected by this change — the existing in-flight guard (the control is disabled while a write is active, Specification 0027) still allows only one request to reach the transaction.                                                                                                                                                                                                                                                                               |

## Architecture

```text
AddStarterExercisesUseCase.execute (application/add-starter-exercises-use-case.ts)
  -> importInto (unchanged read phase: getByIds, findByNormalizedName)
  -> for each addition:
       catalog.restore(id)   -- new: undeletes a matching tombstone in place
         | true  -> counted as added, no insert
         | false -> catalog.insert(item)   -- unchanged
  -> ExerciseCatalogRepository.restore   (application/exercise-catalog-repository.ts, new member)
  -> ExerciseCatalogSqliteRepository.restore (infrastructure/exercise-catalog-sqlite-repository.ts)
       -- existence check against a tombstoned row, then
       -- UPDATE ... SET deleted_at_epoch_ms = NULL, updated_at_epoch_ms = ?, revision = revision + 1
       -- WHERE id = ? AND deleted_at_epoch_ms IS NOT NULL
       -- queueOutboxEntry(..., 'upsert', revision, now)
```

`restore` is one narrowly named repository-port member, not a general
data-import framework or a second creation path: it only ever undeletes a
row the catalog already physically holds, using the same
`deleted_at_epoch_ms IS NOT NULL` existence check every other tombstone-aware
statement in this repository already uses. It is not exposed through
`listAll`, `search`, `getById`, `getByIds`, or `findByNormalizedName`, all of
which keep excluding tombstoned rows exactly as before — restoration is
reachable only from the deliberate, explicit pack-import path, never from an
ordinary read.

No repository-level "reconciliation" operation, generic upsert-by-content
method, or new transaction context was introduced.
`StarterExerciseImportContext` is unchanged; `restore` is called through the
same `catalog` member the import already had.

## Transaction and atomicity

Identical transaction boundary to Specification 0027 and 0043: the entire
`importInto` call — the read phase and every restore or insert in the write
phase — runs inside the one exclusive transaction
`SqliteTransactionRunner` already opens for this use case. Any throw,
whether from a genuinely-new insert or from a restore, propagates out of
`importInto` uncaught, and `SqliteTransactionRunner` rolls the whole
transaction back. The catalog, every row's synchronization metadata, and the
outbox are left exactly as they were before the request — including a
tombstone that was mid-restore, which reverts to still being a tombstone.

This is proven with real SQLite, not a mock: `starter-exercise-import-sqlite.spec.ts`
injects a failure into the specific `UPDATE ... SET deleted_at_epoch_ms = NULL`
statement partway through a batch that already wrote other rows
successfully earlier in the same transaction, and asserts every row is
byte-for-byte identical to the pre-attempt state afterward.

## Synchronization readiness

Restoration is an ordinary local mutation under the Sprint 42 model, not a
new operation kind:

- It reuses the existing `sync_outbox` upsert path
  (`queueOutboxEntry`, already used by `insert`, `update`, `setFavorite`,
  and `delete`) with `operation = 'upsert'` — a future sync consumer sees a
  changed row with a higher revision, exactly as it would after any other
  edit, and does not need to know the row was ever deleted.
- The outbox's own `PRIMARY KEY (table_name, row_id)` with
  `ON CONFLICT ... DO UPDATE` already replaces a pending `delete` entry from
  the earlier deletion with the restore's `upsert` entry — no new outbox
  logic, and no risk of both a `delete` and an `upsert` entry coexisting for
  the same row.
- `revision` advances by exactly one, from whatever value the tombstoned row
  already carried — never resets to 1 — so a future sync's revision
  comparison sees monotonic history, not a fabricated "new" row.
- `originating_device_id` is left untouched, matching every other mutation
  method on this repository, so a future sync still attributes row
  creation to the device that actually created it.
- No schema, migration, trigger, or index change is required: the tombstone
  column, the revision column, the device-identity column, and the outbox
  table all already exist from Specification 0042 (migration 12). This
  specification only adds application and infrastructure code that uses
  them differently.

Synchronization itself — transmitting the outbox, reconciling with a server,
or resolving conflicts — remains out of scope, exactly as it has been since
Specification 0042.

## UX and accessibility

No new result state and no new message. A restored definition is counted in
the same `addedCount` the existing `imported` outcome already reports;
`starterExerciseImportedMessage` / `expandedExerciseImportedMessage`
(`presentation/starter-exercise-messages.ts`,
`presentation/expanded-exercise-messages.ts`) already render "Added N
exercises..." through the same accessible, polite live-region announcement
Specification 0027 and 0043 built, already distinguish the starter and
expanded sections, and already disable the control while the write is in
flight. Nothing here implies the wording ever claimed deletion was
automatically reversed — it says a count was added, which is what happened.
No presentation code changes; see the affected-files list.

## Data lifecycle impact

No export, restore, replacement, or erasure code changes:

- **Export** (`ExerciseCatalogExportSqliteReader`) already reads only live
  rows and already carries no pack marker; a restored row is an ordinary
  live row the next time it is read, indistinguishable from one that was
  never deleted.
- **Restore onto an empty installation** and **replacement** already write
  through the same repository this specification changes; neither path
  reads or writes a tombstone directly, so both are unaffected.
- **Erasure** already removes every row, tombstoned or not, and clears the
  outbox unconditionally; a resurrected row is erased exactly like any
  other.
- **Stored-data presence** (`ExerciseCatalogStoredDataProbe`) is unaffected;
  it already answers based on any row's existence, not on this import path.

Preserved invariants: a fresh installation stays empty until an explicit
import; erasure returns to that empty state; imported and restored
definitions are ordinary user-owned rows a person can rename, favorite, or
delete; exports carry no pack marker; user-created live definitions are
never overwritten by a pack import; unrelated records are never touched.

## Testing

- **Application-level (Jest, fake repository):**
  `add-starter-exercises-use-case.spec.ts` — the restore/insert/skip branch
  for a single mixed request, and that a failing restore rolls the whole
  batch back, including additions written earlier in the same call.
- **Repository-level (Jest, mocked connection):**
  `exercise-catalog-sqlite-repository.spec.ts` — `restore` is a no-op that
  issues no write when the identifier is not a tombstone; a matching
  tombstone is undeleted with only `deleted_at_epoch_ms`,
  `updated_at_epoch_ms`, and `revision` touched (asserted by statement
  shape, not just outcome); an outbox upsert is queued with the row's new
  revision; a driver failure is translated the same way every other method
  translates one.
- **Real-SQLite (Jest):** `starter-exercise-import-sqlite.spec.ts` proves,
  against the repository's own migrations, that a resurrect restores an
  edited name/equipment/favorite/notes exactly, advances `revision` from its
  pre-deletion value (not reset to 1), leaves `originating_device_id` as the
  device that first created the row even when a second device performs the
  restore, writes exactly one outbox row with the new revision, inserts no
  duplicate row for the identifier, and rolls back every write in a mixed
  batch — including insertions that already succeeded — when the restore
  fails. `expanded-exercise-import-sqlite.spec.ts` confirms the same
  resolution for the expanded pack, since the mechanism is shared.
- Not proposed: Maestro, simulator, emulator, or any automated UI
  sprint/regression suite. Coverage percentage is not a completion gate.

## Documentation

- This specification.
- Specification 0043's "Duplicate policy" section, amended with a pointer
  to this specification's resolution rather than restating it.
- `docs/architecture/starter-exercise-library.md` and
  `docs/architecture/offline-exercise-catalog.md`, whose notes describing
  the regression as open are corrected to describe the resolution.
- `docs/manual-testing/sprint-43-usable-exercise-library.md`'s "Delete then
  import" check and its note, and its sync-metadata check, updated to
  describe field-preserving resurrection instead of a generic refusal.

No ADR is required. This specification does not establish a new durable
cross-capability rule; it correctly implements a rule Specification 0027
already stated and Specification 0042's tombstone model already implied —
that an explicit re-request is consent to undo a deletion on that one row —
using metadata and outbox mechanics ADR 0032 and Specification 0042 already
established.

## Explicit exclusions

No recycle bin, deleted-items screen, or undo-history UI. No restoration
outside an explicit pack-import request — nothing is restored automatically
during startup, migration, export, restore, replacement, erasure, or future
synchronization. No authentication, synchronization, conflict resolution,
API endpoint, or background worker. No new network call. No change to
starter-pack or expanded-pack content, versioning, or automatic updates. No
generic data-import framework. No new primary tab, chart, timer, or
AI-driven feature. No Maestro, simulator, emulator, or automated UI suite.

## Unresolved questions

None. The resurrection semantics, transaction boundary, and synchronization
metadata behavior above were the only open product decisions Specification
0043 deferred, and this specification settles all three.
