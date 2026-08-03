# Domain foundation

## Purpose

`@fitness/domain` defines the platform's framework-independent fitness language.
It contains pure values and invariants, not application workflows or infrastructure.
The package has no runtime dependencies and compiles independently.

## Module boundaries

The shared kernel contains only concepts with more than one demonstrated domain
consumer:

- `Result`, `DomainError`, and `DomainId` provide boundary-safe foundations.
- `Mass`, `Volume`, and `Length` span multiple product capabilities.

Hydration owns immutable fluid-intake events, a user-defined daily target, and
deterministic daily fluid aggregation while composing shared `Volume` and
`DomainId`. Nutrition owns `Energy`, canonical nutrition composition, deterministic mass- or
volume-based scaling, consumption entries, and daily aggregation; see
[Nutrition domain architecture](nutrition-domain.md). Workout owns `Duration`.
Body measurements will use `Mass` and
`Length`. Empty capability modules are not created. A new concept belongs in the
capability whose language defines it unless at least two real capabilities need
the same invariant.

Personal profile owns `UserProfile`, its supported activity, biological-sex, and
unit-system vocabularies, calendar-date rule, and reasonable height and weight
ranges. It composes shared `Length` and `Mass` values rather than duplicating
measurement conversion.

Goals & Energy owns adult age derivation, BMI screening categories, Mifflin-St
Jeor resting-energy estimates, activity multipliers, goal configuration, and
daily calorie target guardrails. It depends one way on Personal Profile's option
vocabulary so supported values cannot drift; see
[ADR 0006](../decisions/0006-goals-energy-domain-dependency.md). Calculation
sources, limitations, and precision are documented in
[Goals and energy architecture](goals-and-energy.md).

Dependencies point inward:

```text
nutrition ──┐
workout ────┼──> shared kernel ──> no runtime dependencies
future body ┤
hydration ────────┘
```

The shared kernel never imports a capability. Capability-to-capability imports
require a reviewed design change. Consumers import from `@fitness/domain`; deep
imports into `src` or `dist` are unsupported.

## Value-object philosophy

Value objects are immutable, validate their complete state at creation, compare
by semantic value, and expose no framework or persistence representation. Their
constructors are private. Factories accept unknown boundary input and return
`Result` rather than throwing for expected validation failures.

Measurements store canonical values:

| Value      | Canonical unit |
| ---------- | -------------- |
| `Mass`     | gram           |
| `Volume`   | milliliter     |
| `Length`   | millimeter     |
| `Energy`   | kilojoule      |
| `Duration` | second         |

Canonical storage makes equivalent units directly comparable. Equality allows
only a small, scale-relative machine-precision tolerance so decimal conversion
artifacts do not make physically equivalent values unequal. Values expose explicit
`in(unit)` conversion and never round or localize. UI and transport adapters own
presentation, parsing, precision, and serialization policies.

Zero is valid at this layer. A future capability can require a positive value
when its use case demonstrates that invariant. Negative, nonfinite, unsupported,
and numerically overflowing values are rejected.

## Results and errors

`Result<TValue, TError>` is a frozen discriminated union. Use `isOk` or `isErr`
to narrow it. `DomainError` contains a stable code, safe message, and optional
field. Error messages never include supplied fitness values or identifiers.

```ts
import { Mass, isErr } from '@fitness/domain';

const result = Mass.create(75, 'kilogram');

if (isErr(result)) {
  return result.error;
}

const pounds = result.value.in('pound');
```

Unexpected programmer defects should remain visible; do not convert arbitrary
exceptions into validation results or swallow them.

## Identifiers

`DomainId.create` validates a caller-supplied RFC 4122 UUID and normalizes its
text to lowercase. The domain does not generate identifiers because randomness,
clock choice, ordering, offline creation, and synchronization semantics must be
designed together. Add entity-specific identifier values only with real entities.

## Naming and extension rules

- Use product-language class and type names in `PascalCase`.
- Use `kebab-case` files and colocated `*.spec.ts` tests.
- Name units completely (`kilogram`, not `kg`) in the domain API.
- Add a unit only when a supported product input or output requires it.
- Define exact conversion factors and a canonical unit in the same module.
- Test construction, validation, conversion, equality, immutability, and edges.
- Export supported concepts from `src/index.ts`; consumers must not import internals.
- Do not add `utils`, `common`, generic repositories, base entities, or empty modules.
- Do not import React Native, Expo, NestJS, Node APIs, storage, HTTP, databases,
  environment state, clocks, random generators, or logging into domain source.

Serialization is intentionally absent. Future adapters must validate untrusted
input before treating it as a domain value and must define versioned transport or
storage representations outside this package.
