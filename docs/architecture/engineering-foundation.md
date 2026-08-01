# Engineering Foundation

## Status

Current engineering foundation, extended by the approved Phase 1 mobile shell.

## Context

The product requires an offline-first React Native client and a future authoritative backend. Phase 0 creates reliable engineering boundaries without implementing product behavior or guessing at domain abstractions.

## System shape

The pnpm workspace contains two deployable applications and one configuration package:

- `@fitness/mobile` is an Expo Router application shell. It owns future offline interaction and device integration.
- `@fitness/api` is a route-free NestJS application. It will own future cloud business authority.
- `@fitness/typescript-config` centralizes strict compiler policy with platform-specific extensions.

Turborepo coordinates `dev`, `build`, `lint`, `typecheck`, `test`, and `clean` tasks. It does not define runtime coupling between applications.

The mobile application composes a root stack and five bottom-tab destinations. File-based route modules remain thin; shell UI, typed semantic tokens, and navigation metadata live under `apps/mobile/src`. See [ADR 0002](../decisions/0002-expo-router-mobile-shell.md).

The app-local design system is the public UI boundary for mobile features. It
provides system-selected light and dark themes, semantic token scales, and the
foundational components approved in [Specification 0002](../../specs/0002-design-system-foundation.md).
It remains inside the mobile application because there is no second React
Native consumer. Ionicons through Expo vector icons is the sole icon set, and
the system adds no theme provider or UI-framework dependency.

## Boundaries

The mobile and API applications do not import each other. Phase 0 contains no shared domain, UI, validation, persistence, API client, or synchronization package because no approved feature demonstrates those boundaries yet.

When business rules arrive, they should remain pure and have one canonical implementation. How that code is packaged and consumed must be established by the first domain specification, including the server's authority and mobile's offline requirements.

## Quality controls

- TypeScript enables strict and additional correctness flags.
- ESLint applies shared semantic checks and type-aware TypeScript rules. Platform-specific lint rules should be added only when platform code requires them.
- Prettier owns formatting.
- lint-staged provides focused pre-commit checks.
- GitHub Actions performs clean-install formatting, linting, type checks, and tests.
- Jest Expo and React Native Testing Library verify mobile component behavior,
  theme selection, interaction states, and accessibility contracts.
- Builds are available locally and through the root task but are not yet a required CI gate.

## Deliberate omissions

The repository has no business routes, database, authentication, environment secrets, domain models, deployment workflow, cloud infrastructure, worker, or state-management library. Mobile navigation and component testing are limited to the approved application shell.

API and domain testing tools remain deferred until their first meaningful behavior. End-to-end device testing and deployment configuration require an approved critical journey or runtime target and operational owner.

## Evolution rules

Architecture changes require an ADR and corresponding documentation update. New packages require demonstrated reuse or a compelling isolation boundary. Database and synchronization work requires an approved model for identifiers, migrations, conflicts, deletion, recovery, and offline failure behavior.
