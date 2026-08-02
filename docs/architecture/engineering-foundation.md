# Engineering Foundation

## Status

Current engineering foundation, extended by the approved mobile shell, design
system, pure domain foundation, and mobile local-persistence foundation.

## Context

The product requires an offline-first React Native client and a future authoritative backend. Phase 0 creates reliable engineering boundaries without implementing product behavior or guessing at domain abstractions.

## System shape

The pnpm workspace contains two deployable applications and two shared packages:

- `@fitness/mobile` is an Expo Router application shell. It owns future offline interaction and device integration.
- `@fitness/api` is a route-free NestJS application. It will own future cloud business authority.
- `@fitness/typescript-config` centralizes strict compiler policy with platform-specific extensions.
- `@fitness/domain` defines dependency-free values and invariants shared by future
  mobile and API capabilities.

Turborepo coordinates `dev`, `build`, `lint`, `typecheck`, `test`, and `clean` tasks. It does not define runtime coupling between applications.

The mobile application composes a root stack and five bottom-tab destinations. File-based route modules remain thin; shell UI, typed semantic tokens, and navigation metadata live under `apps/mobile/src`. See [ADR 0002](../decisions/0002-expo-router-mobile-shell.md).

The app-local design system is the public UI boundary for mobile features. It
provides system-selected light and dark themes, semantic token scales, and the
foundational components approved in [Specification 0002](../../specs/0002-design-system-foundation.md).
It remains inside the mobile application because there is no second React
Native consumer. Ionicons through Expo vector icons is the sole icon set, and
the system adds no theme provider or UI-framework dependency.

## Boundaries

The mobile and API applications do not import each other. The pure domain package
is their future shared business-language boundary, but neither application consumes
it until an approved feature demonstrates the integration. There is no shared UI,
API client, or synchronization package. Mobile-local persistence remains inside
`apps/mobile` because there is no second SQLite consumer.

The mobile composition root opens Expo SQLite and runs ordered, forward-only
migrations before routes render. The driver is hidden behind infrastructure
contracts; future capability-owned repository interfaces remain
application-facing. See [the local persistence architecture](local-persistence.md)
and [ADR 0004](../decisions/0004-expo-sqlite-local-persistence.md).

Foundational business values remain pure and have one canonical implementation in
`@fitness/domain`. Capability modules depend only on its narrow shared kernel. See
[the domain architecture](domain-foundation.md) and [ADR 0003](../decisions/0003-pure-domain-package.md).

## Quality controls

- TypeScript enables strict and additional correctness flags.
- ESLint applies shared semantic checks and type-aware TypeScript rules. Platform-specific lint rules should be added only when platform code requires them.
- Prettier owns formatting.
- lint-staged provides focused pre-commit checks.
- GitHub Actions performs clean-install formatting, linting, type checks, and tests.
- Jest Expo and React Native Testing Library verify mobile component behavior,
  theme selection, interaction states, and accessibility contracts.
- Vitest verifies pure domain behavior independently of application frameworks.
- Builds are available locally and through the root task but are not yet a required CI gate.

## Deliberate omissions

The personal profile is the first business route and feature table. It establishes
capability-owned application, infrastructure, and presentation roles while reusing
the domain and persistence foundations. See
[the personal-profile architecture](personal-profile.md) and
[ADR 0005](../decisions/0005-capability-application-slices.md).

The repository still has no authentication, backend business endpoint, cloud
infrastructure, worker, synchronization, or state-management library.

API testing tools remain deferred until the API has meaningful behavior. End-to-end
device testing and deployment configuration require an approved critical journey
or runtime target and operational owner.

## Evolution rules

Architecture changes require an ADR and corresponding documentation update. New packages require demonstrated reuse or a compelling isolation boundary. Database and synchronization work requires an approved model for identifiers, migrations, conflicts, deletion, recovery, and offline failure behavior.
