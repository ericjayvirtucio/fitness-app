# ADR 0009: Maestro mobile end-to-end harness

- Status: Superseded by ADR 0033
- Date: 2026-08-08

## Context

The mobile application has deterministic domain, persistence, and component
tests, but its release checks still rely on repeated manual verification of real
Expo Router navigation, native SQLite behavior, process-restart recovery, and
cross-feature workflows on iOS and Android.

The repository needs one readable, command-line-driven mobile E2E system that
works with Expo-managed native projects, keeps generated native projects out of
source control, and can later run in CI. The application uses Expo 57, React
Native 0.86 with the New Architecture, Expo Router, and Expo SQLite.

## Decision

Use Maestro as the sole mobile E2E framework. Keep YAML flows under
`e2e/mobile`, expose them through `scripts/qa.sh`, and run them against the
repository-built `com.fitnessapp.dev` application on an iOS Simulator or Android
Emulator.

Create test state through public user workflows. Independent suites clear only
the target application's sandbox before launch; persistence checks terminate and
relaunch without clearing state. Share feature flows across platforms and add a
small platform-specific flow only when native behavior genuinely differs.

Use accessible names and visible outcomes where they express user behavior. Add
stable, privacy-safe `testID` values only for ambiguous, repeated, dynamic, or
otherwise brittle controls. The shell wrapper owns prerequisite, suite, platform,
device, and installed-app validation, but contains no business assertions.

Local runs have no automatic retries. Maestro's exit status remains authoritative,
and failure artifacts are written beneath the ignored `artifacts/qa` directory.

Explicit iOS runs self-prepare their target. They reuse one booted simulator or
select and boot the first available iPhone Simulator reported by `simctl`, open
Simulator for observation, wait for boot, and use Expo to incrementally build and
install a Release application bundle. Release avoids making Metro another runtime
prerequisite. Implicit platform selection retains its ambiguity checks, and Android
remains pre-provisioned until a separate platform policy is approved.

The wrapper prints a final result summary with setup versus assertion failure,
duration, device, JUnit counts when produced, and artifact location. It leaves the
simulator booted so failures can be inspected.

## Consequences

The harness remains decoupled from React Native internals and requires no test
instrumentation or committed `ios` and `android` projects. Explicit iOS runs trade
additional first-run build time for a single reproducible command. Product and QA readers
can review concise YAML flows, and Expo/EAS integration remains available later.

UI-created setup is slower than database fixtures, accessibility trees may have
minor platform differences, and a debug build may require Metro. Clearing the
existing development application identifier also clears its local development
data, so every destructive run must say so explicitly.

Upgrade tests from historical SQLite schemas, real-device testing, screen-reader
quality, keyboard usability, visual quality, time-zone transitions, and injected
storage failures remain manual.

## Alternatives considered

Detox was rejected because its Expo integration is community-driven, it adds
native instrumentation and build configuration, and its documented React Native
New Architecture compatibility does not yet cover this repository's React Native
version. Appium adds disproportionate server and driver maintenance. Expo Go is
useful for exploration but has weaker app-launch and sandbox-isolation behavior
than a repository-built application. Direct database fixtures and production
reset routes were rejected because they introduce privileged test seams before a
demonstrated need.
