# Offline workout history and progress architecture

## Boundary and historical authority

Workout History is a device-local read capability over completed Workout Sessions:

```text
completed session snapshots → workout-history use cases
  → WorkoutHistoryRepository → SQLite projections → history UI
```

Completed session, exercise, planned-target, logging-mode, and actual-set snapshots
are authoritative. History never rejoins mutable Exercise Catalog or Workout Planner
rows for display. Source UUIDs remain provenance and exercise-history identity only.
Planned prescriptions are labeled context; only actual sets contribute to performed
summaries.

Session execution and mutation remain in `workout-session`. Completion still updates
only the parent status and completion timestamp, and nothing but a deliberate user
correction, a deliberate user removal, a deliberate user addition, or a deliberate
user deletion may change a completed session. History owns all four workflows and
writes through the Workout Session repository contract. A correction changes
recorded set results and cannot change a captured snapshot or move a lifecycle
instant; a removal drops one session exercise with the sets it owns and renumbers
the survivors; an addition appends one session exercise holding the first set it
recorded, renumbering nothing; a deletion removes one whole completed workout with
everything it owns. None of them changes anything else. See
[completed workout correction](completed-workout-correction.md),
[completed session exercise removal](completed-session-exercise-removal.md),
[completed workout exercise addition](completed-workout-exercise-addition.md), and
[completed workout deletion](completed-workout-deletion.md).

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

Every other summarised dimension covers all recorded work of its own kind —
repetitions counts assisted and bodyweight repetitions alike — so recorded load
volume is the only total that excludes recorded work, and it is the only one that
states its coverage. The application now says so rather than leaving the reason
here: a period with eligible work reads
`160 kg-reps recorded load volume from weighted sets`, and a period that recorded
work with none of it eligible reads `No recorded load volume from weighted sets`.
A period that recorded nothing states neither, because the completed workout count
already does. The wording is unconditional, so no reader field reports whether
ineligible work is present, and the same sentence is produced for a per-exercise
row from the same function. See
[Specification 0033](../../specs/0033-summary-total-coverage.md) and
[ADR 0023](../decisions/0023-displayed-totals-state-their-coverage.md).

A recorded set is worded from the captured logging mode wherever completed
history displays one, so the completed workout detail and the correction screen
state `Assistance 20 kg × 8` or `Added 20 kg × 8` where they once stated only
`20 kg × 8`. The formatter is shared with the active session rather than
duplicated, so the same result reads identically in all three places. See
[Specification 0032](../../specs/0032-recorded-result-meaning.md).

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
bounded recent cards, and completed detail. Snapshot names, planned context, and
performed sets remain visibly distinct. Completed detail also carries the correction
controls for its recorded sets, the per-exercise removal control, and one entry
point for adding an exercise that was performed but never logged, and it never
carries an active-workout control. Profile units affect formatting only.

Screens support Dynamic Type, native headings and controls, descriptive history-card
labels, explicit units, textual empty/error states, and privacy-safe stable test IDs.
Every labelled card announces the contents it renders, not only its title, so the
performed summary and the completed workout summary are audible rather than
silent. See [Specification 0034](../../specs/0034-announced-card-contents.md) and
[ADR 0024](../decisions/0024-labelled-containers-announce-their-contents.md).
Errors retain already loaded pages where possible and never expose SQL, identifiers,
names, dates, or measurements.

All data remains in the operating-system application sandbox. There is no network,
telemetry, account, permission, external service, AI, cache, background worker, or
new dependency. Encryption, export, backup, retention, and synchronization remain
future reviewed capabilities.
