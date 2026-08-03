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

Open Xcode once to accept its license and install components. Verify the active command-line tools with `xcode-select -p`, open Simulator manually, and retry the Expo command. On a non-macOS host, use a physical device or defer iOS verification to macOS.

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
