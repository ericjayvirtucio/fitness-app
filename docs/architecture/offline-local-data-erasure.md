# Offline local data erasure architecture

## Flow and boundaries

```text
Profile
  → Data controls (/data-controls)
      → Export my data  (/data-export, unchanged)
      → Restore my data (/data-restore, unchanged)
      → Delete all local data (/delete-local-data)
          → DeleteLocalDataScreen
          → GetLocalDataPresenceUseCase   (advisory, on entry)
          → acknowledgement + destructive platform alert
          → EraseLocalDataUseCase
              → SqliteTransactionRunner<LocalDataErasureTransactionContext>
                  → capability stored-data erasers  (deletion)
                  → capability stored-data probes   (verification)
              → ClearDataExportsUseCase   (after commit, best effort)
              → SqliteStorageCompactor    (after commit, best effort)
          → dismiss the stack, replace with Profile
```

The `data-lifecycle` capability coordinates only. It owns no table and issues no
SQL. It owns the Data controls hub, the deletion screen, the order in which
capabilities are erased, verification, and the workflow.

## What erasure returns the installation to

Erasure reaches an installation that holds nothing, verified by the same eight
probes restore uses. Nothing re-creates a record afterwards. The Exercise
Library's starter set is the case worth stating: it is an offer in the
application's own code, not data in the database, so erasure removes every
definition it once wrote and the offer is simply available again. Nothing is
written until the person presses the control. See the
[starter exercise library architecture](starter-exercise-library.md).

## Capability ownership

Each capability implements one narrow port in its own infrastructure folder,
beside the `StoredDataProbe` it already owns:

```ts
interface StoredDataEraser {
  eraseStoredRecords(): Promise<void>;
}
```

| Capability       | Eraser                      | Tables, in order                                             |
| ---------------- | --------------------------- | ------------------------------------------------------------ |
| Workout Session  | `WorkoutSessionDataEraser`  | `workout_set`, `workout_session_exercise`, `workout_session` |
| Workout Planner  | `WorkoutPlannerDataEraser`  | `planned_exercise`, `planned_workout`                        |
| Exercise Catalog | `ExerciseCatalogDataEraser` | `exercise_catalog_item`                                      |
| Nutrition        | `NutritionDataEraser`       | `nutrition_consumption_entry`, `nutrition_catalog_item`      |
| Hydration        | `HydrationDataEraser`       | `hydration_entry`, `hydration_target`                        |
| Body Measurement | `BodyWeightDataEraser`      | `body_weight_entry`                                          |
| Goals & Energy   | `GoalDataEraser`            | `goal_configuration`                                         |
| Personal Profile | `PersonalProfileDataEraser` | `personal_profile`                                           |

The one bounded statement lives once, in `deleteAllRows`, next to the
`hasStoredRows` helper the probes share. Table names are module constants owned
by the capability; nothing from a file or a screen reaches a statement.

A new user-owned table is erased by extending its own capability's eraser, in
the same folder where its probe already has to learn about it.

## Deletion order and foreign keys

Composition erases capabilities in this order, so a referencing row is always
gone before what it references:

```text
Workout Session → Workout Planner → Exercise Catalog → Nutrition
  → Hydration → Body Measurement → Goals & Energy → Personal Profile
```

`ON DELETE CASCADE` is not relied on, because it does not run here.
`PRAGMA foreign_keys` is per-connection and a no-op once a transaction has
begun, and `withExclusiveTransactionAsync` opens the transaction on a connection
it creates itself, so the `foreign_keys = ON` applied during initialization
never reaches the write transaction. Measured on an iOS 26.5 simulator with
`expo-sqlite` 57.0.1, the transaction connection reports `foreign_keys = 0` and
issuing the pragma inside the transaction leaves it there; the measurement and
its consequences for ordinary repository writes are recorded in
[local persistence architecture](local-persistence.md).

Every eraser therefore lists its child tables first, and a test asserts that
each child table is deleted by an explicit statement rather than left to a
cascade. The restricted reference from `planned_exercise` to
`exercise_catalog_item` is handled by the same ordering rather than treated as a
safety net, since `ON DELETE RESTRICT` is unenforced there for the same reason.

## Transaction and verification

One exclusive transaction runs every eraser and then every probe. A probe that
still reports records raises inside the callback, which rolls the deletion back.

Verification is deliberately inside the transaction. A failure there can still
be undone; after a commit it could only report a problem it can no longer fix.
The verification failure is remembered in a flag before it is raised, because
the transaction runner flattens everything it catches into one generic
persistence error and the capability needs to tell the two apart.

The exclusive lock prevents a concurrent write from landing between deletion and
verification, so no separate concurrency guard is needed in the application.

## After the commit

Two steps run on the main connection, in order, and neither can turn a committed
deletion into a reported failure:

1. `ClearDataExportsUseCase` removes the export the application still owns in
   `<cache>/data-export/`. A failure is reported to the user as a warning on a
   successful deletion, and the export screen removes the file on its next
   visit anyway. That use case now propagates its failure rather than swallowing
   it; the export screen still ignores it, because creating an export prepares
   the directory again.
2. `SqliteStorageCompactor` runs `PRAGMA wal_checkpoint(TRUNCATE)` and then
   `VACUUM`. Neither may run inside a transaction. On a database that was just
   emptied, `VACUUM` copies almost nothing. A failure changes neither the result
   nor the message, because no user record is left behind either way.

Nothing else is touched: no other capability's cache, no document directory, no
file the user selected, and nothing outside the sandbox.

## What is erased and what is kept

