# Specification 0028: Atomic active workout lifecycle

> Testing-policy note: automated simulator, sprint-suite, and regression-suite
> requirements in this historical specification were superseded by
> [ADR 0033](../docs/decisions/0033-risk-based-manual-device-testing.md).
> Use command-line Jest/Vitest checks plus risk-based manual device testing.

**Status:** Implemented

**Capability:** `workout-session`

## Objective and scope

Make discarding an active Workout atomic, so a person who abandons a workout
either still has it in full or does not have it at all, and can never be left
with a workout whose recorded sets were deleted while the workout itself
survived.

In scope: the transaction boundary around `DiscardWorkoutSessionUseCase`, the
lifecycle guard on the statement that deletes the session, and the documentation
and tests that describe both.

Out of scope: every user-facing surface. No wording, control, confirmation,
announcement, or navigation changes. No migration, column, status value, index,
or dependency. No change to `discard`'s boolean contract, to `deleteCompleted`,
or to any write path the audit found correct.

## The problem

`WorkoutSessionSqliteRepository.discard` issued four statements under four
separate implicit transactions:

| #   | Statement                                                           |
| --- | ------------------------------------------------------------------- |
| 1   | `SELECT id FROM workout_session WHERE id = ? AND status = 'active'` |
| 2   | `DELETE FROM workout_set WHERE workout_session_exercise_id IN (…)`  |
| 3   | `DELETE FROM workout_session_exercise WHERE workout_session_id = ?` |
| 4   | `DELETE FROM workout_session WHERE id = ?`                          |

`DiscardWorkoutSessionUseCase` was the one active-session use case constructed
with a bare repository rather than the `TransactionRunner` its three siblings
receive, so nothing held those statements together.

Two states were therefore durable outcomes of an interrupted discard:

- after statement 2: the active workout and its exercises survive with **every
  recorded set gone**;
- after statement 3: the active workout survives as an **empty** workout.

Neither is corrupt. Both are valid aggregates that `WorkoutSession.create`
accepts, because the rule requiring performed work applies only to a completed
workout. Recovery on the next launch therefore succeeded and showed a coherent
workout that had silently lost the work recorded in it, with no error, no
message, and no way for the application to tell that state from a workout
nothing had been recorded in. The surviving parent also still held the
`workout_session_single_active` partial unique index, so starting a new workout
resumed the hollowed one.

Statement 4 additionally carried no lifecycle predicate. The `status = 'active'`
guard lived only in statement 1, three statements and three transactions away
from the write it was guarding, so the method was already capable of deleting a
workout that had become completed after the check — not only if somebody widened
it later.

Orphaned rows were never reachable: the parent is deleted last.

## Realistic exposure

Narrow, and stated as such. A local SQLite delete after WAL initialization
rarely fails. The realistic triggers are full or failing device storage, an
`expo-sqlite` bridge error, and process death in the window between two awaits.
On a healthy device this is close to never.

It is not zero. The window is genuinely reachable, force-quitting during a
discard is something people do, and what is lost is exactly the work the person
cared about, with no signal. The completed-workout hole in statement 4 is
narrower still — it needs the Finish confirmation to land inside the discard's
await window — and would not be called reachable in practice.

The argument for fixing it is not severity. It is that the state is unbounded
and undetectable while the fix is one wiring change against a mechanism the same
composition file already constructs three times.

## Atomicity audit

Every write path in `workout-session`, and every write path the audit reached
elsewhere. Paths that needed no change are listed, because an audit that records
only the defect it went looking for is not an audit.

### `workout-session`

| Path                    | Statements                          | Exclusive transaction   | Interrupted state                          | Changed |
| ----------------------- | ----------------------------------- | ----------------------- | ------------------------------------------ | ------- |
| `discard`               | 1 read, 3 deletes                   | **No, now yes**         | workout without its sets                   | **Yes** |
| `insert`                | parent, then children               | Yes (`start`)           | —                                          | No      |
| `replace`               | update, 2 deletes, N inserts        | Yes (`mutations`)       | —                                          | No      |
| `complete`              | update, verifying read              | Yes (`finish`)          | —                                          | No      |
| `correctCompleted`      | read, 2 deletes, N inserts          | Yes (`workout-history`) | —                                          | No      |
| `deleteCompleted`       | 2 reads, 3 deletes, 3 verifications | Yes (`workout-history`) | —                                          | No      |
| `getActive` / `getById` | 3 reads, no writes                  | No                      | torn read only against a non-atomic writer | No      |

