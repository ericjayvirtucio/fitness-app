# Mobile development

## Setup

Install the pinned workspace dependencies from the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
```

No environment file, account, API, or network connection is required after dependencies are installed. The mobile app creates its SQLite database on-device during startup. The identifiers `com.fitnessapp.dev` are temporary development placeholders.

## Start the application

Start Metro from the repository root:

```bash
pnpm --filter @fitness/mobile start
```

Press `i` in the Expo terminal to open the iOS Simulator or run:

```bash
pnpm --filter @fitness/mobile start -- --ios
```

Xcode and its command-line tools must be installed and an iOS simulator runtime must be available. The repository does not commit a generated `ios` project.

For Android, install Android Studio, an Android SDK, and an emulator, start the emulator, then press `a` in the Expo terminal or run:

```bash
pnpm --filter @fitness/mobile start -- --android
```

The repository does not commit a generated `android` project.

## Navigation

Expo Router reads routes from `apps/mobile/app`. The `(tabs)` route group owns Today, Nutrition, Workout, Progress, and Profile. `index.tsx` is Today and is the initial destination. The root `_layout.tsx` owns stack composition, navigation theme, status bar, and route-level error recovery.

To add a future nested screen, add a route beneath the relevant feature route or convert that route to a directory with its own `_layout.tsx`. Add root-level modal routes to the root stack and declare their presentation there. Keep route files focused on composition; reusable UI and behavior belong under the related `src` feature.

To add or intentionally change a primary tab, update both the route file and `src/navigation/tab-destinations.ts`, then update its behavior tests. Five tabs are already the intended maximum for this shell, so an additional product area requires navigation review.

## Design system and appearance

The public design-system boundary is `src/design-system/index.ts`. Mobile routes
and features import components and tokens from `src/design-system`, not its
internal files. Semantic colors live in `theme/colors.ts`; typography, spacing,
radius, opacity, border, icon, motion, and touch-target values live in
`theme/tokens.ts`; platform elevation intent lives in `theme/elevation.ts`.
Components consume the active theme instead of repeating visual values.

The application follows the device light or dark setting. There is no stored manual override. Verify both appearances in the simulator and check that larger accessibility text remains readable.

Usage, accessibility guidance, and extension rules are documented in the
[mobile design-system guide](../apps/mobile/src/design-system/README.md).

## Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @fitness/mobile exec expo install --check
```

## Native end-to-end QA

Maestro CLI 2.7.0 drives the installed `com.fitnessapp.dev` application on an
iOS Simulator or Android Emulator. Diagnose the local environment and run a
suite from the repository root:

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

An explicit iOS command is self-preparing: it reuses one booted simulator or boots
the first available iPhone Simulator, opens Simulator, waits for boot, and
incrementally builds and installs a Release app. The Release bundle does not need
Metro. The first run can take several minutes; later Xcode builds reuse caches.

Android and commands without an explicit platform retain the pre-provisioned
target contract. Build/install their application first and keep Metro running when
the installed debug build requires it. Generated `ios` and `android` projects
remain ignored.

Every suite clears the selected application's sandbox, including
`fitness-app.db`, before it begins. Use a disposable target; the wrapper does not
back up development data. It never erases the whole simulator or emulator.

Read the [mobile E2E guide](../e2e/mobile/README.md) for setup, suite structure,
selectors, artifacts, and troubleshooting. Complete the
[Sprint 14 harness checklist](manual-testing/sprint-14-mobile-e2e-harness.md)
before claiming native QA is complete.

## Local persistence

The root layout waits for the local database to initialize and migrate before it
renders routes. Migration and transaction conventions are documented in the
[local persistence architecture](architecture/local-persistence.md). A startup
failure displays a safe retry screen and does not clear local data.

## Personal profile

The Profile tab reads and saves one device-local profile through application use
cases. Domain rules and storage mappings are documented in
[personal-profile architecture](architecture/personal-profile.md). Metric fields
use centimeters and kilograms; imperial fields use inches and pounds. Date of
birth uses `YYYY-MM-DD`. Decimal parsing is not localized in this sprint.

Uninstalling the app from a disposable development environment removes the profile
with the app database. The application itself provides no delete or reset action.

## Offline nutrition logging

The Nutrition tab lists entry-owned food and caloric beverage snapshots for a
captured local calendar day. Create and edit screens accept only grams or
milliliters, `YYYY-MM-DD`, and 24-hour `HH:MM`. Blank optional nutrients remain
unknown; zero must be entered only when known. See
[offline nutrition logging architecture](architecture/offline-nutrition-logging.md),
the [manual QA checklist](manual-testing/sprint-8-offline-nutrition-logging.md),
and [troubleshooting guidance](troubleshooting/offline-nutrition-logging.md).

## Offline hydration tracking

The Today tab lists plain-water and explicit other-fluid volumes for a captured
local calendar day. Entry routes accept exact presets or custom milliliters plus
`YYYY-MM-DD` and 24-hour `HH:MM`. The optional target is user-defined in mL or L;
progress appears only for today because target history is not versioned. See
[offline Hydration architecture](architecture/offline-hydration-tracking.md), the
[manual QA checklist](manual-testing/sprint-10-offline-hydration-tracking.md), and
[troubleshooting guidance](troubleshooting/offline-hydration-tracking.md).

