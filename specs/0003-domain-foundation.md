# Specification 0003: Domain foundation

- Status: Approved
- Date: 2026-08-01

## Objective

Establish the application's framework-independent domain language as a reusable,
independently compiled TypeScript package. This sprint defines only foundational
values needed across future nutrition, hydration, workout, and body capabilities.

## Scope

Create `@fitness/domain` with immutable result, error, identifier, measurement,
duration, and energy concepts. The package validates unknown input through
explicit result values, stores measurements in canonical units, supports unit
conversion and semantic equality, and exposes one documented public boundary.

The shared kernel owns `DomainError`, `DomainId`, `Result`, `Mass`, `Volume`, and
`Length`. Nutrition owns `Energy`; workout owns `Duration`. Hydration and body
have no capability-specific concepts yet and therefore receive no empty modules.

Valid measurements are finite and nonnegative. Zero is valid at this foundational
layer; a future use case may impose a positive-value invariant. Supported units
are deliberately limited to internationally defined units:

- mass: milligram, gram, kilogram, ounce, and pound;
- volume: milliliter, liter, and US fluid ounce;
- length: millimeter, centimeter, meter, inch, and foot;
- energy: kilojoule and kilocalorie;
- duration: second, minute, and hour.

## Architecture and dependencies

The package has no runtime dependency and must not import platform, framework,
storage, network, environment, or database APIs. Capability modules may import
the shared kernel; the shared kernel cannot import capabilities. Consumers must
use the root `@fitness/domain` export rather than package internals.

The package compiles to CommonJS with declarations for compatibility with the
current NestJS and Metro consumers. Neither application consumes it during this
sprint. Vitest provides package-local TypeScript tests without Expo coupling.
See [ADR 0003](../docs/decisions/0003-pure-domain-package.md).

## Validation and failure behavior

Expected validation failures return `Result` with an immutable `DomainError`.
Messages are generic and do not contain supplied values or identifiers. Factories
reject nonnumeric, nonfinite, negative, overflowing, or unsupported-unit input.
`DomainId` accepts caller-supplied RFC 4122 UUIDs and normalizes them to lowercase.
It does not generate identifiers.

No network, persistence, recovery, accessibility, or observability behavior is
introduced. The package processes no stored personal information and emits no
logs. Pure synchronous operations have constant time and memory cost.

## Testing and acceptance

Unit tests verify:

- valid and invalid construction;
- canonical conversion and equality;
- zero, fractional, nonfinite, negative, unsupported, and overflow cases;
- identifier validation and normalization;
- immutable value, error, and result containers;
- result narrowing and the public runtime exports.

Completion requires repository formatting, linting, strict type checking, unit
tests, all builds, and `git diff --check` without warnings. Documentation must
describe the implemented public surface and extension rules. Manual verification
confirms package isolation, emitted artifacts, and the absence of application
changes before merge is recommended.

## Explicit exclusions

This sprint introduces no entities, aggregates, records, logging workflows,
plans, targets, BMI, TDEE, calorie calculations, analytics, parsing, localized
formatting, serialization, persistence, synchronization, APIs, authentication,
AI, notifications, React Native, Expo, database code, or background worker.
Identifier generation, entity-specific identifier types, clocks, ordering,
deletion, reconciliation, and API or storage representations remain deferred.

## Alternatives and trade-offs

Branded primitives were rejected because their validation disappears at runtime.
A generic measurement abstraction was rejected because it could express invalid
unit categories and obscure product language. Throwing constructors were rejected
because invalid external input is expected boundary behavior. Mobile Jest was
rejected because domain tests should not require Expo transforms.

Canonical floating-point values make cross-unit equality direct. Equality uses a
narrow machine-precision tolerance for IEEE 754 conversion artifacts; stored and
returned values remain unrounded because presentation policies belong to future
use cases and adapters.

## Migration and rollback

There is no stored data, API, or application migration. Rollback removes the
domain workspace and its documentation and restores the lockfile. Because no
application consumes the package, rollback cannot affect user data or runtime
behavior.

The repository owner approved the Stage 1 design on 2026-08-01.
