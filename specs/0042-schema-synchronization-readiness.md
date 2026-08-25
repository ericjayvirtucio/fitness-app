# Specification 0042: A schema synchronization can be added to

> Testing-policy note: automated simulator, sprint-suite, and regression-suite
> requirements in this historical specification were superseded by
> [ADR 0033](../docs/decisions/0033-risk-based-manual-device-testing.md).
> Use command-line Jest/Vitest checks plus risk-based manual device testing.

- Status: Approved
- Date: 2026-08-23

## Objective and scope

Give every table a person owns the metadata a future cloud-synchronization
design needs — an update time, a deletion tombstone, a revision, and an
originating device — plus a durable record of local changes not yet sent
anywhere, so that phase can be added later without rewriting today's schema or
its read paths a second time.

Version 12 adds columns to ten tables, rebuilds the one index whose uniqueness
a tombstone would otherwise poison, adds a `sync_outbox` table and a
`device_identity` singleton, and updates every read, write, and erasure path
those additions touch. No synchronization is built. Nothing leaves the device.
There is no network capability, no account, and no new dependency.

Authentication, an API endpoint, conflict resolution, background sync,
notifications, and AI remain excluded, as they are for the whole product
direction at this point. The export file format (`formatVersion` 1) is
unchanged and gains no field; the new metadata is deliberately invisible to it.

## Users and the problem

Nobody using the application today asks for synchronization; it is not built.
The person this specification serves is whoever builds it next, and the
problem it solves is paying a cost once instead of twice: making deletion a
tombstone changes every read path that currently assumes a deleted row is
gone, and that migration is the same size whether it runs against today's ten
tables or against those same ten tables plus however many a later phase adds
first. [PRODUCT.md](../PRODUCT.md) schedules this phase second, immediately
after the visual identity, for exactly that reason.

## Terminology

- **Tombstone** — a row whose `deleted_at_epoch_ms` is set. It still exists in
  the table; every ordinary read excludes it.
- **Sync unit** — a table whose rows carry the four metadata columns and are
  independently addressable to a future device: `personal_profile`,
  `goal_configuration`, `hydration_target`, `nutrition_consumption_entry`,
  `nutrition_catalog_item`, `hydration_entry`, `exercise_catalog_item`,
  `body_weight_entry`, `planned_workout`, `workout_session`.
- **Aggregate child** — a row with no independent sync identity, always
  written and removed as a batch with its parent: `planned_exercise`,
  `workout_session_exercise`, `workout_set`.
- **Outbox** — `sync_outbox`, one row per `(table_name, row_id)` with unsent
  local changes, upserted on every mutating write to a sync unit.
- **Originating device** — the device that inserted a row, recorded once and
  never overwritten. Provenance, not "last modified by."

## The four columns, and which tables get them

`updated_at_epoch_ms INTEGER NOT NULL`, `deleted_at_epoch_ms INTEGER`,
`revision INTEGER NOT NULL`, `originating_device_id TEXT NOT NULL` are added to
the ten sync-unit tables listed above. Aggregate children get none of the four:
they have no independent lifecycle to version, they are already rewritten
wholesale on every parent edit, and giving them a revision would mean a single
corrected set re-queues every sibling set in the same exercise for no reason.
A future device that needs to know a workout changed learns it from the
session row's revision; the corrected content travels with it as an embedded
snapshot, exactly as history already snapshots exercise name and prescription
today.

## Exact rules

**Person-initiated deletion** sets `deleted_at_epoch_ms`, increments
`revision`, refreshes `updated_at_epoch_ms`, and upserts an outbox row with
`operation = 'delete'`. It applies to: nutrition consumption entries, nutrition
catalog items, hydration entries, exercise catalog items, body-weight entries,
a cleared weekday's planned workout, and a deleted completed workout session.
Every one of these was already its own explicit delete path; none gained a new
one.

**Application-owned scratch-state discard remains a hard delete**, with no
tombstone and no outbox entry. This is `WorkoutSessionSqliteRepository.discard`
— abandoning a never-completed active session — and the child-rewrite inside
`replace`, which edits an active session's own content. ADR 0008 already
treats an active session as not-yet-history; nothing here changes that, and
inventing sync behavior for a scenario sync does not yet cover would be exactly
the kind of unsupported assumption this specification is told to avoid.