## Offline workout planning

The Workout tab shows one recurring Sunday-to-Saturday plan and an Exercise
Library entry. Workout editor routes store future intent only and present fields
according to each definition's logging mode. Catalog deletion and logging-mode
changes are blocked while referenced. See
[Workout Planner architecture](architecture/offline-workout-planner.md), the
[manual QA checklist](manual-testing/sprint-12-offline-workout-planner.md), and
[troubleshooting guidance](troubleshooting/offline-workout-planner.md).

## Offline workout history

Workout History reads completed session snapshots and provides read-only detail,
captured-local-date Day/Week/Month summaries, bounded pagination, and genuinely
performed exercise recents. It never derives performance from Planner targets or
current Catalog definitions. See
[Workout History architecture](architecture/offline-workout-history.md), the
[Sprint 15 manual checklist](manual-testing/sprint-15-workout-history.md), and
[troubleshooting guidance](troubleshooting/offline-workout-history.md).

## Offline Progress analytics

The Progress tab combines bounded, capability-owned Nutrition, Hydration, and
completed-workout readers. It derives Today, Sunday-to-Saturday week, and calendar
month summaries from captured local dates without persisted rollups. See the
[offline Progress architecture](architecture/offline-progress-analytics.md), the
[Sprint 16 manual checklist](manual-testing/sprint-16-progress-analytics.md), and
the [Progress troubleshooting guide](troubleshooting/offline-progress-analytics.md).

## Offline data export

The Profile tab can create one versioned JSON file describing everything the
app stores on the device. Generation runs entirely offline inside a single
exclusive SQLite read transaction, using bounded capability-owned readers, and
is a separate step from the platform share and save controls. The app keeps at
most one export in its cache directory and removes it when the export screen
opens, before the next export, and on discard. The file is not encrypted. See
[offline data export architecture](architecture/offline-data-export.md), the
[Sprint 18 manual checklist](manual-testing/sprint-18-offline-data-export.md),
and [troubleshooting guidance](troubleshooting/offline-data-export.md).

Adding `expo-sharing` introduced a native module, so the first `expo run:ios`
or explicit iOS QA run after pulling this change regenerates the native project
and reinstalls pods.

## Offline data restore

The Profile tab can also read a saved `formatVersion` 1 export back in, and the
entry point appears in the profile empty state as well as below the form,
because a new device starts with nothing. A selected file is untrusted input: it
is validated completely — format, version, sections, keys, primitives,
enumerations, bounds, identifiers, duplicates, occurrence context, domain
invariants, and references between records — before the write transaction opens.

Restoring is supported only into an installation that holds no user-owned
records. Emptiness is answered by a `StoredDataProbe` per capability, checked
when the screen opens and again inside the write transaction. Writing reuses
each capability's existing repository methods in one exclusive transaction and
is all-or-nothing.

No dependency was added: `expo-file-system` already provides the system file
picker on SDK 57. No migration was added either; the migration version stays 11.
The document picker is platform-owned, so no Maestro flow selects a file and a
complete successful restore is verified by hand. See
[offline data restore architecture](architecture/offline-data-restore.md), the
[Sprint 19 manual checklist](manual-testing/sprint-19-offline-data-restore.md),
and [troubleshooting guidance](troubleshooting/offline-data-restore.md).

## Troubleshooting

### Expo or Metro does not start

Confirm `node --version` is 24 or later and `pnpm --version` is 11 or later. Run `pnpm install --frozen-lockfile`, then start the filtered mobile workspace. If Metro has stale cached module information, stop it and run:

```bash
pnpm --filter @fitness/mobile start -- --clear
```

### A port is already in use

Stop the older Metro process or accept Expo's prompt to use another port. Avoid terminating unrelated processes until you have identified them.

### Workspace packages do not resolve

Run commands from the repository root and use the pinned pnpm version. Do not run npm install inside `apps/mobile`. If the pnpm store location changed, inspect `pnpm store path` before reinstalling so the existing workspace links and selected store agree.

### The iOS Simulator does not open

Open Xcode once to accept its license and install an iOS Simulator runtime. Verify
the active command-line tools with `xcode-select -p`, then rerun an explicit iOS
QA command. The wrapper opens Simulator automatically. If several simulators are
already booted, pass `--device <udid>`. On a non-macOS host, defer iOS verification
to macOS.

### Android does not open

Start an emulator from Android Studio first. Confirm the Android SDK and platform tools are configured and that `adb devices` lists the emulator before retrying.

### A route is missing or duplicated

Check the filenames beneath `apps/mobile/app`, confirm every declared tab has a matching route, and restart Metro with `--clear` after renaming route files. Route groups in parentheses do not appear in the URL.

### Installation fails

Confirm registry access and the pinned Node/pnpm versions. Do not bypass peer-dependency or engine errors. Expo-managed packages should be checked with `expo install --check`; investigate mismatches before updating the lockfile.

### Local storage does not initialize

Use the in-app retry once. If it fails again, inspect the underlying development
error without logging database contents, SQL values, or identifiers. Confirm the
installed app is not older than the database schema. Do not clear app data unless
the environment is disposable and losing its development records is intentional.
