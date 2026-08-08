# Specification 0015: Workout history and progress foundation

- Status: Approved
- Date: 2026-08-08

## Objective and scope

Add device-local browsing of completed Workout Sessions and the first deterministic
progress summaries derived exclusively from performed actual sets. Users can browse
bounded history, open a read-only completed-session detail, review daily, weekly,
and monthly summaries, inspect exercise performance history, and use genuinely
performed exercises as recent Catalog choices.

This sprint is a progress foundation, not the full Analytics capability. Charts,
coaching, adherence, estimated strength, personal-record claims, calories, cloud
behavior, and AI remain excluded.

## Historical authority and time semantics

Completed Workout Sessions are authoritative. History uses captured session and
exercise snapshots and never rejoins mutable Planner or Catalog records for display.
Planned prescriptions remain neutral historical context; only actual sets contribute
to progress calculations.

The captured `started_local_calendar_date` permanently groups a session by the day
on which it began. Daily ranges contain one captured date, weekly ranges are
Sunday-to-Saturday, and monthly ranges are calendar months. Travel or later timezone
changes do not regroup history. Workouts crossing midnight remain on their captured
start day.

## Read models and calculations

A capability-owned `workout-history` read side exposes bounded completed-session
pages, one completed aggregate, date-range summaries, exercise-performance pages,
and bounded performed-exercise recents. It reads the existing Workout Session tables
through focused repository contracts; session mutation and the narrow lifecycle-only
completion update remain unchanged.

Summaries may include completed-workout frequency, performed exercise and set counts,
elapsed workout time, repetitions, duration, distance, and recorded load volume.
Recorded load volume is `sum(resistance grams × repetitions)` for external-load and
bodyweight-added-load modes only. Bodyweight is never inferred. Assistance is shown
as assistance and excluded from load volume. Distance-duration pace is derived from
actual distance and duration. Missing or ineligible dimensions are absent rather
than treated as zero.

Personal-record badges, cross-mode scores, physiological claims, and strength
estimates are deferred because their comparison semantics require a separate design.

## Persistence, queries, and pagination

All summaries remain derived. No summary table, cache, trigger, usage counter, or
completion-time child rewrite is introduced. Forward-only migration 10 adds focused
indexes for completed local-date history and source-exercise history; the version-9
schema already contains all authoritative facts.

History uses deterministic keyset pagination ordered by captured local date,
start instant, and UUID descending. Pages default to 20 and are bounded at 50.
Range queries use bound local-date limits and SQL aggregation. Full children load
only for one detail aggregate. Corrupt storage fails safely rather than silently
dropping records.

Performed-exercise recents derive the latest completed-session occurrence per source
Exercise Definition UUID. Current selection UI may resolve those UUIDs to existing
Catalog items, but history never does. Planner selection and active sessions do not
create recents, and no persistent Catalog usage metadata is added.

## Experience and accessibility

Workout retains one primary tab and adds a clear Workout History destination. The
history screen provides Day, Week, and Month periods, previous/next navigation,
deterministic summaries, a bounded recent-workout list, empty/error states, and an
exercise-history entry point. Completed detail shows snapshot names, planned context,
and performed results as distinct read-only content.

Interfaces use the design-system public API, Dynamic Type, native semantics,
descriptive period controls and history cards, explicit units, minimum targets,
textual status, and stable privacy-safe test identifiers only where selectors would
otherwise be ambiguous. Meaning never depends on color, icons, or charts.

## Privacy, security, and performance

Workout history remains in the operating-system application sandbox. There is no
network, account, telemetry, AI, permission, external service, or new dependency.
SQL is bound, stored values are reconstructed through validated types, and errors or
diagnostics do not expose identifiers, names, dates, or fitness values.

Queries remain bounded and indexed. There is no full-history JavaScript scan,
N+1 detail loading, speculative cache, background worker, or persisted analytics.

## Verification and completion

Domain-independent projection tests cover mode eligibility, totals, volume, pace,
date boundaries, and undefined behavior. Application and persistence tests cover
pagination, completed-only filtering, ordering, range aggregation, recents, corrupt
rows, safe failures, migration 10, and preserved narrow completion. Presentation
tests cover navigation, loading, empty, error, detail, units, and accessibility.

Sprint 15 adds a Maestro suite that completes a synthetic workout through public UI,
opens history and detail, verifies actual data and restart persistence, and enters
the stable regression suite. Merge readiness requires:

```bash
./scripts/qa.sh sprint 15 --platform ios
```

Android must also run when native tooling is available and validated; it must not be
claimed otherwise. VoiceOver, TalkBack, Dynamic Type, appearance, timezone and
calendar boundaries, historical-schema upgrade, interruption, and visual quality
remain targeted manual QA.

## Explicit exclusions

Completed-session editing or deletion, adherence, streaks, missed-workout judgments,
charts, PR claims, one-repetition-max estimates, advanced strength algorithms,
calorie burn, coaching, recommendations, Planner mutation, timers, advanced sets,
backend behavior, authentication, synchronization, notifications, export, backup,
encryption, telemetry, AI, and external integrations are excluded.

The repository owner approved the Stage 1 design and requested staged,
commit-by-commit implementation on 2026-08-08.
