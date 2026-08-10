# Specification 0017: Body measurement history

**Status:** Approved for implementation on 2026-08-10.

## Objective and scope

Introduce an offline body-weight check-in history so the product can describe
what a person recorded over time. Personal Profile stores one mutable current
weight and therefore cannot answer when a change occurred. This specification
adds explicit, timestamped historical records and integrates them into Progress
where the data is now truthful.

Body weight is the only measurement type in scope. Waist circumference,
body-fat percentage, and other body measurements are deferred.

## Historical authority

Two distinct questions have two distinct owners:

| Question                             | Authority                       |
| ------------------------------------ | ------------------------------- |
| What does the person weigh now?      | `personal_profile.weight_grams` |
| What did the person weigh on a date? | `body_weight_entry`             |

Goals & Energy continues to derive BMI, resting energy, and maintenance energy
from the current profile through its existing repository contract. Historical
energy estimates are not calculated, stored, or displayed.

History is never inferred. Profile edits do not create check-ins, check-in
edits and deletions do not modify the profile, and no measurement date is ever
reconstructed from current profile state or device time.

## Profile relationship at check-in

Creating a check-in offers one deliberate control, "Also update my profile
weight", enabled by default and available only when the new check-in is the
most recent recorded measurement. When enabled, the check-in insert and the
profile upsert run inside one exclusive SQLite transaction through the existing
transaction runner, so the two records can never disagree after a partial
failure. When disabled, only the history record is written.

Editing or deleting a check-in never writes to the profile. Correcting a typo
must not silently change Goals & Energy inputs.

## Domain model

`BodyWeightEntry` is an immutable `@fitness/domain` record:

- `id`: `DomainId`, an application-generated UUID.
- `mass`: existing `Mass` value object, canonical grams.
- `note`: optional trimmed text, at most 200 characters, or `null`.
- `occurredAtEpochMilliseconds`, `localCalendarDate`, `utcOffsetMinutes`:
  the occurrence semantics already used by nutrition, hydration, and workout
  history. The local calendar date must equal the occurrence instant shifted by
  the stored offset, so a historical entry cannot move between days when the
  device timezone changes.

Accepted mass reuses `profileLimits.weightGrams` (2 kg to 500 kg) so the
profile and its history cannot disagree about a valid weight. No new mass,
weight, or measurement value object is introduced.

## Persistence

Forward-only migration 11 creates `body_weight_entry` with a text primary key,
canonical `mass_grams`, the occurrence triple, an optional note, database check
constraints mirroring the domain invariants, and one index on
`(local_calendar_date DESC, occurred_at_epoch_ms DESC, id DESC)`.

"Latest" is defined as the maximum of that same ordered triple, so a single
index serves history listing, range reads, and latest lookups. No aggregate
table, rollup, cache, or additional index is added.

All statements use bound parameters. Rows are revalidated through the domain on
read; a row that cannot be reconstructed becomes a safe `operation-failed`
persistence error that never contains a measurement value.

## Application layer

The capability owns its contracts under
`apps/mobile/src/features/body-measurement-history/application`:

- `BodyWeightEntryRepository`: `insert`, `getById`, `update`, `delete`,
  `listPage`.
- `BodyWeightCheckInTransactionContext`: the entry repository plus the existing
  `PersonalProfileRepository` contract, composed from one transaction.
- `BodyWeightProgressReader`: `summarizeRange(range)`.

Use cases: `CreateBodyWeightCheckInUseCase`, `UpdateBodyWeightEntryUseCase`,
`DeleteBodyWeightEntryUseCase`, `GetBodyWeightEntryUseCase`, and
`ListBodyWeightHistoryUseCase`. History reads are bounded: default page size 20,
maximum 50, with a keyset cursor. Lifetime history is never loaded at once.

## Progress integration

Progress gains one capability-owned range reader returning either no data or:

- first recorded weight and its local calendar date;
- latest recorded weight and its local calendar date;
- recorded entry count;
- recorded change, present only when at least two check-ins exist.

Semantics are descriptive. No check-in in the period is no data, not zero. One
check-in shows a recorded weight and states that a change needs at least two
check-ins. Missing days are never interpolated and no trend, rate, projection,
or health interpretation is presented.

Progress reads the profile's preferred unit system for display only. Canonical
grams are unchanged by that preference, and a preference change never rewrites
stored history.

## Experience and accessibility

The Profile tab owns the capability and links to `/body-measurements`, with
`/body-measurements/new` and `/body-measurements/[id]` for creating and editing.
No tab is added. The Progress card is read-only.

Screens use existing design-system components with explicit loading, failure,
empty, and validation states. Entry input and history display follow the
profile's preferred unit system, converting to canonical grams before domain
construction. Deletion requires an explicit confirmation that names the
consequence. Content wraps under large Dynamic Type, exposes combined
accessibility labels for measurement rows and the Progress summary, meets
minimum touch targets, and never communicates state through color alone.

## Security and privacy

Measurements stay in the app-local SQLite database. There is no network call,
telemetry, external analytics, or measurement value in any log, error message,
or QA artifact. End-to-end tests use synthetic values only. Application-level
database encryption remains deferred to dedicated data-lifecycle work.

## Verification and completion

- Domain tests cover valid and invalid mass, note trimming and limits,
  occurrence and offset consistency, immutability, and identifier validation.
- Application tests cover creation with and without profile synchronization,
  transaction failure leaving nothing written, validation failures, editing,
  deletion, missing records, bounded paging, and range summary semantics.
- Persistence tests cover the migration, insert, read, update, delete, latest
  and range queries, corrupt-row handling, and bound parameters.
- Progress tests cover no data, a single check-in, first/latest/change, weekly
  and monthly bounds, absence of interpolation, and unit-preference display.
- Presentation tests cover empty history, adding, validation, persisted lists,
  editing, deletion confirmation, Progress rendering, and accessible labels.
- Sprint 17 Maestro scenarios cover adding a check-in, persistence across
  relaunch, Progress integration, and editing or deleting a check-in.
- The full iOS regression suite passes on the final branch state.
- Repository formatting, lint, type checking, tests, and builds pass without
  warnings.

## Explicit exclusions

Waist and other circumferences, body-fat percentage, photos, image analysis,
historical BMI or energy snapshots, charts and chart libraries, trends, rates
of change, period comparison, medical guidance, wearable and health-platform
integration, backend services, authentication, synchronization, tombstones,
notifications, database encryption, export, and any second QA runner are
excluded.
