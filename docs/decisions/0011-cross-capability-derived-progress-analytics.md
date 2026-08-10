# ADR 0011: Cross-capability derived progress analytics

**Status:** Accepted

## Context

The Progress tab needs a read-only view across Nutrition, Hydration, and Workout
History. Those capabilities already own authoritative historical records and
SQLite adapters. Creating a generic analytics repository would bypass those
boundaries, while loading each day through existing daily use cases would cause
dozens of queries for a month.

Profile weight, goal configuration, and hydration target are mutable singletons
without history and cannot support truthful historical comparisons.

## Decision

Create a Progress application slice that orchestrates narrow, capability-owned
range readers. Nutrition and Hydration own their grouped SQLite queries. Workout
History retains its completed-session range summary and adds daily grouping only
where the Progress read model needs it.

All summaries are derived at read time from persisted historical records.
Periods use inclusive captured local-calendar dates, with Sunday-start weeks and
calendar months. No analytics tables, generic query repository, or chart library
is introduced.

Shared calendar-period calculation belongs in the mobile application date
boundary because both Workout History and Progress consume it.

## Consequences

- Source capabilities continue to validate and map their own persistence rows.
- Progress can combine results without knowing SQLite schema details.
- Three bounded indexed queries occur when a period loads.
- Missing nutrition values require explicit completeness metadata.
- Mutable current goals, profile values, and hydration targets stay outside
  historical analytics.
- A future capability must add a narrow reader rather than arbitrary Progress
  SQL.

## Alternatives considered

- A Progress-owned analytics repository reduced file count but violated
  capability ownership.
- Repeated daily reads reused more existing code but scaled to 31 or more
  queries and hydrated unnecessary entities.
- Persisted rollups improved theoretical large-scale performance but introduced
  migrations and consistency risks without evidence.
- Charts improved visual scanning but added dependency and accessibility cost
  before a demonstrated need.
