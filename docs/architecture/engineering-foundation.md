# Engineering Foundation

## Status

Current architecture for Phase 0.

## Context

The product requires an offline-first React Native client and a future authoritative backend. Phase 0 creates reliable engineering boundaries without implementing product behavior or guessing at domain abstractions.

## System shape

The pnpm workspace contains two deployable applications and one configuration package:

- `@fitness/mobile` is a minimal Expo application. It owns future offline interaction and device integration.
- `@fitness/api` is a route-free NestJS application. It will own future cloud business authority.
- `@fitness/typescript-config` centralizes strict compiler policy with platform-specific extensions.

Turborepo coordinates `dev`, `build`, `lint`, `typecheck`, and `clean` tasks. It does not define runtime coupling between applications.

## Boundaries

The mobile and API applications do not import each other. Phase 0 contains no shared domain, UI, validation, persistence, API client, or synchronization package because no approved feature demonstrates those boundaries yet.

When business rules arrive, they should remain pure and have one canonical implementation. How that code is packaged and consumed must be established by the first domain specification, including the server's authority and mobile's offline requirements.

## Quality controls

- TypeScript enables strict and additional correctness flags.
- ESLint applies shared semantic checks and type-aware TypeScript rules. Platform-specific lint rules should be added only when platform code requires them.
- Prettier owns formatting.
- lint-staged provides focused pre-commit checks.
- GitHub Actions performs clean-install formatting, linting, and type checks.
- Builds are available locally and through the root task but are not yet a required CI gate.

## Deliberate omissions

Phase 0 has no business routes, database, authentication, environment secrets, domain models, testing framework, deployment workflow, cloud infrastructure, worker, navigation library, or state-management library.

Testing tools will be selected with the first meaningful behavior so unit, integration, and device-test choices respond to real boundaries. Deployment configuration will be introduced only with an approved runtime target and operational owner.

## Evolution rules

Architecture changes require an ADR and corresponding documentation update. New packages require demonstrated reuse or a compelling isolation boundary. Database and synchronization work requires an approved model for identifiers, migrations, conflicts, deletion, recovery, and offline failure behavior.
