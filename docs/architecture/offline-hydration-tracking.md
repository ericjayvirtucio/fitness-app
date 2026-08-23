# Offline hydration tracking architecture

## Boundary and flow

Hydration is a dedicated offline capability:

```text
Today and Hydration routes
  → Hydration screens
  → capability-owned use cases and repository contracts
  → Hydration SQLite repositories
  → internal DatabaseConnection
  → Expo SQLite
```

`@fitness/domain` owns immutable entries, targets, temporal consistency, volume
limits, and pure daily aggregation. Mobile application behavior parses user input,
injects Expo Crypto UUIDs and the current time, rejects future occurrences, and
coordinates repositories. Presentation owns date/time input, unit selection,
formatting, and interaction state. SQLite rows never leave infrastructure.

## Fluid policy and Nutrition boundary

An entry is either `plain-water` or `other-fluid`. Every explicitly entered fluid
contributes its canonical milliliters to total fluid intake. Plain water and other
fluid remain visible as separate subtotals. The model makes no claim about
beverage-specific physiological effects.

Hydration stores no calories, nutrients, Nutrition catalog identity, or Nutrition
diary identity. It neither scans nor writes Nutrition tables. A beverage logged in
both capabilities is two explicit user actions. Future dual logging requires a
reviewed design for linkage, ownership, editing, deletion, duplication, and sync.

## Identity, history, and mutation

Expo Crypto creates entry UUIDs at composition and `DomainId` validates them.
Volume uses the existing canonical `Volume` value; persistence stores only
milliliters. Entry volume must be positive and no more than 10,000 mL. Another
fluid can retain an optional trimmed description of up to 80 characters; plain
water has no description.

Occurrence epoch, captured `YYYY-MM-DD`, and captured UTC offset follow Nutrition's
established semantics. Domain construction verifies agreement. Queries use the
captured date, so travel or later timezone changes do not move historical entries.
Edits replace validated state while retaining identity and may move an event to a
different day. Deletion is a confirmed hard delete with no tombstone or undo.

The daily screen's selected day supplies the create path's default and reaches
the entry route as a validated `date` query parameter, under the same rule
Nutrition uses: today keeps the current clock, any other day prefills `12:00`,
and an absent, malformed, or not-yet-happened day falls back to today with the
Date field showing it. The `Next` control is disabled on today, because the entry
builder refuses a future instant. Target progress still appears only for today,
unchanged, because targets remain unversioned. See
[ADR 0027](../decisions/0027-a-day-control-governs-what-a-screen-records.md).

## Target and daily aggregation

Hydration owns one optional user-defined target. There is no default, profile
dependency, calorie-goal dependency, or medical recommendation. UI accepts mL or
L and `Volume` converts to canonical milliliters. A target must be positive and no
more than 20,000 mL as an input-integrity boundary.

`summarizeHydrationEntries` derives entry count, total fluid, water, other fluid,
target, remaining, and completion percentage. Remaining stops at zero while total
and percentage remain uncapped. Derived summaries are not persisted.

The singleton target represents current configuration, not historical target
history. Target progress is shown for today. Other selected dates show stable
entry totals and explicitly omit historical progress claims.

Progress range summaries are exposed through a Hydration-owned reader and group
bounded captured local dates into total, plain-water, other-fluid, and entry
counts. They deliberately exclude the mutable target because target history is
not persisted.

## Persistence, errors, and performance

Migration 6 adds `hydration_entry`, its `(local_calendar_date,
occurred_at_epoch_ms DESC, id)` index, and singleton `hydration_target`. It does
not alter Nutrition tables or add foreign keys, sync fields, timestamps, or
aggregates. Reads reconstruct and validate domain values; writes bind every value.

Each user action performs one SQLite statement, so application transactions add
no atomicity and are not used. One query loads a selected day and one query loads
the target in parallel. Aggregation is in memory with no per-card reads, cache,
global state, or worker.

Expected validation produces field-addressable domain errors. SQLite failures use
safe `PersistenceError` messages. SQL, IDs, descriptions, times, volumes, and
targets are never exposed through errors or logs.

## Experience, privacy, and limitations

The existing Today tab hosts the daily Hydration surface. Nested routes provide
fast add/edit and target configuration. Exact 250, 350, 500, 750, and 1,000 mL
presets complement custom mL input; ambiguous container units are absent.

Screens reuse the design system and support Dynamic Type, visible units, native
radio semantics, minimum touch targets, keyboard operation, live error feedback,
descriptive cards, destructive confirmation, and textual target progress for
assistive technology.

The target progress card is deliberately unlabelled. A labelled `Card` is one
accessibility element, and while this one carried a composed name its
"Change daily target" control never reached the accessibility tree at all — a
person using a screen reader had no route back to the target screen once a target
existed. Its lines and its control announce themselves instead. The daily totals
card keeps its name, because it holds no control. See
[Specification 0034](../../specs/0034-announced-card-contents.md) and
[ADR 0024](../decisions/0024-labelled-containers-announce-their-contents.md).

Hydration records remain in the operating-system application sandbox. There is no
networking, analytics, telemetry, or third-party processing. Encryption, export,
backup, restore, reset, retention, reminders, analytics, personalized targets,
health-platform integration, and synchronization remain unavailable.

Both tables carry the synchronization-readiness metadata described in
[Schema synchronization readiness](schema-synchronization-readiness.md).
Deleting an entry tombstones the row rather than removing it; every read here
already excludes a tombstoned row. No synchronization exists yet.
