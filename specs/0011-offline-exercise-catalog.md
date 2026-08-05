# Specification 0011: Offline exercise catalog

- Status: Approved
- Date: 2026-08-04

## Objective and scope

Add a device-local catalog of reusable exercise definitions. A user can create,
edit, hard-delete, search, favorite, and browse exercises without a network
connection. Workout planning, sessions, sets, history, recents, analytics, and
exercise content remain excluded.

## Domain and ownership

`@fitness/domain` owns immutable `ExerciseDefinition` values composed from an
existing `DomainId`, a trimmed name, controlled principal equipment and primary
muscle-group vocabularies, a controlled logging mode, and optional short notes.
The logging mode describes which measurements a future session may accept; it
does not store set or session measurements. Favorite state and normalized search
text are device-local catalog metadata owned by the mobile application.

The initial model deliberately has one principal equipment and one primary
muscle group. Secondary muscles, movement patterns, laterality, exercise types,
and multi-equipment relationships are deferred until a planner, session, or
analytics workflow demonstrates their value.

## Logging modes

The supported modes are repetitions, external load plus repetitions, bodyweight
plus repetitions, bodyweight with added load plus repetitions, assistance plus
repetitions, duration, distance, and distance plus duration. Narrow compatibility
rules prevent clearly incoherent equipment/mode combinations. Future values use
the existing canonical `Mass`, `Length`, and `Duration` concepts.

## Catalog behavior

Expo Crypto generates catalog UUIDs at composition. Names are not identities.
Search trims and collapses whitespace, applies deterministic lowercase folding,
escapes SQLite `LIKE` wildcard characters, and performs bounded substring
matching. Exact normalized-name matches warn and require explicit confirmation,
but duplicates remain allowed. Similar names are independent.

Favorites persist in the catalog row and remain separate from the pure exercise
definition. Recents are deferred because no real exercise usage event exists;
creation and edit dates are not substitutes for usage.

Edits retain identity and favorite state. Deletion is a confirmed local hard
delete. When plans and sessions are introduced, plan reference behavior must be
designed explicitly and completed session records must snapshot sufficient
exercise context so mutable catalog data cannot rewrite history.

## Persistence and experience

Forward-only migration 7 adds `exercise_catalog_item`, constraints for all
controlled values and meaningful field bounds, and focused normalized-name and
favorite indexes. Rows are reconstructed through domain and application
factories. SQL is bound and failures use existing safe persistence errors. There
is no seed data, history, aggregate, timestamp, cloud identity, or tombstone.

The Workout tab becomes an honest landing page whose first available capability
is Exercise Library. Nested routes provide browse, create, and edit flows while
leaving the tab available for future Planner and Session entry points. The UI
uses the design-system public API and supports Dynamic Type, screen readers,
keyboard interaction, minimum targets, textual errors, meaningful favorites,
and descriptive destructive confirmation.

## Privacy, performance, and verification

Exercise definitions remain in the operating-system application sandbox. No
network, analytics, telemetry, AI, sensitive logging, or new dependency is
introduced. Focused bounded queries avoid N+1 reads; a local substring scan is
acceptable for hundreds or a few thousand items.

Domain, application, persistence, and UI tests cover invariants, compatibility,
normalization, duplicates, CRUD, favorites, ordering, corrupt rows, safe errors,
navigation, failures, and accessibility. Completion requires all repository
quality gates and the Sprint 11 manual checklist. Merge readiness remains blocked
until the repository owner confirms manual QA.

## Explicit exclusions

Seeded or global catalogs, secondary muscles, movement patterns, laterality,
planner schedules, templates, sessions, sets, actual measurements, rest timers,
history, recents, volume, records, recommendations, instructions, media, medical
claims, Nutrition or Hydration coupling, health integrations, authentication,
backend behavior, synchronization, tombstones, encryption, export, backup,
restore, reset, analytics, telemetry, AI, and external services are excluded.

The repository owner approved the Stage 1 design and requested staged,
commit-by-commit implementation on 2026-08-04.
