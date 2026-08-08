# ADR 0010: Derived workout history and progress read models

- Status: Accepted
- Date: 2026-08-08

## Context

Completed Workout Sessions now contain stable exercise snapshots and performed sets,
but the application has no bounded history or progress queries. History must survive
Catalog and Planner edits, preserve captured local-day meaning, and avoid regressing
the lifecycle-only completion update. The first progress views must remain
deterministic without becoming a speculative analytics platform.

## Decision

Introduce a mobile-owned `workout-history` read capability over the existing Workout
Session tables. Completed session snapshots are the sole historical authority.
Purpose-built projections provide keyset-paginated history, completed detail,
captured-local-date range summaries, per-exercise performance, and derived performed
recents. Mutable Catalog data may resolve a recent UUID for current selection only;
it never supplies historical display meaning.

Persist no summaries. Migration 10 adds only focused completed-history and
source-exercise indexes. Keep Workout Session completion limited to parent lifecycle
fields and derive frequency, counts, elapsed time, repetitions, duration, distance,
pace, and eligible load volume at read time.

Define recorded load volume as resistance multiplied by repetitions for external
load and added bodyweight load. Exclude bodyweight-only and assistance results, do
not infer profile mass, and do not combine unlike logging dimensions. Defer personal
record claims, charts, adherence, and strength estimates.

Use `started_local_calendar_date` as the permanent grouping key. Weeks remain
Sunday-to-Saturday, matching the established Workout vocabulary. History and
exercise pages use bounded keyset pagination rather than offsets or full-history
in-memory scans.

## Consequences

- Catalog and Planner mutations cannot rewrite historical display or calculations.
- Completion remains narrow and historical children remain untouched.
- Summaries cannot become stale and require no reconciliation or migration of
  derived values.
- Read queries perform bounded aggregation, supported by small focused indexes.
- Exercise recents become genuine usage signals without duplicated Catalog metadata.
- Personal-record and advanced analytics semantics require a later reviewed design.

## Alternatives considered

Persisted summary tables, Catalog usage timestamps, completion-time denormalization,
joining mutable Catalog rows for history, offset pagination, current-timezone day
grouping, planned-target analytics, inferred bodyweight volume, assistance volume,
generic analytics repositories, charts, and PR badges were rejected as stale,
historically unsafe, misleading, or disproportionate to the approved foundation.
