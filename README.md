# Fitness App

Production-oriented foundation for an offline-first fitness platform targeting iOS, Android, and a supporting API.

The current foundation includes an accessible Expo Router shell, an app-local
semantic design system, a pure shared domain language, versioned mobile SQLite
infrastructure, a device-local personal profile, profile-derived Goals & Energy
calculations, canonical Nutrition rules, and offline food and caloric beverage
logging with daily totals, plus a reusable device-local Nutrition catalog with
search, favorites, recents, and quantity-only re-entry. It also includes
dedicated offline water and other-fluid logging with a manual daily fluid target
and stable local-day history. The Workout area includes an offline Exercise
Library, recurring Sunday-to-Saturday Planner, and durable planned or empty
Workout Sessions with individual actual-set logging and restart recovery. It
also provides bounded completed Workout History, read-only snapshot detail,
deterministic Day/Week/Month progress summaries, per-exercise history foundations,
and performed-exercise recents. The Profile area records historical body
weight check-ins that can also update the current profile weight in one
deliberate action. The Progress tab derives text-first Nutrition, Hydration,
completed-workout, and recorded body-weight summaries for Today, This Week, and
This Month. Profile can also export everything stored on the device as one
documented, versioned JSON file and hand it to the platform's own share and
save controls, and can restore such a file offline into an installation that
holds no information yet.
It intentionally contains no authentication, synchronization, cloud analytics,
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

Native mobile E2E QA uses the repository-owned Maestro wrapper:

```bash
./scripts/qa.sh doctor
./scripts/qa.sh reset --platform ios
./scripts/qa.sh smoke --platform ios
./scripts/qa.sh sprint 13 --platform android
./scripts/qa.sh sprint 15 --platform ios
./scripts/qa.sh sprint 16 --platform ios
./scripts/qa.sh sprint 17 --platform ios
./scripts/qa.sh sprint 18 --platform ios
./scripts/qa.sh regression
```

These suites clear `com.fitnessapp.dev` data on the selected virtual device.
Explicit iOS runs boot an available iPhone Simulator and build/install the current
Release app automatically. Android and implicit-platform runs still require a
prepared target. Use a disposable simulator or emulator and read the
[mobile E2E guide](e2e/mobile/README.md) before running them.

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
Native E2E suite ownership, state behavior, and artifacts are documented in the
[mobile E2E guide](e2e/mobile/README.md).
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
Offline Hydration ownership, target behavior, history, aggregation, and Nutrition
separation are documented in
[docs/architecture/offline-hydration-tracking.md](docs/architecture/offline-hydration-tracking.md).
Exercise-definition ownership, logging modes, catalog lifecycle, persistence, and
future Planner/Session reference rules are documented in
[docs/architecture/offline-exercise-catalog.md](docs/architecture/offline-exercise-catalog.md).
Recurring-plan semantics, prescriptions, ordering, catalog references, and the
future Workout Session seam are documented in
[docs/architecture/offline-workout-planner.md](docs/architecture/offline-workout-planner.md).
Workout execution, snapshots, results, and recovery are documented in
[docs/architecture/offline-workout-sessions.md](docs/architecture/offline-workout-sessions.md).
Completed history, progress semantics, pagination, and performed recents are in
[docs/architecture/offline-workout-history.md](docs/architecture/offline-workout-history.md).
Cross-capability period summaries, missing-data semantics, and Progress ownership
are documented in
[docs/architecture/offline-progress-analytics.md](docs/architecture/offline-progress-analytics.md).
Historical body weight, current-weight authority, and the Profile relationship
are documented in
[docs/architecture/body-measurement-history.md](docs/architecture/body-measurement-history.md).
The export contract, canonical units, timestamp semantics, file handling, and
known limitations are documented in
[docs/architecture/offline-data-export.md](docs/architecture/offline-data-export.md).
The restore trust boundary, validation layers, empty-installation policy,
transaction behavior, and native-picker boundary are documented in
[docs/architecture/offline-data-restore.md](docs/architecture/offline-data-restore.md).

## Current status

Sprint 19: Offline Data Restore. Profile can read a saved version 1
`fitness-app-data-export` file back into an installation that holds no
information yet, entirely offline. The selected file is untrusted input: format,
version, sections, keys, primitives, enumerations, bounds, identifiers,
duplicates, occurrence context, domain invariants, and references between
records are all validated before anything is written. Exported identifiers,
canonical units, and captured local-day semantics are preserved exactly,
historical snapshots stay historical, and derived figures such as BMI and energy
targets are recomputed rather than imported. Restoring runs in one exclusive
transaction and is all-or-nothing. The application refuses to restore over
existing information; merging, replacing, encrypted archives, scheduled restore,
and cloud recovery remain out of scope.
