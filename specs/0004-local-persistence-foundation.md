# Specification 0004: Local persistence foundation

- Status: Approved
- Date: 2026-08-01

## Objective

Establish production-oriented local persistence infrastructure for the mobile
application without introducing product records. The foundation initializes a
durable SQLite database, evolves it through ordered migrations, supports atomic
work, translates storage failures, and prevents SQLite details from reaching UI,
application, or domain code.

## Scope

The mobile application owns an app-local `expo-sqlite` adapter, database
initializer, forward-only migration runner, generic transaction contract,
persistence error type, dependency composition, and startup gate. Initialization
enables foreign-key enforcement and write-ahead logging before applying pending
migrations. Version 1 is an intentionally empty schema baseline; this sprint
creates no feature table.

The startup gate renders a progress state until the database is ready. Failure
shows a safe, accessible message and permits retry. Routes cannot render against
an uninitialized or partially migrated database.

## Architecture and dependencies

`expo-sqlite` is a production dependency of `@fitness/mobile`, the only runtime
that executes local database operations. The domain package remains free of
storage and framework dependencies. Future application capabilities own their
repository interfaces; mobile infrastructure implements those interfaces using
the internal database adapter. No generic CRUD repository or shared persistence
package is introduced.

The application-level transaction contract is generic over its context. Future
composition can supply capability repositories while the SQLite implementation
uses an exclusive, transaction-scoped connection internally. See
[ADR 0004](../docs/decisions/0004-expo-sqlite-local-persistence.md).

## Migration and transaction behavior

Migrations have contiguous positive integer versions, descriptions, and forward
`up` operations. `PRAGMA user_version` records the installed version. Each pending
migration and version update runs in one exclusive transaction. Missing or
reordered versions, failed migrations, invalid versions, and databases newer than
the application are initialization failures. Applied migrations are immutable;
future schema changes append a migration.

Successful transactions commit and thrown failures roll back. Transaction
callbacks must be short and must not perform network or UI work. Nested
transactions, savepoints, retries, and down migrations are excluded.

## Failure, privacy, and recovery

Infrastructure translates unknown driver failures to stable `PersistenceError`
codes with safe messages. Causes remain available internally but raw SQL, values,
paths, and records are not displayed. Initialization failure leaves product UI
unavailable and allows a non-destructive retry. Automatic database deletion or
reset is not permitted.

This sprint stores no fitness or identity information. Encryption at rest and key
management require a separate design before sensitive tables are introduced.

## Testing and acceptance

Deterministic tests verify initialization, migration ordering and idempotency,
unsupported versions, invalid migration sequences, transaction context wiring,
commit and rollback behavior, error translation, and startup loading, ready,
failure, and retry states. Simulator or device checks verify the native database,
restart, cold start, and platform behavior.

Completion requires formatting, linting, strict type checking, tests, builds,
Expo dependency validation, and `git diff --check` without warnings. Manual
platform verification remains required before merge is recommended.

## Explicit exclusions

Food, workout, hydration, profile, goals, analytics, authentication, APIs, cloud
sync, networking, notifications, AI, domain serialization, feature repositories,
feature tables, identifiers, clocks, deletion semantics, conflict resolution,
backup/export, SQLCipher, web persistence guarantees, and destructive recovery
are out of scope.

## Approval

The repository owner approved the Stage 1 persistence design on 2026-08-01.
