# Offline nutrition logging architecture

## Flow and boundaries

The Nutrition tab is a complete offline mobile capability:

```text
Nutrition routes
  → NutritionDiaryScreen / ConsumptionEntryScreen
  → capability-owned use cases and repository contract
  → ConsumptionEntrySqliteRepository
  → internal DatabaseConnection
  → Expo SQLite
```

`@fitness/domain` owns immutable consumption entries, entry kinds, temporal
consistency, canonical nutrition scaling, and daily aggregation. Application use
cases parse form strings, inject secure UUID generation and the current time,
reject future consumption, and coordinate transactions. Presentation owns labels,
date/time text entry, formatting, and interaction state. Raw SQLite rows never
escape infrastructure.

## Identity and snapshots

Every consumption event has a UUID generated through Expo Crypto at the mobile
composition boundary and validated through `DomainId`. The UUID does not identify
a reusable food. Description, reference composition, provenance, and consumed
quantity form an entry-owned snapshot.

Source facts and consumed quantity are persisted. Scaled consumed facts are
derived through `scaleNutritionFacts` after reconstruction. This supports accurate
quantity edits without introducing a catalog or duplicated scaled columns.

The reusable catalog can supply facts for a new entry, but the resulting row
still owns the complete snapshot and stores no catalog ID. Catalog edits and
deletion cannot change diary history; see
[Reusable nutrition catalog architecture](reusable-nutrition-catalog.md).

## Time and daily membership

An entry stores epoch milliseconds, a captured `YYYY-MM-DD` local calendar date,
and its UTC offset in minutes. Domain creation verifies that the calendar date is
the date produced by the instant and offset. Daily queries use the captured date,
so travel and device timezone changes do not regroup history.

The editor accepts local `YYYY-MM-DD` and 24-hour `HH:MM`, rejects nonexistent or
invalid wall times, obtains the platform offset for the selected instant, and
rejects future consumption. DST behavior follows the platform timezone database;
ambiguous repeated wall times resolve using the platform's `Date` behavior and
retain the selected resulting offset.

## Persistence and mutation

Migration 4 creates `nutrition_consumption_entry` and an index on local calendar
date, descending occurrence, and ID. Canonical mass and volume share numeric
columns discriminated by `reference_kind`. Energy uses kilojoules; nutrient
columns use their domain canonical units and remain nullable.

Every read recreates `DomainId`, measurement values, `Energy`, `NutritionFacts`,
and `ConsumptionEntry`. Invalid stored data becomes a safe `operation-failed`
error. All writes use bound parameters. Create, complete-replacement update, and
hard delete run through scoped transactions. Hard deletion deliberately has no
tombstone because synchronization is not designed.

## Aggregation

Daily energy is the sum of scaled entry energy. An optional nutrient totals zero
for an empty day, sums when every entry has a known value, and becomes `null` when
any entry contribution is unknown. The UI labels `null` as “Incomplete.” Known
zero remains zero throughout persistence, reconstruction, scaling, aggregation,
editing, and display.

Domain arithmetic retains full precision. Presentation rounds energy to whole
kilocalories and nutrients to at most one decimal place.

## Failure, privacy, and limitations

Validation errors are field-addressable and safe. Read, write, and delete failures
never clear existing data or expose SQL, descriptions, identifiers, dates, or
nutrition values. Food history remains in the OS-protected application sandbox
and is neither logged nor transmitted.

The capability has no household measure, density, meal category, hydration
workflow, external provider, AI, authentication, synchronization, export, backup,
bulk reset, or application-level SQLite encryption.
