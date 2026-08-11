# ADR 0013: Versioned offline data export

**Status:** Accepted

## Context

The application stores profile, goal, nutrition, hydration, exercise, planner,
workout session, and body-measurement records in one app-local SQLite database
and provides no way to get any of it out. `PRODUCT.md` already promises user
ownership and portability, so the promise is currently unmet, and every added
logging capability increases lock-in and the cost of device loss.

An export creates three durable risks. It can accidentally publish the internal
database schema as a public contract. It can let one exporter reach across every
capability's tables for convenience, dissolving the boundaries that
[ADR 0005](0005-capability-application-slices.md) and
[ADR 0011](0011-cross-capability-derived-progress-analytics.md) established. And
it can present derived or current values as history, which
[ADR 0008](0008-historical-workout-session-snapshots.md) and
[ADR 0012](0012-body-measurement-history-and-current-weight-authority.md)
deliberately prevented inside the application.

## Decision

Add a `data-export` capability that produces one UTF-8 JSON file describing all
locally stored information, generated entirely offline and handed to the
platform share and save controls by an explicit user action.

The file carries a public contract identified by the constant `format`
(`fitness-app-data-export`) and the integer `formatVersion`, starting at 1.
`formatVersion` is deliberately independent of the SQLite migration version. Any
contract change increments it. `application.version` is metadata only. No
migration framework is built for a version that does not exist.

The contract uses product language. No table name, column name, or internal
search key appears in the file. Canonical units are exported unchanged with the
unit in every numeric field name, historical records keep their stored occurrence
triple, unknown optional values stay `null`, and every array has a declared total
order broken by identifier.

Derived values are excluded. BMI, energy estimates, the calorie target, and
consumed nutrition amounts are pure functions of exported inputs, so exporting
them would duplicate state that can drift and would invite reading a current
calculation as history.

The exporter issues no SQL. Each capability exposes a narrow export reader in its
own application and infrastructure folders, following the Progress reader
precedent. Readers return existing domain records; the single mapping to the
public contract lives inside `data-export`, so a version change is one reviewable
file rather than eight.

All reads run inside one exclusive SQLite transaction composed through the
existing `SqliteTransactionRunner`, so the export cannot capture a mutually
inconsistent set of related records. Reads are keyset-paged; the export is
all-or-nothing.

Generation and sharing are two distinct user actions separated by a persistent
"Export ready" confirmation.

## Consequences

- The portability promise in `PRODUCT.md` becomes true, and the repository gains
  one authoritative public statement of its canonical units and time semantics.
- The internal schema stays private and can keep migrating without breaking any
  file a user already saved.
- Capability boundaries survive: adding a capability adds a reader and a section,
  not an exporter rewrite.
- Exported records are truthful. A completed workout still describes what was
  performed after its catalog definition is renamed or deleted, planner intent is
  never presented as history, and profile weight is never presented as a
  check-in.
- Exported identifiers make a future import or restore feasible without
  inventing reconciliation keys, at the cost of opaque UUIDs in a public file.
- Writes are blocked for the duration of the export transaction. Acceptable on a
  single-user foreground action; revisit if measured duration becomes noticeable.
- Whole-file buffering caps practical export size at roughly 25 MB. The escalation
  path is a streaming file adapter behind the unchanged writer interface.
- The application takes one new first-party native dependency, `expo-sharing`,
  and requests no storage permission.
- The exported file is unencrypted once it leaves the sandbox. This is stated in
  the user interface and the documentation rather than mitigated silently.

## Alternatives considered

- **Copy the SQLite database.** Rejected. It publishes internal table and column
  names and the migration version as a public contract, and it exposes indexing
  and normalization details that exist only for query performance.
- **CSV files per capability.** Rejected. CSV cannot express the
  session-exercise-set nesting without invented join keys, cannot distinguish an
  unknown nutrient from a known zero, and has nowhere to carry a format version.
- **A ZIP archive of per-capability JSON files.** Rejected for version 1. It
  needs a compression dependency to solve a size problem the measured data does
  not have. It remains the natural version 2 if exports grow.
- **One exporter querying every table directly.** Rejected. It is the shortest
  path to writing the file and the fastest way to lose the capability boundaries
  the repository has maintained for eleven sprints.
- **Export-specific DTOs owned by each capability.** Rejected. It duplicates
  every field twice and scatters the public contract across eight capabilities,
  making a version bump a cross-capability change.
- **Reusing the format version as the migration version.** Rejected. They answer
  different questions and change for different reasons; a reader of a saved file
  must not care how many times the local schema has migrated.
- **Generating and sharing in one action.** Rejected. It leaves the confirmation
  transient, gives assistive technology nothing durable to announce, hides what
  is about to leave the application, and provides no stable assertion point
  before a platform-owned sheet.
