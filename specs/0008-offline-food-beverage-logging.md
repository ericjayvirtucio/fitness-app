# Specification 0008: Offline food and beverage logging

- Status: Approved
- Date: 2026-08-02

## Objective and scope

Allow users to manually record food and caloric beverage consumption without a
network connection, edit or delete those records, and view accurate totals for a
device-local calendar day. Entries use the canonical Nutrition quantities and
composition established by Specification 0007.

This sprint introduces no catalog, household-serving conversion, external
nutrition provider, AI behavior, authentication, backend endpoint, or cloud
synchronization.

## Domain model and identity

`@fitness/domain` owns an immutable `ConsumptionEntry` and pure daily aggregation.
An entry contains a caller-generated UUID, a `food` or `beverage` kind, an
occurrence instant, the local calendar date and UTC offset observed for that
instant, source `NutritionFacts`, and a positive consumed quantity with the same
mass or volume dimension as the facts reference.

The UUID identifies the consumption event, not a reusable food. Descriptions and
nutrition composition are entry-owned snapshots. Randomness and clocks remain at
the mobile composition boundary. Energy remains required. Nutrient `null` remains
unknown and numeric zero remains known zero.

## Time and daily boundaries

Persistence records epoch milliseconds, `YYYY-MM-DD` local calendar date, and the
captured UTC offset in minutes. Domain creation verifies that these values agree.
Daily membership uses the captured calendar date, so travel or later timezone
changes do not move historical entries between days. The UI defaults to the
current local date and time, accepts past consumption, and rejects future
occurrences.

## Application architecture

The mobile `nutrition-logging` capability follows the accepted feature-first
application slice. Create, update, delete, get-by-id, and get-daily use cases
depend on a capability-owned `ConsumptionEntryRepository`. SQLite infrastructure
implements that contract, reconstructs every row through domain factories, and
uses bound parameters. Thin Expo Router modules compose the Nutrition diary and
entry editor.

Edits completely replace the mutable snapshot while retaining the UUID. A missing
update or delete target is an explicit safe outcome. Delete is a confirmed local
hard delete; tombstones require a future synchronization design.

## Persistence

Forward-only migration 4 creates `nutrition_consumption_entry`. It stores:

- UUID and food/beverage kind;
- description, physical reference kind and canonical amount;
- consumed canonical amount;
- energy in canonical kilojoules;
- nullable canonical nutrient columns;
- provider-neutral provenance; and
- occurrence epoch, captured calendar date, and UTC offset.

An index on calendar date, descending occurrence, and ID supports the principal
daily query. Source facts and consumed quantity are persisted; scaled facts are
derived through `scaleNutritionFacts`, preventing duplicated totals from drifting.
No down migration or destructive recovery is provided.

## Daily totals and precision

Energy is summed after each entry is scaled to its consumed quantity. For each
optional nutrient, an empty day totals zero, a day where every entry has a known
value totals their sum, and any unknown contribution makes the daily total
unknown. Presentation must label an unknown aggregate as incomplete rather than
showing zero. Domain arithmetic retains full precision; rounding is presentation
only.

## Experience and accessibility

The Nutrition tab becomes a daily diary with date navigation, calorie and nutrient
totals, ordered entry cards, empty/loading/error states, and an add action. A
nested editor supports create and edit for description, entry kind, mass or
volume reference, reference nutrition, consumed amount, and local date/time.
Blank optional nutrients mean unknown; entered zero means known zero. No vague
serving unit is offered.

The flow preserves Dynamic Type, native focus order, keyboard access, 44-point
targets, visible unit labels, radio semantics, live-region feedback, destructive
confirmation, light/dark appearance, and meaning independent of color. VoiceOver,
TalkBack, large text, and keyboard behavior require manual verification.

## Failure, privacy, and security

Expected validation failures return existing safe domain results. Persistence
failures use stable `PersistenceError` messages; raw SQL, bound values, UUIDs,
descriptions, timestamps, and nutrition values are never logged or displayed in
technical errors. Failed writes retain form input and never clear existing data.

Food history is sensitive health-adjacent information and remains inside the
operating-system application sandbox. There is no transmission, analytics, or AI
processing. Application-level database encryption, backup, export, retention,
bulk reset, and stronger device-compromise protection remain deferred.

## Verification

Domain tests cover entry invariants, temporal consistency, dimension safety,
scaling, unknown propagation, known zero, empty days, precision, and public
exports. Application tests cover parsing, injected clocks and IDs, transactions,
not-found outcomes, and daily orchestration. Persistence tests cover migration 4,
bound CRUD, ordering, nullable round trips, corrupt rows, and safe failures. UI
tests cover diary and editor states, focus refresh, validation, retry, deletion,
and accessibility semantics.

Completion requires repository formatting, lint, type checking, tests, builds,
Expo dependency validation, `git diff --check`, and the Sprint 8 manual checklist
on available iOS and Android targets.

## Alternatives and trade-offs

A reusable food entity was rejected because catalog lifecycle and matching are
out of scope. Description identity and auto-increment IDs were rejected because
they are nonunique or unsuitable for future offline reconciliation. Storing only
scaled facts would make quantity editing lossy; storing both source and scaled
facts would permit drift. UTC-derived day grouping was rejected because timezone
changes would rewrite history. Summing only known nutrient contributions was
rejected because it would present an incomplete value as a total.

Captured local-day metadata and source snapshots add columns but make diary
history stable and edits deterministic. Strict unknown aggregation produces fewer
numeric totals but preserves truth. Hard deletion is intentionally simple and
must be revisited with synchronization.

## Explicit exclusions

Catalogs, favorites, recent-food shortcuts, search, recipes, meal categories,
household measures, density, mass-volume conversion, water tracking, barcode or
image scanning, automatic recognition, Gemini, external nutrition APIs, nutrient
targets, charts, analytics, notifications, medical recommendations,
authentication, backend APIs, cloud synchronization, conflict resolution,
tombstones, export, backup, bulk reset, and application-level SQLite encryption
are excluded.

The repository owner approved the Stage 1 design on 2026-08-02 and requested
implementation in cohesive committed stages.

## Amendment: the daily totals card announces its contents

The daily totals card carries an `accessibilityLabel`, which makes it one
accessibility element, so its energy, entry count, six nutrient lines, and
completeness note reached no screen reader. Its accessible name now carries every
string it renders, in render order, composed from the same list the card maps
over. No displayed value or sentence changed. See
[Specification 0034](0034-announced-card-contents.md) and
[ADR 0024](../docs/decisions/0024-labelled-containers-announce-their-contents.md).
