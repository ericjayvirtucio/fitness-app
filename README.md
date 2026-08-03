# Fitness App

Production-oriented foundation for an offline-first fitness platform targeting iOS, Android, and a supporting API.

The current foundation includes an accessible Expo Router shell, an app-local
semantic design system, a pure shared domain language, versioned mobile SQLite
infrastructure, a device-local personal profile, profile-derived Goals & Energy
calculations, canonical Nutrition rules, and offline food and caloric beverage
logging with daily totals, plus a reusable device-local Nutrition catalog with
search, favorites, recents, and quantity-only re-entry. It
intentionally contains no authentication, synchronization, analytics,
notifications, or AI integration.

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
- `packages/domain`: pure, framework-independent domain values and invariants
- `packages/typescript-config`: shared strict compiler policies
- `docs`: architecture and durable engineering decisions
- `specs`: rules for future approved specifications
- `infrastructure`: admission rules for future operational configuration
- `.github`: collaboration templates and CI quality gates

Read [PRODUCT.md](PRODUCT.md) for the product direction and [AGENTS.md](AGENTS.md) before making engineering changes. Contribution requirements are in [CONTRIBUTING.md](CONTRIBUTING.md).

Mobile simulator setup, navigation conventions, testing, and troubleshooting are documented in [docs/mobile-development.md](docs/mobile-development.md).
Domain boundaries, value-object conventions, and extension guidance are documented
in [docs/architecture/domain-foundation.md](docs/architecture/domain-foundation.md).
Local database initialization, migrations, transactions, and troubleshooting are
documented in
[docs/architecture/local-persistence.md](docs/architecture/local-persistence.md).
Goals, formula evidence, eligibility, precision, and derived-data behavior are
documented in
[docs/architecture/goals-and-energy.md](docs/architecture/goals-and-energy.md).
Offline Nutrition diary boundaries, snapshots, time behavior, and aggregation are
documented in
[docs/architecture/offline-nutrition-logging.md](docs/architecture/offline-nutrition-logging.md).
Reusable profile identity, search, transaction, and snapshot behavior are in
[docs/architecture/reusable-nutrition-catalog.md](docs/architecture/reusable-nutrition-catalog.md).

## Current status

Sprint 9: Reusable Nutrition Catalog & Fast Re-entry. Users can maintain and
search local food and beverage profiles, favorite them, see usage-based recents,
and create immutable diary snapshots by entering only grams or milliliters.
Schema version 5 keeps catalog templates independent from historical entries.
Cloud, external API, household-quantity, hydration, analytics, and AI behavior
remain deferred.
