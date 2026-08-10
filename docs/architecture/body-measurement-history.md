# Body measurement history architecture

## Flow and boundaries

Body Measurement History is an offline mobile capability owned by the Profile
area:

```text
Profile route
  → PersonalProfileScreen ("Open body measurements")
  → /body-measurements
  → BodyMeasurementHistoryScreen / BodyWeightEntryScreen
  → CreateBodyWeightCheckInUseCase and the entry use cases
  → BodyWeightEntryRepository (+ PersonalProfileRepository at check-in)
  → BodyWeightEntrySqliteRepository
  → internal DatabaseConnection
  → Expo SQLite
```

`@fitness/domain` owns the immutable `BodyWeightEntry`. The mobile application
layer owns the repository contracts, boundary parsing, unit conversion, and the
transaction that a check-in may need. Presentation owns only input strings,
display rounding, and interaction state. React components never query SQLite.

## Historical source of truth

Two questions have two different owners and they are never merged:

| Question                             | Authority                       |
| ------------------------------------ | ------------------------------- |
| What does the person weigh now?      | `personal_profile.weight_grams` |
| What did the person weigh on a date? | `body_weight_entry`             |

Goals & Energy keeps reading the current profile for BMI, resting energy, and
maintenance energy. Progress reads only recorded check-ins. Historical BMI and
historical energy estimates are not derived, stored, or displayed.

History is never inferred. Editing weight on the Profile screen does not create
a check-in, so a profile-only edit leaves a gap in history. That gap is
deliberate: a reconstructed date would be a guess presented as a record.

## Relationship with Personal Profile

Creating a check-in shows one deliberate control, "Also update my profile
weight", enabled by default. The update is applied only when the new check-in
is the most recent measurement, so a backdated correction cannot overwrite the
current weight. Both writes then run in one exclusive SQLite transaction built
from `SqliteTransactionRunner` and `BodyWeightCheckInTransactionContext`, which
composes the body-measurement and personal-profile repositories from the same
transaction. A failure leaves neither record written.

Editing or deleting a check-in never writes the profile. Correcting a mistyped
historical value must not silently change what Goals & Energy uses today.

See [ADR 0012](../decisions/0012-body-measurement-history-and-current-weight-authority.md).

## Measurement types

Body weight only. It reuses the existing `Mass` value object with canonical
grams and the existing `profileLimits.weightGrams` range of 2 kg to 500 kg, so
the profile and its history cannot disagree about a valid weight.

Waist and other circumferences, body-fat percentage, and photo-derived
composition are out of scope. A future type adds its own table, domain record,
and Progress reader rather than a shared discriminated schema, because
canonical units differ per type and a shared value column would weaken database
constraints.

## Date and time semantics

Each check-in stores the occurrence triple already used by nutrition,
hydration, and workout history: `occurred_at_epoch_ms`, `local_calendar_date`,
and `utc_offset_minutes`. The domain rejects any entry whose calendar date does
not equal the occurrence instant shifted by the stored offset, so a recorded
check-in never moves between days when the device changes time zone. The
application layer rejects a future occurrence. Displayed times are rendered
from the stored offset, never from the current device offset.

## Edit and delete lifecycle

Check-ins can be created, edited, and deleted while the product is local-only.
Deletion asks for explicit confirmation that names the consequence and states
that the profile weight is unaffected. There are no tombstones and no audit
trail; both belong with synchronization design.

Editing may move a check-in between Progress periods, because the occurrence
date is editable. That is the intended correction behavior, not a defect: the
period summary always describes the records that currently exist.

## Progress integration

Progress gains one capability-owned reader, `BodyWeightProgressReader`,
following [ADR 0011](../decisions/0011-cross-capability-derived-progress-analytics.md).
For the selected period it reports the first recorded weight and date, the
latest recorded weight and date, the check-in count, and a recorded change.

Missing-data rules:

- No check-in in the period is no data, never a zero weight.
- One check-in shows a recorded weight and states that a change needs at least
  two check-ins.
- A change is the difference between the first and latest recorded check-ins.
  It is described as recorded change, never as a trend, rate, or health result.
- Days between check-ins are never interpolated.

Progress also reads the profile's preferred unit system to choose kilograms or
pounds. That preference affects display only; stored grams never change, and
changing the preference never rewrites history.

## Query strategy and persistence

Migration 11 creates `body_weight_entry` and one index on
`(local_calendar_date DESC, occurred_at_epoch_ms DESC, id DESC)`.

| Read            | Statement shape                                  |
| --------------- | ------------------------------------------------ |
| History list    | Keyset page, newest first, `LIMIT` size plus one |
| Latest check-in | Same ordering, `LIMIT 1`                         |
| Progress period | Count plus two `LIMIT 1` boundary sub-selects    |

"Latest" is the maximum of the same ordered triple used for listing, so one
index serves every read. History paging defaults to 20 rows and is capped at
50; lifetime history is never loaded at once. There is no aggregate table,
rollup, cache, or background work.

All statements use bound parameters. Every row is revalidated through the
domain on read, and a row that cannot be reconstructed becomes a safe
`operation-failed` persistence error containing no measurement value.

## Privacy and security

Measurements are health-adjacent personal data. They stay in the app-local
SQLite database. There is no network call, telemetry, or external analytics,
and no measurement value appears in a log, error message, or QA artifact.
End-to-end tests use synthetic values only. Application-level database
encryption remains deferred to dedicated data-lifecycle work; the capability
relies on the operating-system application sandbox and device encryption.

## Accessibility

History rows expose a combined label such as "Weight check-in 82.4 kilograms,
recorded Tue, 4 Aug 2026 at 07:30." The Progress card exposes "Body weight
progress. First recorded weight 83.0 kilograms. Latest recorded weight 81.8
kilograms. Recorded change minus 1.2 kilograms. 2 check-ins." Units are spelled
out for assistive technology and abbreviated visually. Every control meets the
minimum touch target, layouts grow with Dynamic Type, and no state is
communicated by color alone.

## Maestro coverage

`./scripts/qa.sh sprint 17 --platform ios` runs four independently reported
scenarios: an empty history, a check-in that survives a relaunch, two check-ins
feeding Progress and the current profile weight, and an edit followed by a
delete that leaves the profile weight unchanged.

`e2e/mobile/suites/regression/11-body-measurements.yaml` adds a compact
regression scenario. `e2e/mobile/flows/body-measurement/` holds the reusable
open and check-in flows, and `flows/profile/create-profile.yaml` is now shared
between the profile and body-measurement suites.

Check-in flows keep the prefilled local date so a scenario never records a
future measurement or crosses the selected period boundary.

## Known limitations

- Weight changed directly on the Profile screen creates no history record.
- Only body weight is recorded.
- Progress describes recorded change between check-ins and offers no trend,
  rate of change, projection, or period comparison.
- There is no chart, export, backup, or synchronization.
- A check-in recorded in the first minute of a local day cannot be preceded by
  the `00:01` synthetic time the Maestro flows use; the suite assumes it is not
  run in that minute.
