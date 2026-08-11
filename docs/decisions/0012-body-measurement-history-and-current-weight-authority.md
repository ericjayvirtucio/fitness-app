# ADR 0012: Body measurement history and current-weight authority

**Status:** Accepted

## Context

`personal_profile` holds one mutable current weight with no identifier, no
timestamp, and no history. Editing it destroys the previous value, so the
product cannot say when a weight changed.
[ADR 0011](0011-cross-capability-derived-progress-analytics.md) therefore
excluded profile weight from Progress.

Introducing history creates a risk of two competing answers to "what does this
person weigh now?", which would make Goals & Energy non-deterministic, and a
risk of a generic measurement framework built before a second measurement type
exists.

## Decision

Add a Body Measurement History capability containing exactly one measurement
type, body weight, persisted as immutable-by-default `body_weight_entry` rows
with the occurrence triple already used by nutrition, hydration, and workout
history.

Authority is split and explicit. The profile row remains the only source of
current weight and continues to feed Goals & Energy. `body_weight_entry` is the
only source of historical weight and feeds Progress.

Creating a check-in may also update the profile weight, but only through one
deliberate, user-visible control, only when the check-in is the most recent
measurement, and only as a single exclusive SQLite transaction composed from the
existing transaction runner using both capabilities' application contracts.
Editing or deleting a check-in never writes to the profile, and editing the
profile never writes history.

Body weight reuses `Mass` and `profileLimits.weightGrams`. One table and one
domain record model one measurement type; a second type will add its own table,
record, and reader rather than a shared discriminated schema.

Progress receives one capability-owned range reader that reports first, latest,
count, and recorded change. It also reads the profile's preferred unit system
for display only.

## Consequences

- Goals & Energy is unchanged and keeps a single deterministic weight input.
- Progress can describe recorded body-weight change truthfully for the first
  time, and reports no data rather than zero when nothing was recorded.
- A crash cannot leave the profile and the newest check-in disagreeing.
- Weight changed directly on the Profile screen produces no history record.
  This gap is intentional and documented rather than silently reconstructed.
- Progress now depends on the personal-profile contract for a display
  preference. It still reads no historical value from a mutable singleton.
- Adding waist or body-fat later costs one table, one record, and one reader
  each, with no migration of existing rows.

## Alternatives considered

- A shared `body_measurement` table with a type discriminator. Canonical units
  differ per type, so the schema would need nullable per-unit columns or an
  untyped value plus unit kind, weakening check constraints and drifting toward
  the generic framework this repository avoids.
- Fully independent history with no profile coordination. Simpler, but the user
  enters the same weight twice and Goals & Energy silently goes stale.
- Making the latest check-in the source of current weight. Conceptually
  cleanest, but it rewrites Personal Profile, Goals & Energy, and their flows,
  and current weight must still exist before any check-in.
- Sequential non-transactional writes. A failure between them reintroduces the
  inconsistency this capability exists to remove.
- A weight chart. It adds a dependency and accessibility burden without
  evidence that it beats first, latest, and recorded change.
