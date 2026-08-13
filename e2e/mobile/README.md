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
`android` projects remain ignored. Explicit iOS execution builds and installs the
current Release app automatically and does not require Metro. Android and implicit
platform execution still require a prepared installed app; debug builds may need
Metro.

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
./scripts/qa.sh sprint 15 --platform ios
./scripts/qa.sh sprint 16 --platform ios
./scripts/qa.sh sprint 17 --platform ios
./scripts/qa.sh sprint 18 --platform ios
./scripts/qa.sh sprint 19 --platform ios
./scripts/qa.sh sprint 20 --platform ios
./scripts/qa.sh sprint 21 --platform ios
./scripts/qa.sh sprint 22 --platform ios
./scripts/qa.sh smoke --platform ios --device <simulator-udid>
```

Without `--platform`, exactly one platform must have an active virtual device and
the app must already be installed. The wrapper refuses ambiguous implicit
selection.

With explicit `--platform ios`, the wrapper reuses one booted simulator or selects
the first available iPhone Simulator in `simctl` order, boots it, opens Simulator,
waits for boot, and incrementally builds/installs the current Release app. Pass
`--device <simulator-udid>` to choose a different available iPhone or resolve
multiple booted devices. The wrapper never creates, erases, or installs a simulator
runtime and leaves the simulator booted for inspection.

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

- `suites` contains thin entry flows. Scenario-reporting suites use a directory
  of independently runnable top-level flows so JUnit owns one testcase per
  human-readable scenario.
- `flows` contains reusable product-capability workflows.
- Shared flows contain only cross-feature mechanics.
- A platform-specific flow is justified only by observed native behavior.

Sprint suites exist for the repository's manual QA sources: Sprints 6, 8–13,
and 15–21. Sprints 5, 7, and 14 deliberately return an unsupported-suite
error because no product manual QA specification exists for them.

Use synthetic names prefixed with `E2E`. Create state through public controls;
do not add database fixtures, deep-link seeders, network services, or production
reset routes. A reusable flow must not clear application state. Persistence
checks use `stopApp` followed by `launchApp` without clearing state.

iOS exposes an element with an `accessibilityLabel` as a single accessibility
node and hides its children, so assertions target the container label rather
than the text inside it. Screens use `keyboardDismissMode="on-drag"`, so a
short swipe or a scroll dismisses the keyboard between text fields; without
one, the keyboard covers the next field and text lands in the previous one.
Filling a form bottom-up avoids the problem entirely.

The keyboard also covers controls that are not text fields, and a tap meant for
one of them lands on a key instead — appending a character to the field that
still has focus. How far down that reaches depends on the device, so the same
flow can pass on one simulator and fail on a taller one. Never record the
resulting value in an assertion: a flow that expects a mistyped name has
encoded a defect as the expected result and will break the moment the device
changes. Dismiss the keyboard before tapping the next control instead, and
prefer running a suite on more than one screen size before trusting it.

The export screen is longer than one viewport: the privacy notice runs past the
fold, and the ready panel is inserted above the post-export actions, so
"Open share options" moves further down as soon as the export succeeds. Assert
those elements after `scrollUntilVisible` rather than assuming the tap position
is still in view. Export is a stack route with no tab bar, so a flow returns to
the tab shell with `stopApp` and `launchApp` instead of a back gesture.

Data-export flows stop at the application-owned "Export ready" confirmation and
at the enabled share control. The platform share sheet is owned by iOS and
Android, so no flow opens it or asserts anything inside it; automating a native
sheet would add brittle platform selectors without testing application
behavior. Exports created during QA contain only the synthetic data the suite
entered, and the application removes its cached copy the next time the export
screen opens.

Data-restore flows stop at the application-owned "Choose file" control and at
the refusal panel shown when the installation already holds information. The
document picker is owned by iOS and Android, so no flow opens it or selects a
file, for the same reason no flow opens the share sheet. A complete successful
restore therefore cannot be automated here: it is covered by the
[Sprint 19 manual checklist](../../docs/manual-testing/sprint-19-offline-data-restore.md)
using a synthetic export. Adding a hidden import route, a database fixture, or
a production seeder to close that gap is not acceptable — the gap is documented
instead.

Replacement flows stop earlier still. The screen offers no destructive control
at all until a file has been read and validated, and both the picker and the
share sheet used for the recovery copy are platform-owned, so a suite can prove
that the gate exists and that visiting the screen changed nothing, but it cannot
drive a replacement to completion. A complete successful replacement, a forced
failure that preserves the original dataset, and the recovery-copy handoff are
covered by the
[Sprint 21 manual checklist](../../docs/manual-testing/sprint-21-safe-replacement-restore.md)
together with the parser, orchestration, and real-SQLite tests in
`apps/mobile`. The same rule applies: no hidden replacement route, no database
fixture, no production seeder, and no test-only bypass is added to close that
gap.

Personal-record flows are fully automatable, because a record is derived from
history the suite creates itself through public screens. One parameterized flow,
`flows/workout/complete-repetition-workout.yaml`, records a single repetition
set, so a suite can record a first result, beat it, and then fail to beat it
without a second flow or a database fixture. Records are reached the way the
product reaches them, through Workout, History, and the exercise as completed
history names it, and a suite asserts the record's own wording rather than a
badge or a color.

Export, restore, replacement, and deletion are all reached through
Profile → Data controls, so `flows/data-lifecycle/open-data-controls.yaml` is
the single entry point the other lifecycle flows compose. Data controls appears
in both profile states, under the empty state and below the profile form, so
flows scroll to it rather than assuming a position. Each lifecycle operation
keeps its own named control there; nothing infers which one the user meant.

Data-erasure flows are fully automatable and genuinely destructive, so they run
only against the disposable QA target every suite already clears. The flow
performs all three deliberate acts — opening the deletion screen, ticking the
acknowledgement, and confirming the platform alert — so a change that removes
any of them fails here. The alert's destructive option reads "Delete
everything", deliberately different from the screen's own "Delete all local
data", so no positional selector is needed to tell them apart.

Maestro judges visibility against the device rectangle, not against what a
scroll view has actually revealed. A control inside the tab-bar clearance is
therefore reported as fully visible, `scrollUntilVisible` scrolls zero times,
and the following `tapOn` taps a point the user cannot see. Pass
`centerElement: true` when scrolling to the last control on a long screen, as
the data-controls flow does.

Body-measurement flows keep the prefilled local date so a check-in is never
recorded in the future or outside the selected Progress period. When two
check-ins must be ordered, the earlier one uses the synthetic time `00:01` and
the later one keeps the prefilled current time.

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

Each run writes the CLI log, raw JUnit, `report.txt`, `report.json`, screenshots,
view hierarchy, and Maestro debug output beneath:

```text
artifacts/qa/<UTC timestamp>/<platform>/<suite>/
```

The directory is ignored by Git. Evidence must contain only synthetic data and
must not include database dumps, personal identifiers, or real fitness values.

If no device is detected, boot one and confirm `xcrun simctl list devices booted`
or `adb devices`. For explicit iOS, confirm Xcode contains an available iPhone
Simulator runtime; the wrapper handles boot and app installation. For Android or
implicit selection, build and install the app before rerunning.

Every assertion run prints individual PASS, FAIL, ERROR, or SKIP scenario lines
followed by setup/assertion status, suite, target, duration, exit status, JUnit
counts, and the artifact path. Missing or malformed JUnit is a nonzero reporting
integrity failure. Maestro's nonzero runner status is never replaced by reporting.
A failed iOS build writes `preparation.log` beside the QA artifacts.
If a selector differs by platform, inspect the Maestro hierarchy and first fix
missing accessibility semantics. Add a narrow platform override only when the
underlying native behavior is genuinely different.

Maestro does not replace VoiceOver, TalkBack, hardware-keyboard, Dynamic Type,
appearance, real-device, time-zone, upgrade, interruption, or injected-failure
testing. Complete the manual checklist before claiming merge readiness.
