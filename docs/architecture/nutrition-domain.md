# Nutrition domain architecture

## Purpose and boundary

The Nutrition domain represents nutrition composition against a resolved
physical quantity and scales it deterministically. `@fitness/domain` owns this
schema and arithmetic. It has no dependency on food-entry UI, databases,
catalogs, network APIs, caches, synchronization, or AI providers.

The current flow ends at the pure domain boundary:

```text
validated description + canonical Mass or Volume + nutrition composition
  → NutritionFacts.create
  → immutable canonical NutritionFacts
  → scaleNutritionFacts with canonical consumed Mass or Volume
  → proportionally scaled NutritionFacts
```

Offline Nutrition logging now composes this behavior into entry-owned snapshots
and daily totals; see
[Offline nutrition logging architecture](offline-nutrition-logging.md).

## Physical quantity model

A `NutritionReference` discriminates between `mass` and `volume` and contains an
existing `Mass` or `Volume` value. Those values store grams and milliliters
canonically. Nutrition references and consumed quantities must be positive, and
scaling requires matching dimensions. The domain cannot convert between mass and
volume because it has no density information.

Serving, piece, slice, cup, tablespoon, teaspoon, plate, bowl, scoop, can, bottle,
and similar labels are not accepted reference kinds. An upstream boundary must
resolve such input to a physical quantity before calling Nutrition behavior.
Ounce input, if supported by an upstream measurement boundary, is already
converted to canonical grams before it becomes part of a Nutrition reference.

Presentation may eventually retain text such as “1 piece” as metadata beside its
resolved quantity. That text cannot replace the canonical quantity or participate
in arithmetic.

## Composition and unknown values

`NutritionFacts` contains:

- a trimmed, nonblank normalized description;
- one positive mass-based or volume-based reference;
- required canonical `Energy`;
- protein, carbohydrate, fat, fiber, and sugar in grams;
- sodium in milligrams; and
- `provided` or `estimated` provenance.

Each nutrient is a finite nonnegative number or `null`. `null` is explicit
unknown information; numeric zero is a known zero. Unit-bearing property names
make the fixed vocabulary visible at the TypeScript boundary and prevent a
provider from introducing arbitrary nutrients or units.

`provided` means the facts came from a non-estimation source. `estimated` covers
estimated composition, including future AI-derived facts, without naming an AI
vendor in the domain. Provenance is descriptive metadata and does not alter
arithmetic.

## Scaling and precision

Scaling uses canonical values:

```text
factor = consumed grams or milliliters / reference grams or milliliters
scaled known value = reference known value × factor
scaled unknown value = unknown
```

The returned facts use the consumed quantity as their new reference. Energy and
all known nutrients are scaled once in pure domain behavior. Unknown nutrients
remain `null`; known zero nutrients remain `0`. Calculations retain JavaScript
double precision and do not round or format.

## Future adapter and catalog seams

A future enrichment adapter may validate provider output, map the provider's
description and units into application-owned inputs, create canonical
measurements, mark provenance as `estimated`, and then call
`NutritionFacts.create`. Provider transport JSON must remain in that adapter and
must not redefine the domain model.

A future local catalog may persist its own versioned representation of canonical
facts and reconstruct `NutritionFacts` after validating stored data. Matching,
reliability policy, identifiers, serialization, migrations, caching, and cloud
reconciliation remain outside the domain. Reused facts can be scaled locally
without another provider request.

## Failure and privacy behavior

Expected invalid input returns `Result` with safe `DomainError` values. Errors
identify a field but never echo food descriptions or supplied nutrient values.
Dimension mismatch is explicit. Numeric overflow is rejected by the same
validated construction path used for initial facts.

Food descriptions and nutrition composition may be health-adjacent sensitive
information. The domain logs, persists, and transmits nothing.

## Current limitations

- Energy is required; unknown energy is not represented.
- The nutrient vocabulary is limited to the six approved fields.
- Density and mass-to-volume conversion are absent.
- Quantity parsing and household-unit resolution are absent.
- Serving metadata is absent.
- Consumption-event identity, a local diary, and entry persistence are now
  implemented. There is still no reusable food identity, catalog, meal model, or
  provider integration.
