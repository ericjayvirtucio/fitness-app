# Offline workout history and progress architecture

## Boundary and historical authority

Workout History is a device-local read capability over completed Workout Sessions:

```text
completed session snapshots → workout-history use cases
  → WorkoutHistoryRepository → SQLite projections → read-only history UI
```

Completed session, exercise, planned-target, logging-mode, and actual-set snapshots
are authoritative. History never rejoins mutable Exercise Catalog or Workout Planner
rows for display. Source UUIDs remain provenance and exercise-history identity only.
Planned prescriptions are labeled context; only actual sets contribute to performed
summaries.

Session execution and mutation remain in `workout-session`. Completion still updates
only the parent status and completion timestamp. The history capability cannot edit
or delete completed sessions.

## Captured dates and bounded history

The start-time `started_local_calendar_date` permanently groups a session. Later
timezone changes do not move it. Daily summaries use one date, weeks are Sunday to
Saturday, and months use calendar boundaries. A workout crossing midnight remains
on its start day. Elapsed workout time is completion minus start time.

History pages are ordered by captured local date, start instant, and UUID descending.
Keyset cursors keep results stable and bounded; pages default to 20 and cannot exceed 50. List queries project counts without loading child aggregates. Detail uses the
existing fixed aggregate reconstruction and accepts completed status only.

Migration 10 adds `(status, local date, start, id)` and `(source exercise, session)`
indexes. It adds no table or authoritative column. All history values remain in the
version-9 session schema.

## Deterministic progress semantics

Range summaries derive completed workout frequency, performed exercise and actual-set
counts, elapsed workout time, repetitions, duration, distance, and eligible recorded
load volume. Missing or ineligible dimensions remain absent rather than becoming
zero.

Recorded load volume is the sum of actual resistance grams multiplied by actual
repetitions for external-load and added-bodyweight-load modes. Bodyweight-only work
never infers profile mass. Assistance is displayed as assistance and excluded because
greater assistance does not represent greater performed load. Distance-duration
results may derive pace from actual distance and duration; unlike dimensions are
never combined into one score.

Deterministic personal records now derive from the same completed history, in a
separate reader documented in
[Workout personal records architecture](workout-personal-records.md). Strength
estimates, charts, adherence, streaks, calories, coaching, and recommendations
remain deferred.

The same repository also groups completed workout, performed exercise, and
actual-set counts by captured local date for the cross-capability Progress daily
breakdown. Planner intent and active sessions remain excluded.

## Performed exercise recents

Recent exercises derive the latest completed performed occurrence per source Exercise
Definition UUID. Active sessions and Planner selection do not count. No Catalog
timestamp, counter, or usage table is persisted.

History's own exercise list labels each performed exercise with the name captured
at its latest completed occurrence rather than resolving the Catalog, so a
deleted definition stays listed and reachable under the name history recorded.
The Workout Session exercise picker still resolves only still-existing
definitions and preserves recency order, because choosing an exercise to perform
needs a definition that exists.

## Experience, accessibility, privacy, and failures

Workout links to History without adding another primary tab. History provides Day,
Week, and Month range controls, previous/next period actions, a textual summary,
bounded recent cards, and read-only detail. Snapshot names, planned context, and
performed sets remain visibly distinct. Profile units affect formatting only.

Screens support Dynamic Type, native headings and controls, descriptive history-card
labels, explicit units, textual empty/error states, and privacy-safe stable test IDs.
Errors retain already loaded pages where possible and never expose SQL, identifiers,
names, dates, or measurements.

All data remains in the operating-system application sandbox. There is no network,
telemetry, account, permission, external service, AI, cache, background worker, or
new dependency. Encryption, export, backup, retention, and synchronization remain
future reviewed capabilities.