### Other capabilities

| Path                                                                                                                                                                        | Exclusive transaction | Verdict                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| Planner `replace`, `deleteByWeekday`                                                                                                                                        | Yes                   | correct                                                                          |
| Starter exercise import                                                                                                                                                     | Yes                   | correct                                                                          |
| Local erasure, restore, replacement                                                                                                                                         | Yes                   | correct                                                                          |
| Export readers                                                                                                                                                              | Yes, read-only        | correct                                                                          |
| Catalog create and favorite; nutrition catalog update, delete, favorite, usage; consumption update; hydration update, delete, target; body-weight update, delete; goal save | No                    | one write statement each — a lost update is possible, a partial aggregate is not |

`discard` was the only multi-write-statement path in the repository outside a
transaction. The remaining bare paths are check-then-act with exactly one write
and are deliberately left alone; see the exclusions below.

## Foreign keys, with evidence

`PRAGMA foreign_keys` is per-connection and a no-op once a transaction has begun.

- On the main connection, `initializeDatabase` sets `PRAGMA foreign_keys = ON`.
  Discard ran there before this change, so enforcement was on — and cleaned
  nothing, because children are deleted before the parent and no constraint was
  ever violated by the interrupted states.
- Inside `runExclusive`, Expo opens its own connection with enforcement off.
  `NodeSqliteDatabase` reproduces this deliberately so a test cannot pass on a
  constraint production does not get.

The fix moves discard from the first regime to the second. The explicit
child-first order already present in `deleteChildren` is what makes that safe;
the declared `ON DELETE CASCADE` is inert on every session-delete path and is not
relied on by any of them.

## Architecture

```text
WorkoutSessionScreen (existing discard control, unchanged)
  → DiscardWorkoutSessionUseCase
  → WorkoutSessionTransactionContext        (one exclusive transaction)
  → WorkoutSessionRepository.discard
  → unchanged screen behavior
```

`DiscardWorkoutSessionUseCase` takes a
`TransactionRunner<WorkoutSessionTransactionContext>` and runs
`sessions.discard(id)` inside it. The composition root builds a second
`SqliteTransactionRunner` for it.

**No new context type was created.** `WorkoutSessionTransactionContext` was
already declared beside the repository contract, with exactly the shape a discard
needs and no consumer. Adding a second identical type in a new file would have
left the repository with two names for one thing, one of them still dead. The
existing declaration is used and now has its caller.

The context carries the session repository and nothing else. Reusing the
`WorkoutSessionContext` that `start`, `mutations`, and `finish` share would hand
a discard transaction a Planner and a Catalog repository it must never write
through, for no saving. `finish` and `mutations` keep that wider context because
they genuinely read from both.

## Transaction and rollback

```text
DiscardWorkoutSessionUseCase.execute(sessionId)
  DomainId.create              invalid → false, no transaction opened
  runner.run:
    BEGIN EXCLUSIVE            (foreign keys off on this connection)
      SELECT id … AND status = 'active'   → none → false, nothing written
      DELETE workout_set …
      DELETE workout_session_exercise …
      DELETE workout_session … AND status = 'active'
    COMMIT
```

Any throw inside the callback reaches the engine's rollback and is rethrown by
`SqliteTransactionRunner` as a persistence error. The two hollow states stop
being durable outcomes: after a failed discard the database holds exactly what it
held before, including set order and every recorded result.

The lifecycle predicate is repeated on the parent delete rather than trusted from
the lookup, so the guard holds at the statement that destroys the row. Inside one
exclusive transaction the two checks cannot disagree; the repetition makes the
statement correct on its own terms to the next reader, and costs one bound
parameter.

## Stale state and repeated submission

| Situation                    | Outcome                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| Session already gone         | `false`, nothing written                                      |
| Session already completed    | `false`, nothing written                                      |
| Same discard submitted twice | Second call reports `false`; idempotent                       |
| Screen unmounts mid-write    | Transaction commits or rolls back independently of the screen |
| Invalid identifier           | `false` before any transaction opens                          |
| Storage unavailable          | Rolled back, persistence error raised                         |

No lifecycle token is needed. `deleteCompleted` compares start and completion
instants because a completed workout can be replaced under a stale screen by a
restore. An active session has no completion instant, at most one exists at a
time by partial unique index, and the discard screen is the only holder of a
stale identifier. The `status = 'active'` predicate inside the transaction is the
whole guard.

## Errors

