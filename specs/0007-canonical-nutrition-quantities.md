# Specification 0007: Canonical nutrition quantities

- Status: Approved
- Date: 2026-08-02

## Objective and scope

Establish pure Nutrition domain behavior for representing nutrition composition
against a physical metric reference and deterministically scaling that composition
to a consumed physical quantity. The capability supports food and beverage
descriptions, energy, a deliberately small nutrient vocabulary, explicit unknown
nutrients, and provider-neutral provenance.

This sprint changes only `@fitness/domain`. It adds no screen, food logging,
persistence, catalog, network integration, AI provider, API, parsing, household
quantity conversion, or synchronization behavior.

## Canonical quantities

A nutrition reference is exactly one positive `Mass` or positive `Volume`.
`Mass` stores its canonical value in grams and `Volume` stores its canonical
value in milliliters. Therefore examples such as nutrition per 100 g and per
250 mL enter calculations as canonical physical quantities even when an upstream
boundary originally accepted another supported physical unit.

Consumed quantities use the same representation and must have the same dimension
as the reference. The Nutrition domain rejects mass-to-volume and volume-to-mass
scaling because it has no density information and must not guess one. Reference
and consumed amounts must be greater than zero so every accepted scaling factor
is finite and meaningful.

Serving, piece, slice, cup, tablespoon, teaspoon, plate, bowl, scoop, can, bottle,
and ounce are not Nutrition domain reference kinds. A future input adapter may
resolve a presentation quantity to `Mass` or `Volume` before domain calculation,
but no such resolution is part of this sprint.

## Nutrition composition

`NutritionFacts` owns a nonblank normalized description, physical reference,
required `Energy`, supported nutrients, and provenance. The Sprint 7 nutrient
vocabulary is:

| Nutrient     | Canonical unit |
| ------------ | -------------- |
| Protein      | gram           |
| Carbohydrate | gram           |
| Fat          | gram           |
| Fiber        | gram           |
| Sugar        | gram           |
| Sodium       | milligram      |

Every nutrient is either a finite nonnegative number in its declared canonical
unit or explicitly `null`, meaning unknown. Zero is a known measurement and is
not interchangeable with `null`. The object and its nested reference, nutrient,
and provenance data are immutable.

Provenance is provider-neutral: `provided` identifies composition supplied by a
non-estimation source, while `estimated` identifies composition derived through
estimation, including a future AI adapter. It intentionally does not contain a
Gemini schema, provider response, cache identity, or persistence fields.

## Deterministic scaling

Scaling divides the canonical consumed amount by the canonical reference amount
and multiplies required energy and every known nutrient by that factor. Unknown
nutrients remain unknown and known zero nutrients remain known zero. Arithmetic
retains JavaScript double precision and does not round for presentation.

Scaling is synchronous, deterministic, framework-independent, constant-time,
and side-effect free. It never invokes AI, storage, networking, environment
state, or clocks. A future catalog may store and reuse the unscaled canonical
composition without changing this behavior.

## Boundaries and failure behavior

Factories validate unknown description, reference, nutrient, and provenance
input before constructing domain values. Expected invalid input returns the
existing `Result` and `DomainError` vocabulary. Errors do not include supplied
food descriptions or nutrient values. Scaling returns an explicit error for a
dimension mismatch or invalid consumed amount.

The application or infrastructure layer will eventually normalize external
provider output into the application-owned factory input. Providers do not own
the domain schema and must not be asked to repeat deterministic scaling.

## Serving design review

Sprint 7 does not need a generic `Serving` concept. A vague serving has no
physical invariant and cannot support deterministic scaling. `Mass` and `Volume`
fully express the calculation boundary, so adding `Serving` would create an
invalid intermediate state without demonstrated domain behavior.

Future presentation metadata may retain text such as "1 piece" or "serving size"
beside its resolved `Mass` or `Volume`, but calculations must use only the
resolved physical quantity. Such metadata does not belong in the Sprint 7
Nutrition model.

## Architecture and affected structure

New composition and scaling modules live under `packages/domain/src/nutrition`
and are exported only through the root `@fitness/domain` boundary. They reuse
shared `Mass`, `Volume`, `Result`, and `DomainError` plus Nutrition-owned
`Energy`. No application workspace or infrastructure module depends on them in
this sprint.

This extends the already accepted pure-domain dependency direction and does not
require a new architecture decision record.

## Verification

Domain tests cover mass and volume references, factory validation, every
supported nutrient, unknown and known-zero distinctions, provenance,
immutability, proportional upscaling and downscaling, raw precision, dimension
mismatch, positive-quantity requirements, and root public exports.

Completion requires formatting, linting, strict type checking, domain and
repository tests, all builds, and `git diff --check` without warnings. No manual
device testing is required because this sprint changes no application behavior.

## Privacy, security, accessibility, and operations

Food descriptions may be sensitive health-adjacent information. Domain errors do
not echo them, and the domain emits no logs or telemetry. No data is persisted or
transmitted. There is no UI, so accessibility behavior is unchanged. Operations,
recovery, migrations, rollout, and observability are not applicable.

## Alternatives and trade-offs

A generic serving abstraction was rejected because it could admit ambiguous
quantities. A generic unit string was rejected because it would weaken dimension
safety. Separate mass-reference and volume-reference classes were rejected as
unnecessary duplication; a discriminated reference keeps invalid cross-dimension
scaling detectable while reusing existing canonical measurements.

Using zero for unknown nutrients was rejected because it destroys information.
A provider-specific provenance structure was rejected because adapters must map
into the application schema. A generic nutrient map was rejected for this sprint
because arbitrary names and units would make the approved vocabulary unenforceable.

Required energy keeps the initial model focused on usable nutrition composition.
If a future catalog must store records with unknown energy, that requirement must
be designed explicitly instead of weakening this invariant speculatively.

## Explicit exclusions

Food entry, meal or diary entities, dates, recipes, portions, servings, density,
quantity resolution, unit parsing, household conversion tables, label scanning,
barcodes, images, presentation formatting, nutrient targets, persistence,
catalog matching, caching, databases, APIs, Gemini or other AI integration,
authentication, analytics, synchronization, and cloud behavior are excluded.

The repository owner approved the canonical quantity direction and staged
implementation on 2026-08-02.