**A session is not queued to the outbox until it is completed.** `insert`
stamps metadata on every new session, active or completed, because `revision`
must already hold a valid integer before a later `UPDATE ... SET revision =
revision + 1` can run — but it queues an outbox row only when the inserted
session's status is `'completed'`. Completing an active session
(`complete`), correcting completed history (`correctCompleted`), renaming a
completed session, and deleting one (`deleteCompleted`) all queue an outbox
row; renaming an _active_ session bumps its revision but does not queue one.
The alternative — queuing at `insert` unconditionally — would leave a dangling
outbox reference every time an active session is discarded before its first
sync, which is the ordinary case for an abandoned workout.

**Tombstoned rows are excluded from every read that shows or matches content**:
list, detail, search, singleton `get`, duplicate-name lookups, referential
usage checks (a tombstoned plan no longer blocks editing the exercise it
referenced), and the optimistic-concurrency lifecycle guards on
`workout_session`. No category needed a different rule; a tombstone behaves as
"missing" everywhere a hard-deleted row already did.

**Existence probes are unfiltered, deliberately.** `hasStoredRows` — the shared
statement behind every `StoredDataProbe` — does not check
`deleted_at_epoch_ms`. A tombstoned row is still a row, so "does this table
hold anything" still answers yes. This is what lets empty-installation restore
and erasure verification work completely unchanged: restore stays refused
while any row, tombstoned or not, remains, and erasure's `deleteAllRows` is
already an unconditional `DELETE FROM <table>` that removes a tombstone exactly
as it removes a live row.

**Export, restore, and replacement are unaware of the new columns.** Export
readers add the same `deleted_at_epoch_ms IS NULL` filter as every other read;
the four metadata columns are never added to a `SELECT` list an `Exported*`
type consumes, never mapped by `data-export-mapping.ts`, and never read back by
the restore parser. A restored or replaced row is written through the owning
repository's ordinary insert path, which stamps fresh metadata — `revision`
1, `deleted_at_epoch_ms` null, `updated_at_epoch_ms` now, the current device as
`originating_device_id` — and queues an outbox row (immediately, for a
completed session, matching the rule above). The export contract's own
promise, "no device identity" (see Identifiers in
[offline data export](../docs/architecture/offline-data-export.md)), is
preserved by construction rather than by a new check.

**Erase-all and replace-all wipe `sync_outbox`.** It is cleared as an
infrastructure step alongside the eight capability erasers, inside the same
transaction, because a hard delete of every user-owned row would otherwise
leave outbox entries pointing at rows that no longer exist. It has no
`StoredDataProbe`: it is bookkeeping, not data a person owns, so it is not part
of what "empty" means and is not verified empty, only cleared.

**`device_identity` survives erasure.** A device id is an attribute of the
installation, not of the person's data; "delete everything this app has
stored" has never meant "forget which physical device this is," and nothing in
this specification changes that boundary. It is excluded from every probe,
eraser, export reader, and the restore parser.

## The one repository behavior change

`WorkoutPlannerSqliteRepository.replace` previously deleted and reinserted the
`planned_workout` row itself on every save, edit included, because nothing
depended on the row's identity surviving an edit. Once a revision exists, that
stops being harmless: recreating the row on every edit would silently reset
its revision to 1 and look like "delete this weekday's plan, create an
unrelated new one" to a future sync consumer. `replace` now checks for an
existing live row by id and issues an `UPDATE` when one exists, an `INSERT`
only when it does not; children are still rewritten wholesale, since they have
no identity to preserve. `WorkoutSessionSqliteRepository.replace` already did
this correctly for its own parent row and needed no change.

## The one schema-rebuild exception

`planned_workout.weekday` carried an inline `UNIQUE` constraint. A tombstoned
row would occupy that constraint forever, refusing a new plan for a weekday
whose old plan was just cleared. SQLite cannot drop a column-level constraint
in place, so migration 12 rebuilds `planned_workout` — copy, drop, rename —
and replaces the constraint with a partial unique index over live rows,
matching the pattern `workout_session_single_active` already established. No
other table has an analogous non-primary-key uniqueness constraint, so no
other table needed the same treatment.

## Indexes

Every index a tombstone-aware read relies on — the nine listed in
`local-persistence.md`'s migration 12 entry, plus the rebuilt weekday
uniqueness — is a partial index `WHERE deleted_at_epoch_ms IS NULL`, with its
existing column list otherwise unchanged. `workout_session_single_active`
needed no change: an active session is never tombstoned, by construction.