`discard` keeps its boolean contract. Both refusals mean the same thing to the
person — there is no active workout — and the screen already closes to Workout in
both cases, which is the truth. A failure keeps the existing fixed sentence,
"Workout could not be discarded." No message carries SQL, a table name, an
identifier, a value, or a path.

Giving refusals distinct sentences was considered and rejected: it would announce
a distinction with no consequence for the person, and would cost an outcome type,
a screen branch, and coverage for a state nobody can reach deliberately.

## User-facing behavior

**Nothing a person sees changes.** No wording, control, confirmation,
announcement, layout, or navigation is touched. `WorkoutSessionScreen` is not
modified. The change is invisible on a device except in failure cases that cannot
be triggered on purpose, which is stated plainly rather than dressed up.

## Derived behavior and data lifecycle

- Recovery on relaunch is unchanged, except that the hollow states stop being
  reachable.
- Completed history, Personal Records, Progress, per-exercise history, and the
  performed-exercise list are untouched; all derive from completed rows at read
  time.
- Export never reads active sessions — its reader filters `status = 'completed'` —
  so exported bytes are identical in every state before and after this change.
- The presence probe reads `workout_session`, whose parent row survives every
  reachable interrupted state, so restore's empty-installation precondition was
  never misled.
- Erasure and replacement delete whole tables inside their own transactions and
  cannot tell the difference.
- The Exercise Library, the starter import, and the Planner are unaffected.

## Accessibility

No change, stated rather than assumed. No control, label, role, focus order,
announcement, contrast value, or touch target is touched. The discard path
remains in manual QA under VoiceOver, TalkBack, Dynamic Type, and keyboard
navigation as regression coverage.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, or dependency. All SQL stays
parameter-bound; the one parameter added is the literal `'active'`. Nothing
sensitive is logged. One short exclusive transaction replaces four implicit ones,
so the path performs marginally fewer commits; it is bounded by the aggregate's
maximum exercises and sets, and adds no index, worker, or persisted summary.

## Migration and dependencies

None. The schema stays at `user_version` 11 with eleven migrations. Export format
version 1, the restore parser and its precondition, erasure, and replacement are
unchanged. No dependency was added.

## Decision record

No new ADR. [ADR 0019](../docs/decisions/0019-deliberate-completed-workout-deletion.md)
recorded this debt and stated that making active discard atomic was a separate
change; making it discharges that record rather than deciding something new.
Ownership, the discard/`deleteCompleted` split, and the lifecycle policy are all
unchanged. ADR 0019's consequence now reads as settled and points here.

## Verification and completion

Application coverage:

- an active session is discarded inside exactly one transaction;
- a missing session reports missing without writing;
- a completed workout is refused and stays stored;
- an invalid identifier is refused with no transaction opened;
- a write failure propagates as the established persistence error.

Real SQLite coverage, on `NodeSqliteDatabase` with the repository's own
migrations, injecting failures through a test-owned `DatabaseConnection`
decorator:

- discarding an active session holding several exercises and sets removes every
  row it owned and nothing else;
- a forced failure on the parent delete, on the exercise delete, and on the set
  delete each leave the whole database identical to a snapshot of every row of
  every table taken beforehand, and the recovered session identical to the
  original including set order and recorded results;
- the completed workout in the same database is untouched in every case;
- a completed workout cannot be reached through this path;
- `user_version` is unchanged.

The rollback assertions compare stored rows. None of them asserts that the code
asked for a rollback.

No Maestro scenario was added. `regression/08-workout-session.yaml` and
`flows/workout/empty-session-lifecycle.yaml` already prove every observable
behavior this change touches, and no device harness can inject a storage failure
between two deletes without a production failure switch or a hidden route, both
forbidden. A scenario here would assert behavior identical before and after the
change. `scripts/qa.sh` and `scripts/qa.spec.sh` therefore gain no sprint entry;
the manual checklist is run by hand.

## Explicit exclusions

- new Personal Record categories, charts, Progress redesign, adherence, streaks;
- Exercise Library filters, tags, or categories;
- starter content changes, onboarding, localization;
- export format changes, cloud synchronization, authentication, AI,
  notifications;
- merging or widening `discard`, or letting it reach completed history;
- a migration, column, status value, tombstone, undo, or audit record;
- an error-model change or any new user-facing sentence;
- refactoring the single-write check-then-act paths the audit found: their blast
  radius is a lost update on a row the person is looking at, they cannot leave an
  aggregate half-deleted, and there is no concurrency in the product that makes
  them reachable today.
