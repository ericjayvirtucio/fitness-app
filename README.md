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
also provides bounded completed Workout History, snapshot detail, deterministic
Day/Week/Month progress summaries, per-exercise history, and deterministic
personal records for a performed exercise, each linked to the completed workout
that proves it. A recorded set inside a completed workout can be deliberately
corrected, added, or deleted, so one mistyped entry is no longer permanent; one
exercise that should never have been recorded can be removed from a completed
workout without losing the correct work beside it; one exercise that was
performed but never logged can be added to the completed workout it belongs to,
with the set it recorded, instead of inventing a second workout that never
happened; and one completed workout recorded entirely by mistake can be deleted
on its own instead of erasing everything. The Exercise Library ships empty and
offers, in one deliberate action, a set of twenty-six common exercise
definitions covering every logging mode, so the Workout area is usable
immediately without authoring anything first; what it adds is ordinary,
editable, deletable content the person owns, and nothing is ever written without
the person asking. The Profile area records historical body
weight check-ins that can also update the current profile weight in one
deliberate action. The Progress tab derives text-first Nutrition, Hydration,
completed-workout, and recorded body-weight summaries for Today, This Week, and
This Month. Profile groups its data controls in one place: export everything stored on the
device as one documented, versioned JSON file and hand it to the platform's own
share and save controls; restore such a file offline into an installation that
holds no information yet; replace everything stored on the device with a
validated export in one all-or-nothing operation; or deliberately delete
everything the app stores on the device.
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
pnpm test:changed  # Test only workspaces affected relative to main
pnpm typecheck     # Run strict TypeScript checks
```

`pnpm test` runs the non-simulator Jest and Vitest suites in the terminal. Test
workspaces and their test files run serially to limit memory use. User-interface and native-platform
behavior are verified on an available physical device with the
[manual testing guide](docs/manual-testing/README.md); no simulator automation
is required.

Use `pnpm test:changed` for quick feedback while developing on a branch. Run the
complete `pnpm test` command before considering a change verified.

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

Which third-party code, data, and media this product may use, which it may not, and what each obligation costs are recorded in [docs/third-party-material.md](docs/third-party-material.md). No third-party material ships today; the phase that imports any creates the notices its terms require in the same change.

Mobile simulator setup, navigation conventions, testing, and troubleshooting are documented in [docs/mobile-development.md](docs/mobile-development.md).
The design-system token boundary, the contrast contract that proves the palette,
the card-variant rule, and what may enter the system are documented in
[docs/architecture/design-system.md](docs/architecture/design-system.md).
The repository's risk-based device checks and evidence format are documented in
the [manual testing guide](docs/manual-testing/README.md).
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
The starter exercise content, why it is an explicit import rather than a seed,
and what that preserves in restore and erasure are documented in
[docs/architecture/starter-exercise-library.md](docs/architecture/starter-exercise-library.md).
Recurring-plan semantics, prescriptions, ordering, catalog references, and the
future Workout Session seam are documented in
[docs/architecture/offline-workout-planner.md](docs/architecture/offline-workout-planner.md).
Workout execution, snapshots, results, and recovery are documented in
[docs/architecture/offline-workout-sessions.md](docs/architecture/offline-workout-sessions.md).
Completed history, progress semantics, pagination, and performed recents are in
[docs/architecture/offline-workout-history.md](docs/architecture/offline-workout-history.md).
Personal-record categories, comparison semantics, tie behavior, evidence links,
and query strategy are documented in
[docs/architecture/workout-personal-records.md](docs/architecture/workout-personal-records.md).
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
Capability-owned erasure, deletion order, in-transaction verification, temporary
file cleanup, and the honest limits of what deletion guarantees are documented in
[docs/architecture/offline-local-data-erasure.md](docs/architecture/offline-local-data-erasure.md).
Validation before destruction, the atomic replacement transaction, the recovery
copy and its retention, verification, and the rollback guarantee are documented in
[docs/architecture/safe-replacement-restore.md](docs/architecture/safe-replacement-restore.md).
What migration 12 adds to every table a person owns, deletion versus
discard, the local-change outbox, device identity, and why they are invisible
to export, restore, and replacement are documented in
[docs/architecture/schema-synchronization-readiness.md](docs/architecture/schema-synchronization-readiness.md).

## Current status

Sprint 52: FoodData Central Coverage Evaluation Executed. The independent
evaluation approved in Sprint 51 was run against 385 samples per stratum
drawn from NHANES WWEIA (ordinary foods) and an Open Food Facts US snapshot
(branded names and exact barcodes). Ordinary-food discovery passed (98.96%),
but branded-name discovery (31.43%) and exact-barcode discovery (55.58%) both
failed their required 80% thresholds by a wide margin, and branded-name
ambiguity (14.03%) exceeded its 5% ceiling. **FoodData Central is not
approved.** Phase 5 stays Current and Phase 6 stays blocked; qualified Open
Food Facts legal review remains the named path to unblock the food-database
half. See [ADR
0038](docs/decisions/0038-fooddata-central-coverage-evaluation-fails.md) and
the [coverage evaluation](docs/fooddata-central-coverage-evaluation.md).
Sprint 51: Initial Nutrition Market and Representative Sampling Frame. The
United States (US) was approved as the initial nutrition-data launch market,
aligning directly with the pure domain nutrient model (FDA Nutrition Facts
vocabulary), American English terminology, and UPC-A barcode standards.
Independent sampling frames were approved: CDC/USDA NHANES WWEIA dietary recall
frequency data for ordinary foods, and an Open Food Facts US snapshot as an
unweighted retail assortment frame for branded product names and exact barcodes.
The Sprint 50 acceptance thresholds remain fixed. FoodData Central remains
unapproved pending execution of the external evaluation against these frames;
Phase 5 stays Current and Phase 6 stays blocked. See [ADR
0037](docs/decisions/0037-initial-nutrition-market-and-independent-sampling-frame.md)
and the [sampling frame evaluation](docs/nutrition-sampling-frame-evaluation.md).
Sprint 50: Nutrition Data Coverage Evaluation. FoodData Central's April 2026
bulk release was profiled under thresholds fixed before evaluation. Its internal
nutrition completeness is promising, but ordinary-food, branded-name, and exact-
barcode discovery could not be measured against an independent representative
sample, and the application has no named launch market. FoodData Central remains
unapproved; Phase 5 stays Current and Phase 6 stays blocked. See the [coverage
evaluation](docs/fooddata-central-coverage-evaluation.md) and [ADR
0036](docs/decisions/0036-fooddata-central-coverage-remains-unproven.md).
Sprint 49: Goal-Derived Macronutrient Targets. A person with a saved, currently
valid goal now sees a protein, carbohydrate, and fat target, each in whole
grams, beside their calculated daily calorie target on the Goals & Energy
screen — a fixed 20/50/30 split of that calorie target, computed entirely
on-device with no food data, provider, schema change, or network call. This
is the first half of Phase 5 (Nutrition Depth); a real food database behind
the existing catalog, with barcode entry, remains unapproved.
Sprint 47: Optional Reps in Reserve. On any repetition-based recorded set,
a person can optionally record their own estimate — 0 through 10 — of how
many more repetitions they believed they could have performed. It is never
required, an omitted estimate stays absent rather than becoming zero, and it
travels with the set through correction, export (now format version 2),
restore, and safe replacement. This completes Phase 4 (Training Depth): a
session's effort is now something a person can observe, not just a bare log
of mechanical results. Sprint 46: Foreground Rest Timing. During an active
Workout Session, a person can start an optional, dismissible rest countdown
— 60, 90, 120, or 180 seconds — after a set saves successfully. It runs
entirely in the foreground, states remaining time plainly, announces
completion once, and holds no persisted state, notification, alarm, or
background timer; losing it by leaving the screen or closing the app never
affects a recorded set. Sprint 44:
Deliberate Exercise Pack Restoration. The Exercise Library now offers two
curated packs a person can add in deliberate, independent actions —
twenty-six starter definitions and a further hundred eighty-nine from an
openly licensed dataset, two hundred fifteen in total — and a definition
deleted from either pack can be explicitly restored in place by requesting
that pack again, with every edit made before the deletion preserved and its
synchronization revision advanced rather than reset. Sprint 42 (Schema
Synchronization Readiness) gave every table a person owns an update time, a
deletion tombstone, a revision, and the device that created the row, plus a
durable `sync_outbox` recording local changes not yet sent anywhere; no
synchronization is built and nothing leaves the device. Authentication, an
API endpoint, conflict resolution, background sync, and account services
remain entirely out of scope.

See [docs/product-roadmap.md](docs/product-roadmap.md) for phase status,
dependencies, and the product's direction toward its end goal.
