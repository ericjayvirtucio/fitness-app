# Specification 0009: Reusable nutrition catalog

- Status: Approved
- Date: 2026-08-03

## Objective and scope

Add a device-local catalog of reusable food and caloric-beverage nutrition
profiles. A user can create, edit, delete, search, favorite, and reuse profiles
without a network connection. Selecting a saved profile requires only a consumed
quantity in grams or milliliters before creating a diary entry for the current
local time. An existing diary entry can prefill a new reusable profile from its
original reference facts.

The catalog reduces repeated nutrition entry without becoming the authority for
historical consumption. Gemini, external providers, household quantities,
recipes, hydration, analytics, authentication, backend behavior, and cloud
synchronization remain excluded.

## Model and boundaries

`NutritionCatalogItem` is a mobile application concept composed from validated
`DomainId` and `NutritionFacts` values. It adds only catalog lifecycle data:

- `food` or `beverage` kind;
- favorite state;
- nullable last-used epoch; and
- nonnegative use count.

Food requires a mass reference and beverage requires a volume reference. Usage
count zero requires no last-used timestamp; positive usage requires one. Mutable
favorite and usage metadata do not enter `@fitness/domain` or `NutritionFacts`.
Catalog persistence rows are reconstructed through domain and application
factories before use.

Catalog IDs and consumption-entry IDs are independently generated RFC 4122 UUIDs
using Expo Crypto at the composition boundary and validated by `DomainId`. Names
are not identities.

## Nutrition references and historical snapshots

Catalog facts retain their explicit canonical reference magnitude. A profile per
250 milliliters remains per 250 milliliters; it is not rewritten per 100. Energy
uses kilojoules in persistence, and supported nutrients retain their existing
canonical units. `null` remains unknown and numeric zero remains known zero.

Logging copies the selected catalog item's current description, reference facts,
provenance, and consumed physical quantity into a newly identified
`ConsumptionEntry`. The diary row stores no catalog ID and never joins catalog
state for history or aggregation. Editing or deleting a catalog item therefore
cannot change an existing entry or its daily totals.

Saving a diary entry as reusable copies `entry.facts`, not scaled
`entry.consumedFacts`, and opens a confirmation form before insertion.

## Search, duplicates, favorites, and recents

Search uses a stored lightweight normalized name: trim, collapse internal
whitespace, and deterministic case-folding. The display name remains the trimmed
domain description. Queries escape SQLite `LIKE` wildcard characters and perform
bounded case-insensitive substring matching. Empty queries use focused favorite
and recent queries rather than loading the whole catalog.

Exact normalized names are not unique. A matching name produces a warning and
requires explicit confirmation, but the user may save another item. Similar
names are not merged or treated as equivalent.

Favorites are persisted catalog metadata and are listed by normalized name with
an ID tie-breaker. Recents are based on successful catalog reuse, ordered by
last-used epoch descending, use count descending, normalized name, then ID.
Creation and editing do not make an item recent.

## Application behavior and transactions

Capability-specific use cases support create, update, delete, get, browse,
favorite, log-from-catalog, and save-entry-as-catalog behavior. A
capability-owned repository exposes focused catalog operations; no generic CRUD
or search repository is introduced.

Log-from-catalog validates the selected item and consumed dimension, creates a
new consumption snapshot for the current local time, and atomically inserts the
diary entry and updates catalog usage through the existing `TransactionRunner`.
If either write fails, neither change commits.

Expected validation returns safe field-addressable domain errors. Missing records
are explicit safe outcomes. SQLite failures use existing stable persistence
errors and never expose SQL, bound values, identifiers, names, timestamps, or
nutrition values.

## Persistence and queries

Forward-only migration 5 adds `nutrition_catalog_item`. It stores UUID, kind,
display and normalized names, canonical reference and nutrition values,
provider-neutral provenance, favorite state, and usage metadata. Constraints
enforce supported kinds, positive references, nonnegative nutrition values,
nullable nutrients, boolean favorite storage, dimensional compatibility, and
consistent usage metadata.

There is no foreign key between catalog and diary tables, no creation/update
timestamps, tombstone, cloud identifier, provider identifier, or sync metadata.
Catalog deletion is a local hard delete and must be revisited with synchronization.

Indexes support exact normalized-name lookup, favorite ordering, and recent
ordering. Leading-wildcard substring search may scan the personal catalog, which
is acceptable for hundreds or a few thousand local records. Full-text, fuzzy,
semantic, and server search are excluded.

## Experience and accessibility

The diary Add action opens a saved-item browser with search, bounded favorites,
bounded recents, create-reusable, and one-time-manual actions. Selecting a saved
item opens a compact quantity-only form. Catalog create/edit uses food or beverage
to determine grams or milliliters and reuses domain validation. Existing entry
editing offers “Save as reusable item.”

The experience supports Dynamic Type, logical keyboard and screen-reader focus,
minimum touch targets, visible units, textual validation, busy states, meaningful
empty states, and destructive confirmation. Favorite controls state the item name
and add/remove action; meaning never relies on a star or color alone.

## Privacy, security, and performance

Catalog and diary data remain in the operating-system application sandbox. No
networking, analytics, telemetry, AI, or sensitive diagnostic logging is added.
SQL values are bound and stored rows are validated. Application-level database
encryption remains deferred to dedicated key-management work.

Favorites, recents, exact-name checks, and search use focused bounded queries.
Recents do not read diary history, result hydration has no N+1 reads, and logging
holds one short local transaction. No global state, speculative cache, or new
dependency is introduced.

## Verification and completion

Application tests cover construction, compatibility, normalization, duplicates,
CRUD, favorites, recents, log scaling, snapshot independence, usage, transaction
failure, repository failure, and save-from-entry behavior. Persistence tests
cover migration, constraints represented in SQL, bound canonical mappings,
queries, ordering, invalid rows, safe errors, and catalog deletion independent
of diary history. UI tests cover empty, loading, error, create/edit/delete,
search, favorites, recents, fast food/beverage logging, validation, save-from-entry,
and accessibility behavior.

Completion requires formatting, linting, strict type checking, tests, builds,
Expo dependency validation, `git diff --check`, staff-level diff review, and the
Sprint 9 manual checklist. Merge readiness remains blocked until the repository
owner confirms manual QA.

## Alternatives and trade-offs

Putting catalog lifecycle metadata in `@fitness/domain` was rejected because it
has one device-local application consumer. A catalog foreign key on diary rows was
rejected because it implies historical dependence. Forced per-100 normalization,
unique names, automatic merging, diary-derived recents, full-text search, soft
delete, a separate tab, and a saved-source diary badge were rejected as either
lossy, destructive, ambiguous, or disproportionate.

Storing a normalized name duplicates derivable data but makes deterministic
offline lookup straightforward. Substring search does not fully exploit a B-tree
index, but local scale keeps it appropriate. Atomic logging means a usage-metadata
failure also rejects the diary insert, preserving a truthful outcome that can be
safely retried.

## Explicit exclusions

Gemini, external nutrition APIs, seeded food databases, barcode or camera input,
household units, density, synonym and fuzzy search, automatic merging, recipes,
meal categories, hydration, nutrition targets, charts, analytics, notifications,
authentication, backend endpoints, cloud synchronization, tombstones, HealthKit,
Health Connect, subscriptions, encryption, export, backup, restore, reset, and
retention workflows are excluded.

The repository owner approved the Stage 1 design and staged implementation on
2026-08-03.