Erased: every row of `personal_profile`, `goal_configuration`,
`nutrition_consumption_entry`, `nutrition_catalog_item`, `hydration_entry`,
`hydration_target`, `exercise_catalog_item`, `planned_workout`,
`planned_exercise`, `workout_session`, `workout_session_exercise`,
`workout_set`, and `body_weight_entry`, plus the application-owned export cache.

Kept: the database file, its schema, indexes, the
`prevent_referenced_exercise_logging_mode_change` trigger, and
`PRAGMA user_version = 11`; the installation; export files saved elsewhere; the
file a user selected for a restore; everything outside the sandbox. Appearance
follows the operating system and is not application storage, so there is no
display preference to erase or preserve.

No record is fabricated to replace what was deleted, and no default is recreated
that a fresh installation does not create.

## Physical remanence

After a successful erasure the application holds no information about the user,
the database contains no user records, the write-ahead log is truncated, and the
file has been rebuilt so free pages holding deleted bytes are released to the
filesystem.

The application does not claim that bytes are unrecoverable. Flash wear
levelling, filesystem snapshots, and operating-system backups are outside its
control, and protection against off-device recovery comes from iOS Data
Protection and Android file-based encryption. `PRAGMA secure_delete` is not
enabled: it is per-connection, would have to be set on a connection the
application does not construct, only zeroes pages freed after it is set, and
charges every ordinary transaction for a benefit `VACUUM` already covers once,
where it matters.

Product language is "Delete all local data" and "Everything this app has stored
on this device will be deleted". Never "permanently unrecoverable", "secure
wipe", or any claim about an account or a cloud copy, of which the product has
neither.

## Confirmation

Three deliberate acts:

1. reaching `/delete-local-data`, which is one step inside Data controls;
2. acknowledging in the application that the action cannot be undone, which is
   what enables the destructive control;
3. confirming in a platform alert whose destructive option reads "Delete
   everything", deliberately different from the screen's own "Delete all local
   data" so no selector or reader has to disambiguate by position.

Erasure never happens through navigation, a screen mount, startup, a failed
export or restore, background cleanup, a migration, or retry behavior. When the
installation stores nothing, the control stays named and visible but disabled,
and says why.

## Application state afterwards

No process restart, composition reset, shell remount, persistence-generation
key, or hidden global state. The connection stays open and valid, which is the
practical reason rows are deleted rather than the database file: screens hold
use cases built from that connection.

Completion dismisses every route above the tabs and replaces the Profile tab, so
no back gesture can reach a screen whose records no longer exist, including an
active workout. Every product screen reloads on focus, so mounted tabs re-read
and find nothing: Profile shows its first-run empty state and Progress shows no
history. Stale results are discarded by the same mounted and request-sequence
guards the restore screen uses.

## Failure, interruption, and errors

| Situation                                       | Behavior                                              |
| ----------------------------------------------- | ----------------------------------------------------- |
| Initial presence check fails                    | Safe failure, nothing deleted                         |
| Any capability eraser fails                     | Whole transaction rolled back                         |
| Verification finds remaining records            | Whole transaction rolled back, reported as a failure  |
| Export cleanup fails after commit               | Success with a cleanup warning                        |
| Checkpoint or `VACUUM` fails after commit       | Success; best effort, not user-facing                 |
| Nothing stored                                  | Destructive control disabled, with a stated reason    |
| Cancelled at the alert                          | Neutral outcome, nothing changed                      |
| Application closes during the transaction       | SQLite rolls back; data intact; the user may retry    |
| Application closes after commit, before cleanup | Data gone; the export screen removes the stale file   |
| Repeated request                                | Control disabled while busy; erasing empty is a no-op |
| Screen unmounted or superseded request          | Result discarded by request identity                  |

`LocalDataErasureError` carries `storage-unavailable`, `erase-failed`, or
`verification-failed`, each with a fixed safe message. Every one of them means
nothing was deleted. A cleanup failure is a warning on a successful result, not
an error code, because reporting a failed deletion then would be untrue.

No SQL, table name, stack trace, internal path, identifier, personal detail, or
fitness value reaches a user-facing message. The capability performs no logging.

No startup repair is added: an interrupted erasure leaves nothing half-done.

## Relationship with export and restore

Export is unchanged and deletes nothing. Restore is unchanged and still requires
an installation holding no records — after a successful erasure it becomes
eligible, and the user reaches it deliberately from Data controls. Nothing opens
the picker, retains a source path, or restores anything automatically, and
deletion and restoration never share a transaction here.

Replacement restore, added later and described in
[safe replacement restore architecture](safe-replacement-restore.md), reuses
this capability's erasers and probes but is a separate operation the user
chooses separately. It is the one place where deletion and restoration do share
a transaction, deliberately, because committing an empty database between them
is exactly the failure that design exists to prevent. Deleting all local data
still restores nothing, and it clears the app-owned export cache — which
replacement deliberately does not, because there the copy is the user's way
back.

## Persistence and migration

No migration is added and `user_version` stays 11. No table, column, index,
trigger, or view is added or removed, and no dependency changed.

## Known limitations

- The document picker on iOS is created with `asCopy: true`, so the operating
  system places a copy of a selected restore file in the application's temporary
  directory. The application never records that location and cannot enumerate
  it, so erasure does not reach it; the operating system reclaims that
  directory. On Android the picked URI belongs to another provider entirely.
- A complete successful erasure changes the database only. Anything the user
  exported and saved elsewhere is outside the application's reach by design.
- Erasure cannot be undone in the application. That is the intent, and it is why
  exporting is offered first.
