# ADR 0003: Pure domain package

- Status: Accepted
- Date: 2026-08-01

## Context

The mobile and API applications will both need the same fitness language and
invariants. Earlier phases deferred shared domain code until a reviewed use case
demonstrated the boundary. Foundational measurements now span known nutrition,
hydration, workout, and body capabilities and need independent verification
without binding business rules to either application framework.

## Decision

Create a private workspace package named `@fitness/domain`. Keep its runtime
dependency-free and expose a single root public API. Organize code by capability,
with a deliberately small shared kernel for concepts used by multiple capabilities.
Do not create empty modules.

Represent validated domain values with frozen classes and private constructors.
Use named factories returning a discriminated `Result` for expected invalid input.
Store measurements in a documented canonical unit so values created in equivalent
units compare semantically. Do not apply implicit rounding or formatting.

Accept caller-supplied RFC 4122 UUIDs through `DomainId`, but defer generation,
entity-specific identifier types, and synchronization semantics. Compile the
package to CommonJS with TypeScript declarations for the current consumers. Use
Vitest for isolated TypeScript unit tests. Do not connect either application to
the package until an approved feature needs it.

## Consequences

- Mobile and API can eventually consume one canonical domain implementation.
- The domain can compile and run tests independently of Expo and NestJS.
- Validation failures are explicit and framework-neutral.
- Canonical conversion permits cross-unit equality but retains normal JavaScript
  floating-point precision characteristics.
- The shared kernel requires disciplined admission to avoid becoming a catch-all.
- Vitest adds development-only dependency and lockfile cost.
- A general `DomainId` does not yet prevent mixing identifiers for different
  future entity types.
- A root-only export is simple today but may need capability subpaths when the
  demonstrated public surface grows.

## Alternatives considered

- **App-local domain code:** rejected because known rules cross the mobile and API
  boundary and duplication would risk behavioral drift.
- **One package per capability:** rejected as premature package proliferation.
- **Branded primitives:** rejected because brands provide no runtime validation.
- **Generic measurement type:** rejected because category-specific values express
  the language and prevent unsupported unit combinations more clearly.
- **Throwing constructors:** rejected because invalid boundary input is expected.
- **Jest through the mobile workspace:** rejected because it would couple pure
  domain tests to Expo configuration.
