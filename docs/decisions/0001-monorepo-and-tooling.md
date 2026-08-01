# ADR 0001: Monorepo and foundation tooling

- Status: Accepted
- Date: 2026-08-01

## Context

The product will contain a React Native mobile application, a TypeScript backend, and selectively shared logic. It needs consistent local and CI checks while avoiding speculative services and packages.

## Decision

Use pnpm Workspaces for dependency and workspace management and Turborepo for task orchestration. Use Expo for the React Native application and NestJS for the API. Centralize strict TypeScript policy in `@fitness/typescript-config`; keep production dependencies with their executing application.

Use ESLint for semantic checks, Prettier for formatting, EditorConfig for editor-neutral basics, and Husky with lint-staged for pre-commit feedback. GitHub Actions runs frozen installation, formatting, linting, and type checking.

Create no shared domain or infrastructure package until approved behavior demonstrates its responsibility.

## Consequences

- Applications can evolve independently while sharing consistent repository controls.
- pnpm's strict dependency model exposes undeclared dependency use.
- Turborepo adds configuration but enables scalable task dependencies and caching.
- Platform-specific compiler details remain explicit; platform lint rules can extend the shared baseline when real code requires them.
- The first domain feature must decide its testing tools and validate the appropriate shared-code boundary.
- Deployment, persistence, authentication, and synchronization decisions remain open and require later ADRs.

## Alternatives considered

- **Independent repositories:** rejected because shared policy and future domain code would require duplication and coordinated versioning too early.
- **npm or Yarn workspaces:** viable, but pnpm was selected for strict dependency resolution, efficient storage, and strong workspace filtering.
- **Nx:** capable but broader than the current orchestration need.
- **Premature shared packages:** rejected because names alone do not establish sound boundaries.
