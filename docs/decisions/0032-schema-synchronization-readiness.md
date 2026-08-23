# ADR 0032: A schema synchronization can be added to

**Status:** Accepted

## Context

[PRODUCT.md](../PRODUCT.md) schedules cloud-readiness as schema work, second in
the direction, ahead of every remaining offline capability, because making
deletion a tombstone changes every read path that currently assumes a deleted
row is gone — a cost worth paying once against today's ten owned tables rather
than repeatedly against every table added before synchronization exists. No
synchronization is designed or built here; this record is about the shape of
the foundation a later phase will build on, and the shape has several
independent choices that each had a real alternative.

## Decision

**Metadata lives as inline columns, not a separate table.** A shared
`sync_metadata` keyed by `(table_name, row_id)` would need a synthetic
composite key with no real foreign-key enforcement — SQLite foreign keys are
single-table, and this codebase already works around the fact that
`PRAGMA foreign_keys` does not reach the exclusive-transaction connection Expo
opens (see [local-persistence.md](local-persistence.md)) — and it would force
a join onto every one of roughly fifty read call sites this change touches.
Inline columns keep each repository's ownership of its own table intact and
cost nothing at the read sites beyond the filter they already need.

**Local changes are tracked in one durable outbox table, upserted by
`(table_name, row_id)`, not a per-row dirty boolean.** A boolean conflates two
questions a real sync design needs to keep separate — has this row changed,
and has that change been sent — and cannot distinguish a queued delete from a
queued update. Upserting by primary key means an actively edited record, a
workout logging many sets in one session, costs one outbox row rather than one
per write; the table holds "records with unsent changes," not an event log.

**`originating_device_id` is immutable, stamped once at insert.** The literal
phrase in the product direction — "an originating-device identifier" — reads
as provenance, not "last modified by." A mutable last-writer column is a real
alternative a future conflict-resolution design may still want, but nothing
here has a consumer for it yet, and AGENTS.md's standing rule against
introducing an abstraction before a demonstrated use case argues against
adding it speculatively.

**Revision is a plain incrementing integer, not a timestamp and not a logical
clock.** A timestamp conflates "when" with "which version" and trusts a
device clock that PRODUCT.md's own offline-first philosophy already flags as
unreliable for synchronization ("clocks... must be designed together before
synchronization is implemented"). A Lamport or hybrid-logical clock is
premature: no concurrent multi-device writer exists yet, and a plain integer
upgrades to one later without a column-shape change, only an increment-rule
change.

**Metadata is scoped to ten "sync-unit" tables; three aggregate-child tables
get none.** `planned_exercise`, `workout_session_exercise`, and `workout_set`
are always written and removed as a batch with their parent and have no
independent lifecycle to version. Giving them their own revisions would mean a
single corrected set re-queues every sibling row in the same exercise, and —
more sharply — since these tables are already rewritten wholesale on every
parent edit (`deleteChildren` then `insertChildren`), independently versioned
children would either churn revisions on every edit regardless of what
changed, or require rewriting that always-replace pattern into a diff the
existing design never needed. The parent's own revision is what a future
device needs to learn the aggregate changed; the corrected content travels
with it as an embedded snapshot, exactly as history already snapshots exercise
name and prescription today.

**Existence probes stay unfiltered.** `hasStoredRows`, shared by every
`StoredDataProbe`, does not check `deleted_at_epoch_ms`. A tombstoned row still
answers "this table holds something," which is what lets empty-installation
restore and erasure verification work with zero code change: restore already
refuses whenever any row remains, and the eraser's `deleteAllRows` is already
an unconditional `DELETE FROM <table>` that removes a tombstone exactly as it
removes a live row. The alternative — a probe that ignores tombstones — was
rejected because it would let restore proceed into a table that still holds a
tombstoned row, risking a primary-key collision between a restored id and a
surviving tombstone the restore parser has no way to see.

**A session is queued to the outbox only once it is completed.** Queuing at
insert unconditionally would leave a dangling outbox reference every time an
active session is discarded before its first sync — the ordinary case for an
abandoned workout, per ADR 0008's own framing that discard is scratch-state
cleanup, not deletion of history. `insert` still stamps every session with
metadata immediately, since a later `revision = revision + 1` needs a valid
starting integer regardless of status; only the outbox write is conditional.

## Consequences

Every read/write inventory in [Specification
0042](../../specs/0042-schema-synchronization-readiness.md) narrows to a
single rule per category — deletion tombstones, discard stays a hard delete,
reads filter tombstones, probes do not — with exactly one exception each in
two places: `WorkoutPlannerSqliteRepository.replace` had to stop recreating
its parent row on every edit, and `planned_workout` needed a one-time table
rebuild to move its weekday uniqueness into a partial index. Both are recorded
in the specification; neither generalizes to another table.

The migration is the largest this repository has shipped — ten
`ALTER TABLE` sequences, one rebuild, ten index rebuilds, two new tables, one
transaction — which is a review-time cost accepted in exchange for not
repeating a smaller version of the same migration against every table added
between now and whenever synchronization is actually designed.

No shared query-building layer exists in this codebase, so nothing structurally
prevents a future read from omitting the tombstone filter; that risk is
accepted and mitigated by the read-path inventory and test coverage in
Specification 0042, not eliminated by this decision.

Conflict resolution, clock trust, and cross-device reconciliation remain
entirely undesigned. The revision and update-time columns are the surface a
later design will read; this record does not claim they are sufficient for it,
only that they are the smallest shape that does not need to change shape
later.

## Alternatives considered

**A separate `sync_metadata` table.** Rejected: no real foreign key, a join at
every read site, and a new cross-capability table this repository's own rule
against generic shared tables argues against.

**A per-row `is_dirty` boolean instead of an outbox table.** Rejected: cannot
represent a queued delete distinctly from a queued update, and conflates
"changed" (already answered by `revision`) with "not yet sent," which a future
sync engine needs to track separately, potentially per remote.

**A mutable "last modified by device" column.** Not rejected outright — a
real future design may want it — but not added now, for lack of a consumer and
per this repository's standing rule against speculative abstraction.

**Timestamp-as-revision.** Rejected on the product direction's own stated
distrust of device clocks for synchronization purposes.

**Giving aggregate children their own revisions.** Rejected: the existing
always-replace write pattern for `workout_session_exercise` /
`workout_set` and `planned_exercise` would turn every parent edit into
revision churn across every sibling child, for content that already travels
with the parent as a snapshot.

**A tombstone-aware existence probe.** Rejected: it would let restore proceed
into a non-empty-looking table and risk an id collision with a surviving
tombstone, for no benefit over the unfiltered probe's existing, already-correct
behavior.

**Queuing every session to the outbox at insert.** Rejected: guarantees a
dangling outbox reference for every discarded active session, the common case
for an abandoned workout.
