# Specification 0016: Progress analytics and human-readable QA reporting

**Status:** Approved for implementation on 2026-08-09.

## Objective and scope

Replace the Progress tab placeholder with deterministic, offline summaries of
persisted nutrition, hydration, and completed-workout history. The screen
supports Today, This Week, and This Month using captured local-calendar dates.

The repository-owned Maestro wrapper will also report independently runnable
scenarios as human-readable PASS, FAIL, ERROR, or SKIP results while preserving
JUnit and runner exit status.

## Historical authority and period semantics

- Nutrition uses immutable consumption-entry snapshots.
- Hydration uses persisted entries, without applying the mutable current target
  to historical dates.
- Workout metrics use completed sessions and actual sets only.
- Profile, weight, goals, catalogs, and plans are not historical authority.
- Weeks run Sunday through Saturday, matching Workout Planner and Sprint 15.
- Months are calendar months. Range endpoints are inclusive.
- Membership uses the local-calendar date captured when the record was created;
  records are never regrouped through the device's current UTC offset.

## Analytics behavior

The selected period presents:

- Nutrition total energy, entry count, logged days, and average daily energy
  over logged days. Protein, carbohydrate, and fat totals/averages are exact
  only when every included entry supplies that nutrient.
- Hydration total fluid, plain water, other fluid, entry count, logged days,
  and averages over hydration-logged days.
- Completed workout count, performed exercise count, actual set count, elapsed
  session time, and logging-mode-eligible result totals.
- A compact daily breakdown for week and month periods.

An unlogged date is no data, not zero. A logged nutrition day may truthfully
have zero energy. An optional nutrient is incomplete when any included entry
has an unknown value; known values are never presented as a falsely complete
period total or average.

## Architecture and persistence

Progress is a mobile application/presentation capability. It orchestrates
capability-owned range readers for Nutrition and Hydration and the existing
Workout History range summary. SQLite remains inside source-capability
adapters. React components do not calculate analytics or query tables.

Summaries remain derived. Existing local-date indexes cover the bounded
one-month queries, so this sprint adds no tables, indexes, migrations, caches,
background work, or external dependencies.

## Experience and accessibility

The screen uses the existing design system, a selected-state period control,
previous/next navigation, a small number of summary surfaces, and explicit
loading, failure, empty, and incomplete states. Text summaries are preferred to
charts. Content must wrap under Dynamic Type, expose meaningful combined labels,
and never communicate state by color alone.

The UI is descriptive and must not coach, prescribe, score, or diagnose.

## QA reporting

`scripts/qa.sh` remains the only QA entry point and Maestro remains the only E2E
runner. Suites intended for scenario reporting resolve to independently
runnable top-level flows so Maestro emits one JUnit testcase per scenario.

After a run, the wrapper derives:

- terminal scenario lines and aggregate totals;
- `report.txt` for durable human-readable evidence;
- `report.json` for repository-owned structured consumption;
- the existing raw `junit.xml`, `cli.log`, screenshots, and debug evidence.

Each scenario record contains its name, source file, status, duration, optional
failure detail, and only artifact references that can be associated reliably.
Missing or malformed JUnit is a reporting-integrity failure. Maestro failure
status always takes precedence and is never converted to success.

## Verification and completion

- Unit tests cover period rollover, Sunday boundaries, missing versus zero,
  nutrient completeness, range validation, formatting, and report parsing.
- SQLite integration tests cover bounded range grouping and actual historical
  authority.
- Presentation tests cover loading, failure, empty, selected periods, metrics,
  incompleteness, navigation, and accessible labels.
- Sprint 16 Maestro scenarios cover empty, nutrition/hydration, workout, and
  persistence behavior through public controls.
- Repository formatting, lint, type checking, tests, and builds pass without
  warnings.
- Manual QA covers assistive technology, Dynamic Type, appearance, timezone,
  failure states, and sensitive artifact review.

## Explicit exclusions

Backend services, synchronization, external analytics, telemetry, AI insights,
coaching, charts, persisted analytics, target-adherence history, weight/BMI
trends, planner adherence, universal scores, streaks, notifications, export,
and a second QA runner or CLI are excluded.

## Amendment: the presented values match the promised ones

The nutrient totals/averages and the hydration other-fluid total and averages
enumerated above were computed on every load, typed on the read model, and
rendered nowhere. Progress now presents an average per logged day for protein,
carbohydrate, and fat, the period's other fluid, and an average plain water per
logged day, so the screen states everything this specification promised. Each
average is labelled by the value it averages, an unknown average reads as its
unknown total already did, and no stored value, SQL statement, reader contract,
query, or total changed. See
[Specification 0038](0038-progress-states-everything-it-counted.md) and
[ADR 0028](../docs/decisions/0028-a-summary-states-every-value-it-computes.md).
