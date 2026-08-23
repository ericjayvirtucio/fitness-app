# Schema synchronization readiness

## Purpose

Migration 12 adds the metadata a future cloud-synchronization design needs to
every table a person owns, and a durable record of local changes not yet sent
anywhere. No synchronization is built. Nothing leaves the device. This
document describes the mechanics every capability's persistence code now
follows; see [Specification 0042](../../specs/0042-schema-synchronization-readiness.md)
for the full inventory and [ADR 0032](../decisions/0032-schema-synchronization-readiness.md)
for why each choice was made instead of its alternative.

## The four columns

`updated_at_epoch_ms`, `deleted_at_epoch_ms`, `revision`, and
`originating_device_id` are added to the ten tables a person owns as an
independently addressable record: `personal_profile`, `goal_configuration`,
`hydration_target`, `nutrition_consumption_entry`, `nutrition_catalog_item`,
`hydration_entry`, `exercise_catalog_item`, `body_weight_entry`,
`planned_workout`, and `workout_session`.

Aggregate children — `planned_exercise`, `workout_session_exercise`,
`workout_set` — get none of the four. They have no independent lifecycle,
they are always rewritten wholesale with their parent, and a future device
that needs to know an aggregate changed reads the parent row's revision; the
corrected content travels with it as an embedded snapshot, the same way
history already snapshots exercise name and prescription.

`revision` is a plain integer, starting at 1, incremented by exactly 1 on
every mutating write to that row, including the write that sets the
tombstone. `originating_device_id` is stamped once at insert and never
overwritten — provenance, not "last modified by." `updated_at_epoch_ms` is
wall-clock, independent of `revision`.

## Deletion versus discard

A person deleting a record they own — a nutrition entry, a catalog item, a
hydration entry, an exercise definition, a body-weight entry, a cleared
weekday plan, a completed workout — sets `deleted_at_epoch_ms`, increments
`revision`, refreshes `updated_at_epoch_ms`, and queues an outbox row with
`operation = 'delete'`. The row stays in the table.

Discarding an active, never-completed workout session
(`WorkoutSessionSqliteRepository.discard`) remains an unconditional hard
delete, exactly as before this migration. ADR 0008 already treats an active
session as not-yet-history; a tombstone would claim a future device needs to
learn about something that never became real history.

Every ordinary read — list, detail, search, singleton `get`, duplicate-name
lookup, referential usage check, and the optimistic-concurrency lifecycle
guards on `workout_session` — excludes a tombstoned row with
`deleted_at_epoch_ms IS NULL`. `StoredDataProbe`'s shared `hasStoredRows`
statement is the one deliberate exception: it does not filter, so a
tombstoned row still counts as "this table holds something," which is what
keeps empty-installation restore's refusal and erase-all's verification
correct without their own code changing.

## The outbox

`sync_outbox` holds one upserted row per `(table_name, row_id)` with unsent
local changes: `operation` (`'upsert'` or `'delete'`), the row's current
`revision`, and when it was queued. `queueOutboxEntry` in
`infrastructure/persistence/sync-outbox.ts` is the only writer; every
mutating repository method calls it after its own write, inside the same
transaction. A record edited repeatedly before ever syncing costs one row,
not one per edit — the outbox is "what still needs sending," not an event
log.

A workout session is queued only once it is `'completed'`: `insert` stamps
metadata on an active session immediately, because a later `revision =
revision + 1` needs a valid starting value, but it does not queue an outbox
row until the session reaches history. Completing, correcting, renaming a
completed session, and deleting one each queue a row; renaming an active
session bumps its revision without queuing one. This avoids a dangling
outbox reference for the ordinary case of a workout started and then
abandoned.

Nothing drains `sync_outbox` yet. It is inert scaffolding until a sync design
exists to consume it.

## Device identity

`device_identity` is a singleton holding one random UUID, generated once by
`getOrCreateDeviceId` the first time `composition/persistence.ts`'s
`getDeviceId()` is called after migrations succeed, and cached for the
process afterward. It carries no personal information and is never
transmitted anywhere in this phase. It is excluded from every capability's
`StoredDataProbe`, `StoredDataEraser`, export reader, and the restore parser:
a device identifier is an attribute of the installation, not of the data a
person owns, so it is untouched by export, restore, replacement, and erasure
alike.

## Export, restore, and replacement

None of the four metadata columns is read by an export reader, written into
an `Exported*` type, mapped by `data-export-mapping.ts`, or read back by the
restore parser. Export readers add the same `deleted_at_epoch_ms IS NULL`
filter every other read gets; a tombstoned record is invisible to an export
exactly as a hard-deleted one always was. This preserves the export
architecture's existing promise that the file carries "no device identity" —
by construction, not by an added check.

A restored or replaced row is written through the owning repository's
ordinary insert path, so it always gets fresh metadata: `revision` 1,
`deleted_at_epoch_ms` null, `updated_at_epoch_ms` now, the current
installation as `originating_device_id`, and a queued outbox entry (for a
completed session, immediately, per the rule above).

Erase-all and replace-all both clear `sync_outbox` as an infrastructure step
alongside the eight capability erasers, inside the same transaction: those
erasers hard-delete every row the outbox could reference, so leaving old
outbox rows behind would dangle. `device_identity` is untouched by either
operation.

## One repository behavior change

`WorkoutPlannerSqliteRepository.replace` used to delete and reinsert the
`planned_workout` row itself on every save, edit included. That stopped being
safe once a revision exists: recreating the row on every edit would silently
reset it and look like "delete this plan, create an unrelated new one" to a
future sync consumer. `replace` now issues an `UPDATE` when a live row for
that id already exists, and an `INSERT` only when it does not; its children
are still rewritten wholesale, since they carry no identity to preserve.
`WorkoutSessionSqliteRepository.replace` already updated its own parent row
in place and needed no change.

## The one schema rebuild

`planned_workout.weekday` carried an inline `UNIQUE` constraint. A
tombstoned row would occupy that constraint forever, refusing a new plan for
a weekday whose old plan was just cleared. Migration 12 rebuilds
`planned_workout` — copy, drop, rename — and replaces the constraint with
`planned_workout_weekday_active`, a partial unique index over live rows,
matching `workout_session_single_active`. No other table has an equivalent
non-primary-key uniqueness constraint.

## Testing

`apps/mobile/src/infrastructure/persistence/synchronization-readiness-sqlite.spec.ts`
covers the cross-cutting behavior against a real engine: device-id
idempotency, tombstone visibility versus existence-probe visibility, outbox
collapsing across repeated edits, the weekday-reuse-after-tombstone case, and
that erase-all clears the outbox while leaving device identity alone. Every
touched repository's own spec covers its metadata stamping and read
filtering directly.
