# Fitness App

Production-oriented foundation for an offline-first fitness platform targeting iOS, Android, and a supporting API.

Phase 1 adds an accessible Expo Router mobile shell while preserving the Phase 0 engineering foundation. It intentionally contains no authentication, persistence, domain features, synchronization, analytics, notifications, or AI integration.

## Prerequisites

- Node.js 24 or later
- pnpm 11 or later (the repository pins the expected version)
- Platform tooling required by [Expo](https://docs.expo.dev/get-started/set-up-your-environment/) when running a simulator or device

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
```

For the first install before a lockfile exists, use `pnpm install`.

## Common commands

```bash
pnpm dev           # Run all development servers
pnpm build         # Build/export all applications
pnpm format:check  # Verify formatting
pnpm lint          # Run lint checks
pnpm test          # Run automated tests
pnpm typecheck     # Run strict TypeScript checks
```

Run one application with a workspace filter:

```bash
pnpm --filter @fitness/mobile dev
pnpm --filter @fitness/api dev
```

The API reads `PORT` when it is supplied and otherwise listens on port `3000`. Phase 0 requires no secrets or environment file.

## Repository map

- `apps/mobile`: Expo and React Native application shell
- `apps/api`: NestJS API shell
- `packages/typescript-config`: shared strict compiler policies
- `docs`: architecture and durable engineering decisions
- `specs`: rules for future approved specifications
- `infrastructure`: admission rules for future operational configuration
- `.github`: collaboration templates and CI quality gates

Read [PRODUCT.md](PRODUCT.md) for the product direction and [AGENTS.md](AGENTS.md) before making engineering changes. Contribution requirements are in [CONTRIBUTING.md](CONTRIBUTING.md).

Mobile simulator setup, navigation conventions, testing, and troubleshooting are documented in [docs/mobile-development.md](docs/mobile-development.md).

## Current status

Phase 1: mobile application shell. The app exposes accessible, system-themed empty destinations for Today, Nutrition, Workout, Progress, and Profile. Fitness behavior remains deferred to a separately reviewed phase.
