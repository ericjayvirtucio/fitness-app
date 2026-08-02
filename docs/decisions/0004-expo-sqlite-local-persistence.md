# ADR 0004: Expo SQLite local persistence

- Status: Accepted
- Date: 2026-08-01

## Context

The mobile application must eventually support complete offline logging. It now
needs durable local storage, controlled schema evolution, atomic writes, testable
boundaries, and safe failure handling, but no product record has been approved.
The solution must not couple domain or application behavior to a database driver
or prematurely define cloud reconciliation semantics.

## Decision

Use Expo's maintained `expo-sqlite` package directly in `@fitness/mobile`. Hide it
behind an app-local database adapter and construct it in the mobile composition
root. Do not create a workspace persistence package or adopt an ORM until a real
schema demonstrates an additional boundary or tooling need.

Track the schema with `PRAGMA user_version` and an ordered, immutable migration
list. Run every migration and its version update inside an exclusive transaction.
Version 1 establishes an empty baseline. Enable foreign keys and WAL during
initialization. Reject invalid, discontinuous, or newer schema versions rather
than guessing at recovery.

Define a generic application transaction contract. Concrete SQLite transaction
handling remains infrastructure-only and passes a scoped internal adapter, while
future application composition can expose capability repository contexts. Convert
driver failures to safe, stable persistence errors at the infrastructure boundary.

Gate route rendering on successful database initialization and provide a safe
retry state. Never delete or reset the database automatically after failure.

## Consequences

- The mobile app gains durable, offline-capable infrastructure with one
  Expo-compatible native dependency.
- Domain and UI code remain independent of SQLite and SQL.
- Explicit SQL migrations remain reviewable and require no generator or bundler
  customization.
- Native database behavior still requires simulator or device verification;
  deterministic Jest fakes validate orchestration and boundaries.
- `user_version` records the current version but not a migration audit history or
  checksums.
- Forward-only migrations make automatic downgrade unsafe; rollback binaries must
  understand the installed schema.
- SQLCipher remains deferred because it requires custom native builds and a
  reviewed key-management design.

## Alternatives considered

- **Drizzle ORM:** provides typed schema, generated migrations, and an Expo driver,
  but adds ORM, generator, Babel, Metro, and SQL-bundling configuration before a
  product schema exists.
- **WatermelonDB:** supplies reactive models and synchronization primitives but
  imposes a substantially broader model and native integration before sync rules
  are defined.
- **Key-value storage:** cannot provide the relational constraints, schema
  evolution, and transaction model expected for fitness records.
- **Shared persistence package:** has only one consumer and would create a
  speculative cross-runtime boundary.
