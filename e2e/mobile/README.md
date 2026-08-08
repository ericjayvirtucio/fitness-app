# Mobile end-to-end QA

This directory owns Maestro flows for the installed native application. The
stable entry point is `scripts/qa.sh`; do not make developers depend on direct
Maestro paths or encode product assertions in the shell wrapper.

## Supported environment

- Maestro CLI 2.7.0
- app identifier `com.fitnessapp.dev`
- an iOS Simulator with Xcode command-line tools, or
- an Android Emulator with `adb` on `PATH`

Use a repository-built application rather than Expo Go. Generated `ios` and
`android` projects remain ignored. Build and install the application with Expo's
local native commands, and keep Metro running when the selected debug build
requires it.

Install Maestro using its official installation guidance, then confirm the
expected version:

```bash
maestro --version
./scripts/qa.sh doctor
```

Do not silently update the documented version. Review release notes, execute the
smoke suite on both platforms, and update this guide in the same change.

## Commands

```bash
./scripts/qa.sh reset
./scripts/qa.sh smoke
./scripts/qa.sh sprint 13
./scripts/qa.sh regression
./scripts/qa.sh sprint 13 --platform ios
./scripts/qa.sh sprint 13 --platform android
./scripts/qa.sh smoke --platform ios --device <simulator-udid>
```

Without `--platform`, exactly one platform must have an active virtual device.
Without `--device`, exactly one virtual device may be active on that platform.
The wrapper refuses ambiguous selection and never creates or erases a device.

Every suite currently starts with `clearState: true`. Running it permanently
removes the data stored by `com.fitnessapp.dev` on that selected simulator or
emulator. This is app-local deletion, not a whole-device erase. Use a disposable
QA target and never point the harness at development data you need to retain.

Use `./scripts/qa.sh reset` when a fresh app sandbox is needed without executing
product assertions. Reset launches the app with cleared state and then stops it,
leaving the application installed and the simulator or emulator otherwise
unchanged. Normal smoke, sprint, and regression suites already perform this reset
at startup, so running it separately before every suite is unnecessary.

## Structure and ownership

- `suites` contains thin, independently runnable entry flows.
- `flows` contains reusable product-capability workflows.
- Shared flows contain only cross-feature mechanics.
- A platform-specific flow is justified only by observed native behavior.

Sprint suites exist for the repository's manual QA sources: Sprints 6 and 8–13.
Sprints 5 and 7 deliberately return an unsupported-suite error because no manual
QA specification exists for them.

Use synthetic names prefixed with `E2E`. Create state through public controls;
do not add database fixtures, deep-link seeders, network services, or production
reset routes. A reusable flow must not clear application state. Persistence
checks use `stopApp` followed by `launchApp` without clearing state.

Selectors prefer visible user outcomes and accessibility semantics. Use stable
`testID` selectors when repeated, dynamic, or platform-dependent structure would
otherwise be brittle. Identifier policy is documented in the mobile design
system guide.

## Adding coverage

1. Start from an approved manual QA source or defect regression.
2. Add or extend the smallest cohesive feature flow.
3. Compose it from the relevant suite instead of copying its steps.
4. Make the suite independently runnable from clean state.
5. Avoid arbitrary waits and retries; use Maestro's visibility polling.
6. Run Prettier, the focused suite on both available platforms, and the manual
   harness checklist.
7. Update the suite map and manual/automated boundary when it changes.

The default local retry count is zero. A failure is evidence, not a prompt for a
hidden rerun.

## Results and troubleshooting

Each run writes the CLI log, JUnit report, screenshots, view hierarchy, and
Maestro debug output beneath:

```text
artifacts/qa/<UTC timestamp>/<platform>/<suite>/
```

The directory is ignored by Git. Evidence must contain only synthetic data and
must not include database dumps, personal identifiers, or real fitness values.

If no device is detected, boot one and confirm `xcrun simctl list devices booted`
or `adb devices`. If the app is absent, build and install it before rerunning.
If a selector differs by platform, inspect the Maestro hierarchy and first fix
missing accessibility semantics. Add a narrow platform override only when the
underlying native behavior is genuinely different.

Maestro does not replace VoiceOver, TalkBack, hardware-keyboard, Dynamic Type,
appearance, real-device, time-zone, upgrade, interruption, or injected-failure
testing. Complete the manual checklist before claiming merge readiness.
