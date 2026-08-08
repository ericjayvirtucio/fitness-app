# Sprint 14 manual QA: Cross-platform mobile E2E harness

Record date, commit, Maestro version, platform, simulator/emulator model, OS,
application build, result, and artifact path. A failed or unavailable target must
be recorded honestly and cannot be marked passed.

## Prerequisite diagnostics

- [ ] Run `./scripts/qa.sh doctor` with no Maestro or device available. Expect a
      read-only report that identifies each missing prerequisite.
- [ ] Install Maestro 2.7.0 and run `doctor` again. Expect its version without
      application, device, or filesystem mutation.
- [ ] Boot one platform target. Expect automatic selection for a normal command.
- [ ] Boot multiple targets. Expect refusal until `--platform` and, where needed,
      `--device` disambiguate the target.
- [ ] Select a target without `com.fitnessapp.dev`. Expect a non-zero, actionable
      app-not-installed message.
- [ ] Request Sprint 5, Sprint 7, Sprint 14, an invalid platform, and an unknown
      option. Expect non-zero validation errors without launching Maestro.

## Destructive scope and state

- [ ] Put disposable data in `com.fitnessapp.dev`, run smoke, and confirm the
      selected app's data is cleared before the flow.
- [ ] Confirm another application and unrelated simulator/emulator settings are
      unchanged. The wrapper must never erase the whole virtual device.
- [ ] Complete a persistence flow and inspect its relaunch. Expect confirmed data
      to survive `stopApp`/`launchApp` inside that flow.
- [ ] Run the same suite twice. Expect the second run not to depend on the first.

## CLI and artifacts

- [ ] Run smoke with implicit device selection and explicit iOS/Android selection.
      Expect the printed suite, platform, device, app ID, state warning, and
      artifact path to match the run.
- [ ] Inspect `artifacts/qa`. Expect a UTC/platform/suite directory with CLI log,
      JUnit report, Maestro diagnostics, failure screenshots where applicable,
      and no sensitive data.
- [ ] Temporarily break a disposable flow assertion. Expect raw Maestro output,
      failure artifacts, and the unchanged non-zero Maestro exit status.
- [ ] Restore the assertion and rerun. Expect status zero without an automatic
      retry having hidden the prior failure.
- [ ] Stop Metro for a debug build. Expect a clear application/framework failure,
      not a false pass. Restart Metro and confirm recovery.

## Native platform execution

- [ ] Run `./scripts/qa.sh smoke --platform ios` on an iOS Simulator.
- [ ] Run `./scripts/qa.sh smoke --platform android` on an Android Emulator.
- [ ] Run each Sprint 6 and 8–13 suite on both available platforms.
- [ ] Run regression on both available platforms.
- [ ] Confirm Router navigation, native alerts, keyboard entry, scrolling, SQLite
      initialization, mutations, and process-restart reconstruction behave as
      asserted on each platform.
- [ ] Inspect any platform selector difference. Fix semantics or add the smallest
      justified override; do not copy a complete suite.

## Accessibility and retained manual coverage

- [ ] Use VoiceOver on iOS and TalkBack on Android for representative Profile,
      Hydration, Nutrition, Workout, form, and alert interactions. Names, roles,
      state, focus, and outcomes must remain understandable.
- [ ] Repeat representative flows with large Dynamic Type, dark appearance, and a
      hardware keyboard. Check reflow, contrast, focus order, visibility, and
      operability rather than relying on Maestro results.
- [ ] Confirm the existing Sprint 6 and 8–13 manual checklists remain applicable
      for airplane mode, time zones, background/lock, historical upgrades,
      injected storage failures, real devices, and exploratory visual review.

Do not recommend merge until automated repository checks pass and the repository
owner confirms every available native target in this checklist.
