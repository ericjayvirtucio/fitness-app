# Specification 0010: Offline hydration tracking

- Status: Approved
- Date: 2026-08-04

## Objective and scope

Add a dedicated device-local Hydration capability. Users can record plain water
or another explicitly identified fluid, edit and hard-delete entries, navigate
captured local calendar days, inspect deterministic daily totals, and configure
a manual daily fluid target without network access.

Hydration is independent of Nutrition. Sprint 10 does not infer fluid intake from
Nutrition beverage rows, store nutrition composition, or create linked records.

## Domain and ownership

`@fitness/domain` owns immutable `HydrationEntry` and `HydrationTarget` values and
pure daily aggregation. They reuse `DomainId`, `Volume`, `Result`, and
`DomainError`. Hydration owns its target; Personal Profile and Goals & Energy do
not store or derive it.

An entry contains a caller-generated UUID, `plain-water` or `other-fluid`, a
positive canonical volume, optional short description for another fluid, an
occurrence instant, captured local calendar date, and captured UTC offset. Plain
water has no stored description. Entry volume is limited to 10,000 mL and target
volume to 20,000 mL as input-integrity boundaries, not medical guidance.

All explicitly logged fluid contributes one-for-one to total intake. No
beverage-specific hydration factor or medical effect is modeled.

## Time, identity, and mutation

Hydration reuses Nutrition's historical-day semantics: persistence records epoch
milliseconds, `YYYY-MM-DD`, and the observed UTC offset. Domain construction
verifies agreement, and daily queries use the captured date so later timezone
changes do not regroup history. Application behavior rejects future occurrences.

Expo Crypto generates RFC 4122 UUIDs at mobile composition. Edits replace the
validated entry state while retaining identity and may move an entry to another
day. Deletion is a confirmed local hard delete. Sync metadata and tombstones are
deferred.

## Target and aggregation

There is no default or inferred target. Logging and totals work without one. A
user may enter an explicit target in milliliters or liters; `Volume` converts it
to canonical milliliters.

Daily aggregation derives entry count, total fluid, plain water, other fluid,
target, nonnegative remaining volume, and completion percentage. Actual intake
and numeric percentage are never capped; remaining becomes zero above target.
Visual fill may stop at its track boundary, but text and accessibility output
must expose actual values.

The singleton target is current configuration rather than historical target
history. Target progress is therefore presented for today. Historical days show
stable recorded totals without claiming historically stable goal completion.
Derived summaries are not persisted.

## Mobile architecture and persistence

The `hydration-tracking` mobile feature follows the accepted capability-owned
application slice. Narrow entry and target repository contracts are implemented
by SQLite adapters. Simple single-statement writes do not use an application
transaction. Raw rows are reconstructed through domain factories, all record
values are bound, and failures use safe existing persistence errors.

Migration 6 adds `hydration_entry`, a focused index on captured date and
descending occurrence, and singleton `hydration_target`. It adds no Nutrition
foreign key, aggregate, cache, timestamp metadata, or synchronization fields.

## Experience and accessibility

The existing Today tab becomes the Hydration daily surface; no sixth tab is
added. Nested routes provide add/edit and target configuration. Logging supports
explicit 250, 350, 500, 750, and 1,000 mL presets plus custom milliliters. No
ambiguous glass, bottle, cup, or other container unit is used.

Screens include date navigation, totals, no-target guidance, target progress for
today, ordered entries, and loading, empty, validation, not-found, persistence,
and destructive-confirmation states. UI reuses the design-system public API and
supports Dynamic Type, logical focus, keyboard interaction, minimum touch
targets, visible units, live-region feedback, and meaningful progress text for
VoiceOver and TalkBack. Meaning never relies on color or a graphic alone.

## Privacy, security, and performance

Hydration history is sensitive health-adjacent information. It remains in the
operating-system application sandbox and is never logged, transmitted, analyzed,
or sent to a third party. SQL uses bound values and persisted rows are validated.
Application-level encryption, export, backup, restore, reset, and retention are
deferred.

One indexed query loads a selected day and one singleton query loads the target.
Aggregation is linear in that small result. There are no per-card reads, global
state, speculative caches, persisted summaries, background workers, or new
dependencies.

## Verification and completion

Domain tests cover entry, target, time, category, canonical volume, immutability,
daily subtotals, missing target, remaining volume, and over-target behavior.
Application and persistence tests cover CRUD, identity, daily grouping, target
save/read, migration, constraints, invalid rows, safe failures, and Nutrition
independence. UI tests cover principal screen states, logging, target progress,
editing, deletion, date navigation, failures, and accessibility semantics.

Completion requires formatting, linting, strict type checking, tests, builds,
Expo dependency validation, `git diff --check`, staff-level review, and the
Sprint 10 manual checklist. Merge readiness remains blocked until the repository
owner confirms manual QA.

## Alternatives and trade-offs

Plain-water-only tracking was rejected because the approved objective includes
explicit other fluids. Deriving Hydration from Nutrition was rejected because it
would create hidden ownership and editing/deletion coupling. Profile or Goals
target ownership was rejected because the target controls Hydration behavior and
requires neither profile completion nor calorie calculations. A sixth tab,
historical target versions, persisted summaries, generic repositories, an ORM,
and transactions around single statements were rejected as disproportionate.

Other-fluid support is useful but deliberately makes no claim that all fluids
have identical physiological effects. A singleton target keeps today's workflow
simple but cannot reconstruct historical goals. Optional descriptions improve
readability while minimally increasing stored sensitive data.

## Explicit exclusions

Automatic Nutrition integration, medical recommendations, personalized targets,
historical target versions, inferred household/container quantities, reminders,
notifications, streaks, achievements, weekly or monthly analytics, Gemini,
barcode or camera scanning, fuzzy matching, recipes, HealthKit, Health Connect,
authentication, backend behavior, cloud synchronization, conflict resolution,
tombstones, encryption, export, backup, restore, reset, and retention workflows
are excluded.

The repository owner approved the Stage 1 design and requested staged,
commit-by-commit implementation on 2026-08-04.
