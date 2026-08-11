# ADR 0015: Erase local data by deleting rows in one verified transaction

**Status:** Accepted

## Context

[ADR 0013](0013-versioned-offline-data-export.md) let a user take their
information out of the application.
[ADR 0014](0014-empty-installation-data-restore.md) let them bring it back, but
only into an installation holding no user-owned records, and accepted plainly
that a user with existing records "must export first and clear application data
before restoring".

Clearing application data is an operating-system function. It is hidden inside
platform settings, it is described differently on iOS and Android, and it is not
something the product can explain, confirm, or verify. It is also the only way a
user can remove sensitive fitness and body information from a device, which sits
badly beside the user-ownership principle in `PRODUCT.md`.

Deleting information is also not the same problem as writing it. Restoring
writes into a database known to be empty; erasing has to remove records that
other capabilities own, in an order the schema constrains, and then prove that
nothing survived.

## Decision

Add a `data-lifecycle` capability that erases every user-owned record in **one
exclusive SQLite transaction, verified inside that transaction before it
commits**.

Each capability answers for its own tables through a narrow `StoredDataEraser`
port implemented in its own infrastructure folder, beside the `StoredDataProbe`
it already owns. A shared `deleteAllRows` helper holds the one bounded
statement. The coordinator owns no table and issues no SQL of its own; it owns
the order, the verification, and the workflow.

Rows are deleted children first, and `ON DELETE CASCADE` is deliberately not
relied on. `PRAGMA foreign_keys` is a per-connection setting that is a no-op
once a transaction has begun, and Expo's `withExclusiveTransactionAsync` opens
its own connection, so the setting applied during initialization cannot be
assumed to reach the write transaction. Explicit child-first deletion is correct
either way, and a test asserts that every child table is deleted by an explicit
statement rather than left to a cascade.

Verification runs inside the transaction: after every eraser, every stored-data
probe runs, and any probe still reporting records rolls the whole deletion back
and reports a failure. A partially erased installation is never committed and
never presented as success.

Deletion is protected by three deliberate acts — reaching a dedicated screen,
acknowledging in the application that it cannot be undone, and confirming in a
platform alert whose destructive option reads differently from the screen's own
control. A typed confirmation phrase is not required.

Exporting first is offered through the existing export screen and is never
mandatory, never automatic, and never described as having saved a file.

After the transaction commits, two best-effort steps run: the application-owned
export cache is cleared through the existing export cleanup, and the database is
checkpointed and vacuumed. Neither can turn a committed deletion into a reported
failure. A failed export cleanup is reported to the user as a warning attached
to a successful deletion, which is why that use case now propagates its failure
instead of swallowing it.

The product claims that it holds no information, that the database contains no
user records, that the write-ahead log is truncated, and that the file was
rebuilt. It does not claim that bytes are unrecoverable.

## Consequences

- The local data lifecycle is complete offline: export, restore into an empty
  installation, and deliberate erasure.
- ADR 0014's restriction stops requiring an operating-system detour. A user who
  wants to restore a different export can empty the installation inside the
  product, in a flow that explains itself and verifies its result.
- Capability boundaries survive: erasure grows the public surface by one narrow
  port, matching the one restore added, rather than by a central table list.
- The database connection stays open and valid, so screens holding use cases
  built from it keep working and the application is usable immediately.
- The application never needs a process restart, a composition reset, or a
  persistence-generation key, because every screen already reloads on focus and
  the completion step dismisses the stack.
- Erasure is bounded by page count rather than record count, so it stays cheap
  even on a long history.
- Deletion is genuinely irreversible in the product. That is the intent, and it
  is why the confirmation is three acts rather than one.
- The platform picker's temporary copy of a selected restore file lives in the
  application's temporary directory on iOS and cannot be reached or enumerated
  by the application. That limit is documented rather than papered over.

## Alternatives considered

- **One central persistence adapter listing every table.** Rejected. It is the
  shortest path to a working eraser and the fastest way to lose the boundaries
  [ADR 0005](0005-capability-application-slices.md),
  [ADR 0011](0011-cross-capability-derived-progress-analytics.md), ADR 0013, and
  ADR 0014 have maintained, and it makes every future table a change to shared
  infrastructure instead of to its owner.
- **Delete and recreate the SQLite database file.** Rejected. Composition caches
  the connection with no close path, and screens hold use cases built from it,
  so closing and reopening would leave live adapters pointing at a closed
  handle. It would also mean re-running migrations with a window in which a
  failure leaves the application with neither data nor schema — strictly worse
  than "nothing was deleted" — and it is not transactional. Local persistence
  architecture already warns against automatic database deletion as a recovery
  shortcut.
- **Rely on `ON DELETE CASCADE` for child rows.** Rejected on evidence: the
  transaction runs on a connection whose foreign-key enforcement the application
  does not control.
- **Verify after the transaction commits.** Rejected. A probe that finds
  surviving records after a commit can only report a problem it can no longer
  fix; inside the transaction it can undo it.
- **Require typing a confirmation phrase.** Rejected. It adds keyboard,
  localization, and cognitive cost, and it protects no better than a dedicated
  screen plus an acknowledgement plus a destructive platform alert.
- **Require an export before deleting.** Rejected. A user has the right to
  remove information without producing another copy of it, and the application
  cannot tell whether a share sheet actually saved anything.
- **Restore automatically after deleting.** Rejected. That is replacement
  restore, which ADR 0014 deliberately left to its own reviewed design. Deletion
  and restoration stay separate operations the user initiates separately.
- **Enable `PRAGMA secure_delete`.** Rejected. It is per-connection and would
  have to be set on a connection the application does not construct, it only
  zeroes pages freed after it is set, and it charges every ordinary transaction
  for a benefit that flash wear levelling and platform encryption already
  dominate. `VACUUM` addresses free pages once, where it matters.
- **Claim secure or forensic erasure.** Rejected. The application cannot verify
  it, so it does not say it.
- **Delete the platform picker's temporary copy of a selected file.** Rejected.
  On Android that URI belongs to another provider, so the behavior would be
  asymmetric and, at worst, would delete a file the application does not own.
- **Add deletion directly to the Profile screen.** Rejected. It would leave five
  stacked actions below a long form with the most destructive one furthest from
  the fold, worsening a reachability problem Sprint 19 already had to work
  around in its end-to-end flows.
