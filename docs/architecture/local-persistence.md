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
`planned_workout` and ordered `planned_exercise` rows. Workout-owned children are
removed only when their workout is deliberately removed; the schema declares the
cascade, and the repository also issues the child delete first so the rule holds
on a transaction connection. Catalog deletion is restricted and referenced
logging-mode changes are blocked. See
[Offline Workout Planner architecture](offline-workout-planner.md).

Version 9 adds independent workout sessions, exercise and plan snapshots, and
individual actual sets. A partial unique index limits active execution to one
session. No foreign key connects history to mutable Catalog or Planner rows; see
[Offline Workout Session architecture](offline-workout-sessions.md).

Version 10 adds focused indexes for completed-session local-date history and
source-exercise history. It adds no tables or summary values; Workout History
derives bounded projections from version-9 facts. See
[Offline Workout History architecture](offline-workout-history.md).

Version 12 adds `updated_at_epoch_ms`, `deleted_at_epoch_ms`, `revision`, and
`originating_device_id` to the ten tables a person owns as an independently
addressable record: `personal_profile`, `goal_configuration`,
`hydration_target`, `nutrition_consumption_entry`, `nutrition_catalog_item`,
`hydration_entry`, `exercise_catalog_item`, `body_weight_entry`,
`planned_workout`, and `workout_session`. Aggregate children —
`planned_exercise`, `workout_session_exercise`, `workout_set` — get none of
the four; they have no independent lifecycle and are always rewritten with
their parent. It adds `sync_outbox`, one upserted row per changed record not
yet sent anywhere, and the `device_identity` singleton, a random identifier
generated once at composition start rather than in migration SQL. Ten indexes
become partial indexes `WHERE deleted_at_epoch_ms IS NULL`, and
`planned_workout` is rebuilt once to move its weekday uniqueness into a
partial unique index, because a tombstoned row would otherwise occupy that
constraint forever. No synchronization exists yet; deletion becomes a
tombstone only where a future device must learn about it, and every other
delete path is unchanged. See
[Schema synchronization readiness](schema-synchronization-readiness.md).

## Transactions

The application contract `TransactionRunner<TContext>` does not know about
SQLite. Capability composition defines a context containing the exact repositories
needed by a use case. The SQLite implementation creates that context against
Expo's exclusive transaction-scoped connection. Personal profile is the first
concrete context and exposes its repository rather than a database connection.

Keep transaction callbacks short. Do not wait for network requests, user input,
or unrelated work while holding a transaction. A thrown error rolls the work back
and becomes a safe `transaction-failed` persistence error.

Expo runs an exclusive transaction on a connection it opens itself, and
`PRAGMA foreign_keys` is a per-connection setting that is a no-op once a
transaction has begun. The `foreign_keys = ON` applied during initialization
therefore does not reach work done inside `runExclusive`. Measured on an iOS 26.5
simulator with `expo-sqlite` 57.0.1, the main connection reports
`foreign_keys = 1` and the transaction connection reports `foreign_keys = 0`;
issuing `PRAGMA foreign_keys = ON` inside the transaction leaves it at `0`. Do
not rely on `ON DELETE CASCADE` or `ON DELETE RESTRICT` there: order the
statements so a referencing row is written after, and deleted before, what it
references. Referential rules that must hold are enforced by the capability that
owns them — the restore parser validates references before writing, the catalog
application checks Planner references before a hard delete, and the erasers and
repositories delete children explicitly.

## Erasing stored records

`StoredDataProbe` answers whether a capability holds anything;
`StoredDataEraser` removes it. Both are implemented once per capability in its
own infrastructure folder, and both share one bounded statement —
`hasStoredRows` and `deleteAllRows`. A new user-owned table is added to both, by
its owner, in the same change that creates it.

Deletion runs inside one exclusive transaction that verifies emptiness with the
probes before committing, so a partial deletion is never committed. Checkpoint
and `VACUUM` cannot run inside a transaction and are best-effort steps
afterwards, through `StorageCompactor`. See
[offline local data erasure architecture](offline-local-data-erasure.md).

Replacing local data composes both directions in one transaction: the erasers
run, the probes prove the result is empty, the validated dataset is written
through the same repositories, and capability presence is verified before the
commit. The previous dataset survives intact or the whole replacement lands. See
[safe replacement restore architecture](safe-replacement-restore.md).

## Errors and recovery

`PersistenceError` exposes stable codes and generic messages. The original error
is retained only as `cause` for controlled diagnostics. Do not display or log raw
SQL, bound values, paths, identifiers, or fitness records.

If startup fails, the app shows a retry action and does not render product routes.
Repeated failure should be diagnosed; never add automatic database deletion as a
recovery shortcut. A database newer than the running app requires installing a
compatible binary. Deleting local data is always a deliberate user action, never
a recovery path the application takes on its own, and it removes rows rather
than the database file.

## Testing

Jest tests use narrow deterministic fakes to verify orchestration, migration,
transaction, error, and startup behavior. Those fakes do not execute a SQLite
engine and never claim to.

Where a guarantee belongs to the engine rather than to the orchestration, a test
may run against a real one. `NodeSqliteDatabase`, under
`infrastructure/persistence/testing`, implements this application's own
`DatabaseConnection` over Node's built-in SQLite, applies the real migration
list, and runs `BEGIN EXCLUSIVE`, `COMMIT`, and `ROLLBACK` with foreign-key
enforcement disabled around the transaction so it matches the measured behavior
of the connection Expo opens. It exists so replacement's rollback guarantee is
asserted rather than assumed. It is not the production adapter, is never
imported by application code, and does not execute Expo's native module;
`composition/persistence.ts` remains the only place a production database is
opened.

Before merge, verify initialization, migration, restart, and cold start on an
iOS simulator or device and on Android when available.

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
