# Local persistence architecture

## Purpose and boundaries

The Expo mobile application owns local SQLite persistence because it owns the
offline experience and device integration. `@fitness/domain` contains no storage
representation, and the API does not import mobile infrastructure.

Metro treats WASM as an asset so the repository's existing all-platform export
can bundle Expo SQLite. Web SQLite remains alpha and is not a supported persistence
target for this sprint; a deployment would additionally require cross-origin
isolation headers and platform verification.

Dependency direction is inward:

```text
mobile routes and UI
        ↓
future application use cases
        ↓
capability-owned repository contracts
        ↓
mobile persistence adapters
        ↓
expo-sqlite
```

Only `src/composition/persistence.ts` opens the production database. UI and future
application modules must not import `expo-sqlite`, raw SQL, the database filename,
or internal connection contracts. Future repository interfaces belong beside the
application capability that needs them. Concrete repositories belong in mobile
infrastructure and map stored values to validated domain values. Do not add a
generic CRUD repository.

## Initialization

The root persistence gate blocks route rendering until initialization succeeds:

1. Open `fitness-app.db` asynchronously.
2. Enable `PRAGMA foreign_keys = ON` for the connection.
3. Enable WAL journal mode.
4. Read `PRAGMA user_version`.
5. Validate the migration list and installed version.
6. Apply each pending migration in its own exclusive transaction.
7. Render the application only after all migrations commit.

Initialization is idempotent. Concurrent callers share the same in-flight or
completed promise. A failure clears the cached attempt so the user can retry. It
does not delete, replace, or downgrade the database.

## Adding a migration

Edit `apps/mobile/src/infrastructure/persistence/migrations.ts` and append one
migration whose version is exactly one greater than the previous entry. Never
edit, delete, reorder, or reuse an applied version.

Migration SQL is trusted application code, not user input. Feature repositories
must use bound parameters for record values. Keep migrations deterministic and
avoid network, clock, randomness, UI, or domain calculations. A table-owning
feature must document its columns, constraints, indexes, identifiers, deletion
behavior, and storage mappings in its approved specification.

Each migration's `up` operation and `user_version` update are atomic. There are no
down migrations. Test upgrading from the immediately previous schema and from a
fresh version-zero database.

Version 2 adds the single `personal_profile` row. Its mapping and privacy
constraints are documented in [personal profile architecture](personal-profile.md).
Version 3 adds the singleton `goal_configuration` row containing only goal type
and whole-kilocalorie adjustment. BMI, age, energy estimates, and targets are
derived and never stored. See [Goals and energy architecture](goals-and-energy.md).

Version 4 adds UUID-identified `nutrition_consumption_entry` rows and a captured
local-day query index. Source Nutrition facts and consumed physical quantity are
stored in canonical units; scaled facts and daily totals remain derived. See
[Offline nutrition logging architecture](offline-nutrition-logging.md).

Version 5 adds reusable `nutrition_catalog_item` rows with canonical facts,
normalized names, favorites, and usage metadata. It has no foreign key to diary
history. Focused indexes support exact names, favorites, and recents; see
[Reusable nutrition catalog architecture](reusable-nutrition-catalog.md).

Version 6 adds UUID-identified `hydration_entry` rows and singleton
`hydration_target`. Entries store canonical milliliters and captured local-day
metadata; totals and progress remain derived. No relationship connects Hydration
to Nutrition tables. See
[Offline Hydration architecture](offline-hydration-tracking.md).

Version 7 adds device-local `exercise_catalog_item` definitions with controlled
logging modes, favorites, and search indexes. Version 8 adds recurring
`planned_workout` and ordered `planned_exercise` rows. Workout-owned children
cascade only when their workout is deliberately removed; catalog deletion is
restricted and referenced logging-mode changes are blocked. See
[Offline Workout Planner architecture](offline-workout-planner.md).

Version 9 adds independent workout sessions, exercise and plan snapshots, and
individual actual sets. A partial unique index limits active execution to one
session. No foreign key connects history to mutable Catalog or Planner rows; see
[Offline Workout Session architecture](offline-workout-sessions.md).

## Transactions

The application contract `TransactionRunner<TContext>` does not know about
SQLite. Capability composition defines a context containing the exact repositories
needed by a use case. The SQLite implementation creates that context against
Expo's exclusive transaction-scoped connection. Personal profile is the first
concrete context and exposes its repository rather than a database connection.

Keep transaction callbacks short. Do not wait for network requests, user input,
or unrelated work while holding a transaction. A thrown error rolls the work back
and becomes a safe `transaction-failed` persistence error.

## Errors and recovery

`PersistenceError` exposes stable codes and generic messages. The original error
is retained only as `cause` for controlled diagnostics. Do not display or log raw
SQL, bound values, paths, identifiers, or fitness records.

If startup fails, the app shows a retry action and does not render product routes.
Repeated failure should be diagnosed; never add automatic database deletion as a
recovery shortcut. A database newer than the running app requires installing a
compatible binary. Production backup, export, and restore remain future work.

## Testing

Jest tests use narrow deterministic fakes to verify orchestration, migration,
transaction, error, and startup behavior. They do not claim to execute the native
SQLite engine. Before merge, verify initialization, migration, restart, and cold
start on an iOS simulator or device and on Android when available.

## Troubleshooting

### Local storage remains unavailable

Retry once, then inspect development logs for the internal cause without adding
sensitive values to diagnostics. Confirm the app binary and installed database
schema are compatible. A failed migration must be corrected with a new compatible
build, not by editing an already released migration.

### Database is locked

Confirm transaction callbacks are short and that all transaction work uses the
scoped context. Avoid concurrent writes during initialization. Do not add blind
retries without defining limits and idempotency.

### Development schema differs from the migration list

Use a fresh simulator installation only when disposable development data is
explicitly acceptable. Production recovery must never depend on clearing user
data. Reproduce upgrades from an older database before release.
