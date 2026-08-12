# Offline workout session architecture

## Boundary and lifecycle

Workout Session is independent from Exercise Catalog definitions and recurring
Planner intent:

```text
catalog definition ── snapshot ──┐
planned workout ───── snapshot ──┼─> active session ─> completed history
                                 └─> confirmed discard deletes aggregate
```

The pure domain owns immutable sessions, ordered exercises, individual sets, and
a discriminated actual-result union. Mobile application use cases orchestrate
clocks, UUIDs, repositories, and transactions. Presentation never accesses SQL.

Only active and completed states persist. Completion requires at least one set
and an end timestamp at or after start. Completed sessions are read-only and feed
the independent Workout History read capability. A partial unique SQLite index
and application outcome enforce at most one active session.

## Snapshots and planned versus actual

At planned start, the session copies workout name, source weekday, ordered
exercise names and logging modes, and planned prescriptions. Adding an exercise
during execution snapshots its name and mode immediately. Source plan, planned
exercise, and catalog UUIDs are provenance strings—not foreign keys or historical
display sources.

Exercise notes, favorite/search metadata, equipment, and muscle classification
are not needed to interpret performed work and are not copied. Catalog deletion
continues to be blocked only by active Planner references. Session snapshots do
not block catalog deletion or change when catalog or plan records change.

Planned prescriptions remain neutral guidance. Actual results are independent
sets and may differ without judgment or Planner mutation. A planned exercise with
no recorded sets remains captured without adding a speculative skipped state.

## Results, ordering, persistence, and recovery

Repetition modes record positive integer repetitions. External load, added load,
and assistance record positive canonical `Mass` plus repetitions; the snapshotted
mode preserves their meaning. Duration and distance reuse canonical `Duration`
seconds and `Length` millimeters. Bodyweight sets do not infer profile mass.

Exercises and sets use zero-based contiguous positions and display one-based
numbers. Adds append; deletes compact later positions transactionally; edits keep
identity and position. Quick-entry values remain UI drafts until Save succeeds.

Migration 9 creates `workout_session`, `workout_session_exercise`, and
`workout_set`. Children are removed only on session deletion or aggregate
replacement. Migration 9 declares `ON DELETE CASCADE`, but the repository does
not depend on it: it deletes `workout_set` rows, then `workout_session_exercise`
rows, then the session, because the connection Expo opens for `runExclusive` has
foreign keys off (see [local persistence](local-persistence.md)). Discarding runs
on the main connection today and replacement runs inside a transaction; the
explicit order makes both correct without depending on which connection is in
use. Strict checks encode
planned and actual unions. A fixed three-query read reconstructs and validates an
active aggregate. Exercise and set changes replace the small active aggregate;
completion updates only the parent status and completion timestamp so immutable
historical children are never deleted or reinserted. Every confirmed mutation is
a short transaction, so the active workout restores after termination, crash,
restart, or cold offline launch.

Start captures epoch time, local calendar date, and UTC offset. The captured date
remains the historical grouping key across timezone changes. Completion stores
its epoch time; elapsed time is derived rather than continuously persisted.

## Experience, privacy, and limitations

Workout exposes Resume, today's planned start, empty start, Weekly Plan, Workout
History, and Exercise Library. Expanding cards, contextual set actions, explicit
metric/imperial units, destructive confirmations, and textual planned/actual
distinctions support gym use and accessibility.

Data remains in the application sandbox. SQL is bound, rows are validated, and
errors/logs exclude workout details. There is no network, telemetry, AI, or new
permission. Read-only history and deterministic progress are described in
[Offline Workout History](offline-workout-history.md). Encryption, completed
correction, charts, advanced analytics, advanced sets, timers, export, backup,
and synchronization remain deferred.
