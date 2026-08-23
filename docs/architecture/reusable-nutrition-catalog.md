# Reusable nutrition catalog architecture

## Purpose and boundary

The device-local Nutrition catalog stores reusable food and caloric-beverage
profiles so users can log a known item by entering only grams or milliliters. It
extends the existing mobile `nutrition-logging` capability and uses no network,
backend, provider, analytics, or AI behavior.

`NutritionCatalogItem` is an application-owned immutable aggregate composed from
validated `DomainId` and `NutritionFacts`. It adds catalog kind, favorite state,
last-used epoch, and use count. Mutable catalog metadata remains outside the pure
Nutrition domain. Food profiles require mass references; beverage profiles
require volume references.

## Catalog versus diary

Catalog items are mutable templates. Consumption entries are historical
snapshots. Log-from-catalog creates a new consumption UUID and copies the current
description, reference facts, provenance, and consumed physical quantity into the
diary table. Consumption rows store no catalog ID and are never joined to catalog
rows for display or aggregation.

Consequently, catalog edits affect only future reuse, and catalog hard deletion
cannot alter historical entries or daily totals. Saving an existing diary entry
as reusable copies its original `facts`, never its scaled `consumedFacts`.

## Identity, search, favorites, and recents

Expo Crypto creates independent RFC 4122 UUIDs for catalog items and consumption
events; `DomainId` validates them. Names are not identifiers.

Search normalization trims, collapses whitespace, and lowercases. The normalized
value is persisted beside the unchanged trimmed display name and revalidated when
a row is read. Exact normalized names may coexist after an explicit “Keep both”
confirmation. Records are never automatically merged.

Search performs a bounded literal substring match after escaping SQLite `LIKE`
wildcards. Favorites and recents use focused bounded queries. Recent order is
last-used epoch descending, use count descending, normalized name, then ID.
Creation and edits do not make an item recent.

## Logging transaction and persistence

`LogFromNutritionCatalogUseCase` loads the item inside the existing transaction
abstraction, builds a `ConsumptionEntry` for the current local time, inserts its
snapshot, then increments use count and records last-used time. Both writes use
transaction-scoped repositories. A failure rolls back both operations.

The use case takes an optional local calendar day. Omitted, it behaves exactly as
above. Given one, it re-validates that day rather than trusting the screen,
records at noon on it with that instant's offset, and refuses a day that is not a
calendar date or has not happened with a fixed sentence carrying no field, so the
log screen renders it in its existing live region. Last-used time keeps the clock
in both cases, because usage recency is when the item was reached for and not the
day the entry was attributed to. The log control names the day it will record to:
`Log to today`, or the day the diary was showing. See
[ADR 0027](../decisions/0027-a-day-control-governs-what-a-screen-records.md).

Scaling remains in `ConsumptionEntry.create` and `scaleNutritionFacts`. Unknown
nutrients remain `null`; known zero remains zero. Mass and volume are never
converted.

Migration 5 adds `nutrition_catalog_item`, containing identity, kind, display and
normalized names, canonical reference and nutrition columns, provenance,
favorite state, and usage metadata. Constraints enforce valid dimensions and
values. Indexes support normalized-name lookup, favorites, and recents. A
leading-wildcard substring may scan the personal catalog, which is acceptable at
hundreds or a few thousand rows. No foreign key connects catalog and diary.

## Experience, accessibility, privacy, and limitations

Nutrition Add opens search, favorites, recents, reusable-item creation, and
one-time manual entry. Selecting a saved profile opens a quantity-only form. The
diary editor can prefill a reusable profile.

Controls retain Dynamic Type, logical focus, minimum touch targets, visible units,
textual errors, busy states, meaningful empty states, and accessible destructive
confirmation. Favorite controls announce the item name and add/remove action.

Data remains in the OS-protected application sandbox. Queries use bound
parameters, stored rows are validated, and errors do not expose sensitive data.
There is no networking, analytics, telemetry, or AI. Household quantities,
density, recipes, hydration, external providers, targets, synchronization,
encryption, export, backup, restore, and reset remain unavailable.

`nutrition_catalog_item` carries the synchronization-readiness metadata
described in
[Schema synchronization readiness](schema-synchronization-readiness.md).
Deleting a catalog item tombstones the row rather than removing it; every
read here, including the duplicate-name check, already excludes a
tombstoned row. Full deletion reconciliation across devices remains a
question for whatever design actually builds synchronization.
