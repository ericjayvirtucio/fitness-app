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
and an end timestamp at or after start. A completed session feeds the independent
Workout History capability and changes only through an explicit user correction of
a recorded set, described in
[completed workout correction](completed-workout-correction.md), or an explicit
removal of one session exercise, described in
[completed session exercise removal](completed-session-exercise-removal.md);
nothing else may rewrite it, and the completion invariant keeps it from being
emptied by either. A partial unique SQLite index
and application outcome enforce at most one active session.

## Snapshots and planned versus actual

At planned start, the session copies workout name, source weekday, ordered
exercise names and logging modes, and planned prescriptions. Adding an exercise
during execution snapshots its name and mode immediately, and adding one to a
completed workout captures the same snapshot at the moment of addition — the one
place where a snapshot's instant and its workout's instant differ. See
[completed workout exercise addition](completed-workout-exercise-addition.md). Source plan, planned
exercise, and catalog UUIDs are provenance strings—not foreign keys or historical
display sources.

A session's own name is not a snapshot. It is stored as `workout_session.display_name`
and projected live by every reader, so its owner can rename a workout of either
status and every surface agrees on the answer. The rename is one guarded `UPDATE`
on the parent row, validated by rebuilding the aggregate through
`WorkoutSession.create` and guarded by the status and lifecycle instants the
screen loaded. It writes no recorded value and is not correction. See
[owner-named workouts](../../specs/0035-owner-named-workouts.md) and
[ADR 0025](../decisions/0025-a-workout-name-is-its-owners-label.md).

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

Because those three modes share one result variant, the captured mode is also
what every screen words the result from. `formatWorkoutResult` and
`formatPlannedWorkoutResult` take it as a required parameter and mark the two
modes whose mass is not the mass lifted: `Assistance 20 kg × 8` and
`Added 20 kg × 8`, against the unmarked `20 kg × 8`. The qualifier leads, so a
row truncated at the largest accessible text size keeps its meaning. The
vocabulary is the entry surfaces' own, and no meaning is written to the set row.
See [Specification 0032](../../specs/0032-recorded-result-meaning.md).

Exercises and sets use zero-based contiguous positions and display one-based
numbers. Adds append; deletes compact later positions transactionally; edits keep
identity and position. Quick-entry values remain UI drafts until Save succeeds.

Migration 9 creates `workout_session`, `workout_session_exercise`, and
`workout_set`. Children are removed only on session deletion or aggregate
replacement. Migration 9 declares `ON DELETE CASCADE`, but the repository does
not depend on it: it deletes `workout_set` rows, then `workout_session_exercise`
rows, then the session, because the connection Expo opens for `runExclusive` has
foreign keys off (see [local persistence](local-persistence.md)). Every path that
removes owned rows — discard, replacement, correction, and completed deletion —
runs inside such a transaction, so the explicit order is what makes the deletion
complete rather than the declared cascade. Strict checks encode
planned and actual unions. A fixed three-query read reconstructs and validates an
active aggregate. Exercise and set changes replace the small active aggregate;
completion updates only the parent status and completion timestamp so historical
children are never deleted or reinserted by finishing a workout. The separate
`correctCompleted` contract rewrites the complete child set of a completed workout,
and only those children, under a verified unchanged parent lifecycle. Two
`workout-history` workflows depend on that guarantee: correcting a recorded set,
and removing one session exercise with the sets it owns. The separate `deleteCompleted` contract removes
one completed aggregate outright — sets, then session exercises, then the session —
and verifies that no owned row survives before it returns; it refuses anything that is
not completed, so widening `discard` is never needed and completed history stays
unreachable from active workout screens (see
[completed workout deletion](completed-workout-deletion.md)). Abandoning an
active workout uses the separate `discard` contract, which asserts
`status = 'active'` when it looks the session up and again on the statement that
deletes it. Every confirmed mutation, discard included, is one short exclusive
transaction, so the active workout restores after termination, crash, restart, or
cold offline launch, and an interrupted discard leaves the workout with every set
it held rather than one that recovers with its recorded work missing.

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
permission. History and deterministic progress are described in
[Offline Workout History](offline-workout-history.md). Encryption, charts,
advanced analytics, advanced sets, and synchronization remain deferred.

## Rest timing

The active session screen can offer an optional, foreground-only rest
countdown after a set saves successfully: a person picks one of four preset
durations (60, 90, 120, or 180 seconds) and starts it explicitly; nothing
starts automatically. Remaining time is derived each tick from a fixed
in-memory deadline rather than accumulated from ticks, so a delayed or
backgrounded tick still reports true elapsed time instead of drifting.
Completion is announced once through a discrete accessibility live region;
the ticking numeral itself carries none, to avoid a per-second announcement.

The countdown holds no session, repository, or persistence reference of any
kind — only a duration and a dismiss callback — so it cannot read or write a
`WorkoutSession`, a `WorkoutSet`, or anything downstream of one. It is a
pure, component-local state machine plus one presentation component in
`workout-session/presentation`, with no application-layer use case, no
global timer service, and no new dependency. It does not persist across a
screen unmount, an app background/foreground cycle, or app termination —
there is no `AppState` handling and no background work of any kind, by
design. Losing it never loses a recorded set: the set that made the offer
available was already durably committed to SQLite before the countdown
could mount. See [Specification 0045](../../specs/0045-foreground-rest-timing.md).

`workout_session` carries the synchronization-readiness metadata described in
[Schema synchronization readiness](schema-synchronization-readiness.md); its
children do not. Deleting a completed workout tombstones the session row
rather than removing it; abandoning a never-completed active session remains
an unconditional hard delete, matching this document's own "Discard deletes
the active aggregate" (ADR 0008) — a session is not queued for a future sync
until it is completed. No synchronization exists yet.
