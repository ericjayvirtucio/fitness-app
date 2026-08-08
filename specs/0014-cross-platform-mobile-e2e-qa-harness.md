# Specification 0014: Cross-platform mobile E2E QA harness

- Status: Approved
- Date: 2026-08-08

## Objective and scope

Add a repository-owned Maestro harness that executes critical native mobile user
workflows on an iOS Simulator or Android Emulator. The stable interface supports
smoke, numbered sprint, and regression suites, including explicit platform and
device selection where necessary.

The first backfill covers the manual QA sources that exist for Sprints 6 and
8–13. Sprint 5 and Sprint 7 are not accepted suite identifiers because the
repository has no corresponding manual QA specifications.

## Command-line contract

`scripts/qa.sh` accepts `smoke`, `regression`, and `sprint <number>`, plus an
optional `--platform ios|android` and `--device <identifier>`. A `doctor` command
reports prerequisites without modifying a device.

The wrapper validates its arguments, Maestro, platform tools, a single selected
virtual device, the installed `com.fitnessapp.dev` application, and suite files.
It prints the resolved run context, streams Maestro diagnostics, preserves
Maestro's status, and exits non-zero for invalid configuration or failed QA. It
does not install tools, create devices, erase an entire device, or encode product
assertions.

When `--platform ios` is explicit, the wrapper self-prepares the local native
target. It reuses the single booted iOS Simulator or deterministically selects
and boots the first available iPhone Simulator reported by `simctl`, opens the
Simulator application, waits for boot completion, and incrementally builds and
installs the current application with Expo's Release configuration. The embedded
Release bundle avoids a Metro prerequisite. Automatic preparation never applies
when platform selection is implicit and does not yet apply to Android.

## Flows and suites

Feature flows describe cohesive public workflows and reusable setup. Suite entry
flows compose those capabilities for smoke, Sprint 6 and 8–13, and regression
coverage. The same flows run on both platforms unless an observed native
difference requires a narrowly scoped override.

Smoke covers fresh startup, primary navigation, one offline mutation, Workout
startup, and safe cleanup. Regression covers Profile and Goals, Hydration,
Nutrition diary and catalog reuse, Exercise Catalog, Workout Planner, and Workout
Session lifecycle and restart recovery. Sprint suites automate their critical
happy path, validation, persistence, destructive confirmation, and directly
adjacent regressions without copying every manual checklist row.

## State, persistence, and determinism

Independent suite entry flows clear the target application's state and relaunch
it. Reusable flows never clear state. Tests create synthetic state through the UI
and do not add SQL injection, network, deep-link seeding, or production reset
surfaces. Persistence tests stop and relaunch the application without clearing
state before asserting reconstructed UI behavior.

Selectors prefer stable `testID` values for controls whose text is duplicated,
dynamic, or structurally brittle. Visible text and accessibility semantics remain
the preferred assertions for user-observable results. Identifiers use product
language, contain no user-entered or sensitive values, and do not depend on list
positions.

Runs do not automatically retry or use arbitrary sleeps. Maestro's built-in
waiting handles normal rendering latency; explicit extended waits are reserved
for documented startup boundaries.

## Build, devices, and artifacts

The target is the repository-built application with the existing iOS bundle and
Android package identifier `com.fitnessapp.dev`. Expo-generated `ios` and
`android` directories remain ignored. Explicit iOS runs build and install a
Release app automatically. Android remains pre-provisioned, and manually installed
debug builds may require Metro.

Local execution is serial. The wrapper uses one explicitly selected or
unambiguous booted simulator/emulator. Explicit iOS execution may select the
documented default when none is booted; a supplied device identifier remains
authoritative. Implicit platform selection continues to refuse ambiguity.
Physical devices and web are excluded.

After execution, the wrapper reports suite, preparation result, device, elapsed
time, Maestro status, JUnit pass/fail/error/skip counts when available, and the
artifact path. Build/setup failures are distinguished from product assertion
failures. The simulator remains booted for inspection.

Maestro diagnostics, reports, screenshots, and view-hierarchy evidence belong
beneath `artifacts/qa`, which is ignored by Git. Artifacts use only synthetic test
data and must not expose database contents or sensitive fitness information.

## Accessibility and manual QA boundary

Maestro exercises the native accessibility tree and therefore catches missing or
ambiguous automation semantics. It does not replace judgment-based VoiceOver,
TalkBack, hardware-keyboard, Dynamic Type, light/dark appearance, focus-order, or
visual-quality verification.

Airplane-mode behavior, real devices, background and lock interruptions,
time-zone changes, historical-schema upgrades, injected storage failures, and
exploratory UX review also remain manual.

## Security, privacy, and failure behavior

The harness adds no runtime service, permission, telemetry, account, secret, or
network dependency. Test fixtures are synthetic. Clean-state suites remove only
the selected development application's sandbox and warn before execution. The
application continues to own input validation and database authority.

Missing tools, unavailable devices, missing suites, absent applications, and
failed assertions produce concise actionable diagnostics and non-zero status.
Raw framework output is not hidden.

## Testing and documentation

Shell behavior receives deterministic automated coverage where repository tools
can exercise it without a real device. Identifier forwarding and changed
presentation behavior retain component regression coverage. Maestro files receive
static parsing and repository-structure validation, followed by smoke execution
on every locally available platform.

Update the root and mobile development documentation, contribution workflow,
design-system identifier policy, and a manual harness-verification checklist.
Existing format, lint, type-check, unit/integration, build, and Expo dependency
checks must remain green.

## Explicit exclusions

Web E2E, physical-device automation, CI workflow creation, cloud accounts,
multiple E2E frameworks, pixel-diff visual regression, automatic tool or simulator
runtime installation, committed native projects, privileged fixture APIs, historical
database fixtures, and exhaustive automation of every manual QA row are excluded.

The repository owner approved the Stage 1 design and requested staged,
commit-by-commit implementation on 2026-08-08.

The repository owner approved explicit-iOS self-preparation and one-command
execution as an amendment on 2026-08-08. Android and web preparation remain
deferred to their own reviewed platform policies.