## Migration

One migration, version 12, in one exclusive transaction, per the existing
contract in [local-persistence.md](../docs/architecture/local-persistence.md).
Ten `ALTER TABLE ... ADD COLUMN` sequences with literal defaults
(`updated_at_epoch_ms 0`, `deleted_at_epoch_ms` unset, `revision 1`,
`originating_device_id 'pre-sync-migration'`) for existing rows, one table
rebuild for `planned_workout`, ten index rebuilds, and two new tables. A
default of `0` for `updated_at_epoch_ms` on pre-existing rows is a deliberate,
honest "unknown" rather than a fabricated "just changed," consistent with this
codebase's existing refusal to show a computed zero where the truth is
"never recorded."

`device_identity` is seeded outside migration SQL, at composition start
(`composition/persistence.ts`), the first time `getDeviceId()` is called after
migrations succeed — migration SQL stays free of randomness per
`local-persistence.md`'s existing rule, and the identifier is generated exactly
once per installation and cached for the process afterward.

## Test plan

- **Migration**: fresh install to v12; upgrade from v11 with populated rows,
  asserting defaults and that pre-existing data survives; the weekday-reuse
  case against a real engine, asserting both that a tombstoned weekday can be
  re-planned and that two live rows for the same weekday still collide.
- **Tombstone visibility**: for every person-deletion site, a tombstoned row is
  absent from list/detail/search/duplicate-check/guard reads and still counted
  by the existence probe.
- **App-scratch regression lock**: `discard` and active-session `replace`
  remain hard deletes with no metadata or outbox side effects.
- **`planned_workout.replace`**: an edit preserves id and increments revision;
  a genuinely new plan (fresh id) inserts at revision 1.
- **Outbox**: a repeated edit of the same record collapses to one outbox row
  at the latest revision; an active session's edits never reach the outbox; a
  completed session's completion, correction, rename, and deletion each queue
  one.
- **Export/restore/replace**: exported JSON contains no metadata field under
  any `Exported*` type and excludes tombstoned rows exactly as it already
  excluded hard-deleted ones; restored and replaced rows carry fresh metadata
  and a queued outbox entry.
- **Erasure**: `sync_outbox` is empty and `device_identity` is unchanged after
  erase-all; the full regression suite passes unmodified in shape.

Full coverage lives in
`apps/mobile/src/infrastructure/persistence/synchronization-readiness-sqlite.spec.ts`
(real-engine, cross-cutting) plus the updated unit and integration specs for
every touched repository, reader, and use case.

## Documentation impact

[local-persistence.md](../docs/architecture/local-persistence.md) documents
migration 12. Each touched capability's architecture document gains a short
note that deletion is now a tombstone and its reads exclude it. The export,
restore, erasure, and replacement architecture documents each record that the
new metadata is invisible to their contracts. [ADR
0032](../docs/decisions/0032-schema-synchronization-readiness.md) records the
durable decisions: inline columns over a metadata table, an upserted outbox
over a per-row dirty flag, an immutable originating device, a plain integer
revision, metadata scoped to sync-unit tables only, and unfiltered existence
probes.

## Risks

- **Read-path omission.** Nothing enforces that every future query against a
  sync-unit table remembers the filter; a missed one is a silent
  visibility bug, not a crash. There is no shared query builder in this
  codebase to centralize the check in, so this is mitigated by the read-path
  inventory in this document and by test coverage, not by a structural
  guarantee.
- **Migration size.** Ten `ALTER TABLE` sequences, one table rebuild, ten index
  rebuilds, and two new tables in one transaction is larger than any prior
  migration here. It is still atomic per the existing contract; the size is a
  review-time cost, not a runtime one.
- **Deferred, not decided.** Conflict resolution, clock trust, and what happens
  when two devices edit the same row before ever syncing are unanswered on
  purpose. The revision/updated-time shape here is what that design will build
  on, not a preview of its answer.
- **Open product question.** Whether "delete all local data" should also
  regenerate `device_identity` is left to the product owner; this
  specification keeps it untouched by default because it carries no personal
  data and regenerating it would be pure churn for a future sync engine, but
  the alternative is one line to change if the product decision goes the other
  way.
