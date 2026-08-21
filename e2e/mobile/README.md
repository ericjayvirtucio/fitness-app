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
./scripts/qa.sh sprint 23 --platform ios
./scripts/qa.sh sprint 24 --platform ios
./scripts/qa.sh sprint 25 --platform ios
./scripts/qa.sh sprint 26 --platform ios
./scripts/qa.sh sprint 27 --platform ios
./scripts/qa.sh sprint 29 --platform ios
./scripts/qa.sh sprint 30 --platform ios
./scripts/qa.sh sprint 31 --platform ios
./scripts/qa.sh sprint 36 --platform ios
./scripts/qa.sh sprint 37 --platform ios
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
15–27, and 29–38. Sprints 5, 7, and 14 deliberately return an unsupported-suite
error because no product manual QA specification exists for them. Sprint 28
does too: it changed no screen and added no suite.

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

The starter exercise import is a product feature, not a fixture.
`flows/exercise/add-starter-exercises.yaml` drives it through the public library
screen, and only the Sprint 27 suite and regression scenario 21 compose it.
Every other suite still authors its own definitions through
`create-exercise.yaml`, deliberately: those are the only automated proof that a
person can still write a definition by hand, their assertions depend on the
synthetic "E2E" names, and swapping forty-six suites onto imported content would
be a large blast radius bought for nothing. The import must never become a way
for the harness to skip a public screen.

The Exercise Library's filters are driven through
`flows/exercise/filter-exercise-library.yaml`, which takes a required
`EQUIPMENT_FILTER_ID` and `MUSCLE_FILTER_ID` and tapes over neither with a
default. Pass `exercise-library-equipment-filter-any` or
`exercise-library-muscle-filter-any` to leave one of them unnarrowed. The options
are tapped by identifier, not by their visible text, because the exercise editor
labels its own equipment and muscle choices with the same words; an identifier
keeps a step's screen unambiguous. The controls sit below the starter section and
directly above the lists, so every reach is a single downward scroll. They are
absent while the library is empty, which is deliberate: an empty library has
nothing to narrow, and the first-run screen every other suite meets is exactly as
tall as it was.

Since Sprint 30 the options are **put away by default** behind
`exercise-library-filters-toggle`, so the flow opens them before it taps one —
and only when they are not already open, because a scenario that filters twice
would otherwise close them on its second pass. That check asks whether
`exercise-library-equipment-filter` is visible, and it asks it from the one
viewport where that group renders if it is open: with the toggle centred. Asked
from anywhere else it would answer wrong, because off-screen content is absent
from the hierarchy rather than hidden.

The same control now serves all three Exercise Pickers through
`flows/exercise/filter-exercise-picker.yaml`, with the same two required
variables and the `exercise-picker` prefix instead:
`exercise-picker-filters-toggle`, `exercise-picker-equipment-filter`,
`exercise-picker-muscle-filter`, and `exercise-picker-filter-summary`. Two
prefixes are deliberate — both surfaces can be reached in one run, and the picker
is pushed over screens the library is not, so a step should never have to say
which one it meant.

The toggle is an `AppButton`, so it is asserted by its accessible label rather
than by the text inside it: `Show filters. No filters applied.`,
`Hide filters. No filters applied.`, or `Show filters. Filtered by Dumbbell. 3 exercises.`
The summary and "Clear filters" are rendered outside the region that closes, so
every assertion on them holds whether the options are open or away.

A filter is the reliable way to reach a definition inside a picker without typing
a name. The completed-history picker never falls back to the whole catalog, and
the active-session picker stops doing so as soon as one workout is completed;
narrowing suppresses recents in both, exactly as it does in the library.

Two rules follow from controls that appear with the first definition. A flow that
**creates** the first record changes which sections the screen has, so an
assertion written when the library was empty is not evidence about the library it
just populated: `create-exercise.yaml` asserts "Edit E2E Push-up" immediately
after saving, and that card moved below the fold the moment the filters appeared
above it — eight regression scenarios failed on it. And `scrollUntilVisible`
searches only the direction it is given, so a reusable flow that can be entered
from above _or_ below its target must anchor first: the filter flow scrolls up to
"Add starter exercises", which is always above both filters, before scrolling
down to an option. Applying a filter twice in one scenario is exactly the case
that exposed it.

That placement is why the first Sprint 29 run failed seven scenarios out of
seven. The controls started beside the search field, and they appear the moment
an import makes the library non-empty — so the import inserted most of a viewport
above the control the flow had just pressed, and the retained scroll offset
carried both it and "Added 26 exercises to your library." off screen. The
evidence read like a broken import and was not: the rows were all there. It is
the same trap Sprint 27 recorded, one level higher, and the fix was again to move
the growing section rather than to teach the flows to chase it.

Prove narrowing through the summary line's count, not by asserting that excluded
definitions are gone. Off-screen content in a scroll view is absent from the
hierarchy rather than hidden, so `assertNotVisible` on a filtered-out card would
pass whatever the filter did. The same rule decides where a negative assertion
may stand: Sprint 29 checks that "No exercises yet" is absent while a filter
matched nothing, and it scrolls back to `exercise-library-search` to do it,
because the empty state renders near the top and the summary sits far below it.
Asserted from beside the summary, that check would have passed whatever the
screen said.

A scenario that needs a definition sharing a starter name uses
`flows/exercise/create-named-bodyweight-exercise.yaml`, which takes a required
`EXERCISE_NAME`. `create-exercise.yaml` stays hard-coded for the reason below.

Completed exercise removal needs a workout holding two distinguishable
exercises, so `flows/exercise/create-alternate-exercise.yaml` adds a second
definition beside "E2E Push-up" and
`flows/workout/complete-two-exercise-workout.yaml` records one set in each.
`create-exercise.yaml` hard-codes its name and is composed by most suites, so a
second definition costs less than parameterising a flow every other suite calls.

A completed workout holding two exercises is taller than one viewport, so its
recorded sets, its removal controls, and its whole-workout deletion section move
below the fold as soon as a second exercise exists. Scroll — `UP` as well as
`DOWN` — before asserting anything on that screen, and remember that a cancelled
confirmation leaves the detail wherever the previous scroll left it.

The exercise picker inside an active workout lists recently performed exercises
first and falls back to the whole catalog only while no completed workout
exists. A two-exercise workout must therefore be the first completed workout of
a scenario, or the second exercise is absent from the list and only reachable by
searching. Every Sprint 25 scenario records it first for that reason.

The same picker inside completed history never gets that fallback: an addition
always happens after a workout has been completed, so recents are never empty
there and an exercise that has never been performed is simply not listed.
`flows/workout/add-completed-exercise.yaml` therefore types the name into
`exercise-picker-search` rather than expecting the whole catalog, and that is
the reliable way to reach any definition from that screen.

The completed detail's addition entry point sits below the exercise list, which
grows with every exercise the workout holds, and the polite confirmation after
an addition sits below the deletion section at the very bottom. Both are scrolled
to with `centerElement: true`; the reusable flow deliberately does not scroll to
the confirmation, so it does not leave every caller parked at the end of the
screen.

Personal-record flows are fully automatable, because a record is derived from
history the suite creates itself through public screens. One parameterized flow,
`flows/workout/complete-repetition-workout.yaml`, records a single repetition
set, so a suite can record a first result, beat it, and then fail to beat it
without a second flow or a database fixture. Records are reached the way the
product reaches them, through Workout, History, and the exercise as completed
history names it, and a suite asserts the record's own wording rather than a
badge or a color.

Assisted records need an exercise whose logging mode is "Assistance + reps", and
`flows/exercise/create-assisted-exercise.yaml` authors one rather than importing
the starter set's own "Assisted Pull-up". Three reasons, in the order they bite:
the synthetic "E2E Assisted Pull-up" name cannot be confused with the starter
definition of nearly the same name; a two-definition catalog keeps the exercise
picker's fallback list short enough to reach the card by scrolling, where an
import of twenty-six would force every pick through `exercise-picker-search`; and
choosing "Machine" beside "Assistance + reps" is the only automated proof that a
person can still pair that mode with the equipment the domain allows. The starter
definition is not wasted — it is the fixture for the Sprint 31 manual pass, which
covers both routes.

Recording the assisted set uses `flows/workout/complete-assisted-workout.yaml`,
parameterised on `ASSISTANCE` and `REPETITIONS` with no defaults. It reaches the
assistance field through `workout-set-resistance-input` rather than by text: the
field's visible label and the input's accessible name are both "Assistance (kg)",
so a text selector cannot say which of the two a step meant. The same identifier
serves "Weight" and "Added weight", because it is the one resistance field the
form renders.

It fills **repetitions first and assistance second**, which is the set form's
bottom-up order and not a preference — see the trap below.

Sprint 32 added the added-load pair, `flows/exercise/create-added-load-exercise.yaml`
and `flows/workout/complete-added-load-workout.yaml`, which mirror the assisted
pair step for step. They exist to be compared with it: the same twenty kilograms
under a different logging mode must produce a different sentence, and a mirrored
flow makes the mode the only difference between the two runs. The added-load
definition is authored on "Bodyweight" equipment because the domain restricts
"Added weight + reps" to it, exactly as it restricts "Assistance + reps" to
machine, resistance band, or other.

Both flows assert the active session's own sentence before finishing, so a
scenario that also opens completed history proves the same wording twice without
a second recording.

Records are reached by name, and the assisted exercise has its own entry flow,
`flows/workout/open-assisted-exercise-personal-records.yaml`. A second flow
rather than a parameter on the existing one: that flow is composed by eleven
scenarios across four suites, and a required variable would have to be threaded
through every one of them to serve the two names this harness uses.

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

**Workout History's list is bounded by the selected period.** Every scenario that
completes a workout and then asserts its card still passes unmodified, and each
one passes for the same reason: the workout is completed today and the default
period is this week, which contains today. That is a property of the fixtures,
not a coincidence to rely on silently — a scenario that needed a workout in a
previous week or month could not create one, because start and completion
instants come from the device clock and are not editable through the product.
`flows/workout/open-history-day-period.yaml` narrows to a single day for exactly
this reason: a day is the only period a run can move out of and back into while
still holding a workout. Workouts in two different months, a period holding more
than one page, and a workout performed across midnight are manual claims, in
`docs/manual-testing/sprint-36-history-obeys-its-period.md`, and are deliberately
not written as scenarios that would only ever exercise today.

**An empty period and an empty history say different things.** `No workouts in
this period` means the selection holds none; `No completed workouts yet` means
nothing has ever been completed. Both render in the same place, so a negative
assertion about one is only safe from the viewport where the other appears.
`suites/sprint-22/01` and `suites/sprint-24/07` assert the never-completed
sentence and are unaffected, because both reach a history with nothing in it.

**A daily screen's add control records to the day that screen is showing.** The
Nutrition diary and Hydration pass their selected day to the entry form and to
the saved-item log screen, so `flows/nutrition/log-entry-to-a-past-day.yaml`,
`flows/hydration/log-fluid-to-a-past-day.yaml`, and
`flows/nutrition/log-catalog-item-to-a-past-day.yaml` never type a date: they
move a day and then leave the Date and Time fields exactly as the form
prefilled them, which is the claim under test. Two consequences for selectors.
The day controls are `AppButton`s, so they are tapped as `Previous day` and
`Next day` — their accessible labels — and not as the "Previous" and "Next"
they display. And `Next day` is disabled on today, because every entry builder
refuses a future instant, so no flow can walk a recording screen into tomorrow.

**A past hydration day is SHORTER than today's, which put a control inside the
tab-bar clearance.** The target card is replaced by one sentence when the
selected day is not today. Sprint 37's first QA run lost a scenario to the
consequence: `Add fluid` moved up into the tab-bar clearance at
`[24,767][378,811]`, Maestro reported it fully visible against the device
rectangle, `scrollUntilVisible` scrolled zero times, and `tapOn` completed
against the tab bar. The screenshot showed the past day rendering perfectly and
the form never opening, which read like a navigation defect and was not.
`flows/hydration/log-fluid-to-a-past-day.yaml` passes `centerElement: true` for
this reason, and scrolls back up before asserting the totals card because the
screen keeps that offset when the save returns to it.
`flows/hydration/log-water-and-persist.yaml` keeps its plain scroll and its fixed
swipes and is unaffected: it never leaves today, where the taller target card
above pushes the same control clear of the clearance. **A screen that shrinks
with the data is the changed-height trap in the direction that hides a control
rather than the one that pushes it away.**

**Reach today through a relaunch rather than a scroll offset.** A suite proving
that today did not gain what yesterday recorded needs today's diary at a known
position. `stopApp` and `launchApp` give it one, keep the stored data, and
prove the back-dated entry survived a restart on the day it was recorded to —
which is why `suites/sprint-37/02` and `suites/sprint-37/04` relaunch instead
of tapping `Today` from wherever the previous step left the screen.

**A complete nutrient needs every optional field, and those fields now have
identifiers.** `flows/nutrition/log-one-time-entry.yaml` supplies energy and no
optional nutrient, so every period it builds reads `Incomplete` for protein,
carbohydrate, and fat. Proving the opposite needs a fixture that fills them, and
the three fields carried no `testID` until Sprint 38 added
`nutrition-protein-input`, `nutrition-carbohydrate-input`, and
`nutrition-fat-input`. Tapping them by their visible label would have been
ambiguous: `TextField` renders the label as text and puts the same string on the
input's accessible name, so `Protein (g)` matches two elements and picking one
is a coincidence rather than a selector.
`flows/nutrition/log-entry-with-nutrients.yaml` centres each field before
tapping it, for the same reason every other field in that form does.

**A nutrient average cannot be proven over two days end to end.** The average's
denominator is logged days, so distinguishing it from a per-day denominator
needs a period holding two logged days. A back-dated entry falls outside the
selected week whenever the run happens on a Sunday, and outside the selected
month whenever it happens on the first. That denominator is pinned in
`get-progress-summary-use-case.spec.ts`, where the fixture is deterministic, and
`suites/sprint-38/01` proves only what a single logged day can prove: that the
line renders and states a real number.

**Progress gained five lines, and the Nutrition card grew by three.** Since
Sprint 38 the Nutrition card renders ten metrics whenever the period holds a
logged day, and the Hydration card seven. Nothing above the Nutrition card
moved, so `Energy, …` is still assertable from the first viewport, but the
completeness sentence at the bottom of that card moved three lines down and
`suites/sprint-16/02` now scrolls to it rather than asserting it where it used
to sit. Every Progress metric is its own accessible element announcing
`label, value` — the summary cards deliberately carry no `accessibilityLabel` —
so a line is asserted by its whole name and neither of its two texts can be
asserted alone.

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

### Traps this harness has already hit

**A text selector matches the whole string, so a prefix needs its own wildcard.**
`assertVisible: Choose your own tracking target` fails against an element reading
`Choose your own tracking target. The app does not calculate or recommend a
medical intake amount.`, because the selector is a regex matched against the
element's entire text rather than searched inside it. Sprint 34 lost a run to
exactly this: the screenshot showed the target screen correctly open, and the
assertion was still false. Write `'Choose your own tracking target.*'`, the way
`flows/nutrition/log-one-time-entry.yaml` already writes `'.*E2E Banana.*'`. Read
the screenshot before concluding that a navigation step did not happen.

**Never give a parameterised flow an `env:` default.** A flow's own `env` block
is applied after the caller's `runFlow` env and overrides it, so the default
silently replaces every value a suite passes in and the flow's own assertions
still pass because they interpolate the same default. Require the variable and
let an unset one fail loudly.

**Do not assert text that sits inside a card carrying an `accessibilityLabel`.**
Such a card is a single accessible element, so its children never reach the
accessibility tree Maestro reads. The text is on screen and the assertion is
still false. Assert the card's own label, or assert content that lives outside
it.

The Workout History summary was the trap's sharpest edge: every derived number it
shows — completed workouts, actual sets, performed exercises, workout time,
repetitions, volume — sits inside `Workout progress summary`, so none of those
lines can be asserted on its own. Since Sprint 33 the card's own name carries
every sentence it displays, because a card that announces only its title
announces none of its numbers to a screen reader either. Assert the card name and
match the sentence inside it:

```yaml
- assertVisible: 'Workout progress summary,.*160 kg-reps recorded load volume from weighted sets'
```

The individual lines remain unassertable, and a negative assertion must be made
against the card name too, from the viewport where the card renders.

Since Sprint 34 the same is true of six more cards, so a name assertion is now the
only way to prove that the completed workout detail shows a set count and a
workout time, that the correction and addition screens state what they change,
that the nutrition diary shows a day's totals, that Goals & energy shows a BMI and
its energy estimates, and that the goal form shows a calculated target. Each name
is its identity phrase followed by every string the card renders, in render order,
so match the identity phrase and the one value the claim is about, and wildcard
values the fixture derives:

```yaml
- assertVisible: 'Profile-derived energy estimates, BMI, .*, Estimated maintenance, .* kcal/day'
```

**A card that contains a control must not carry an `accessibilityLabel`, and one
that does is a product defect rather than a selector problem.** The hydration
target progress card carried a composed name and a `Change daily target` button,
so the button was not in the accessibility tree: no flow could tap it, and none
ever did. The evidence was visible in this directory long before anyone read it —
its sibling `Set daily target`, in the unlabelled card beside it, is tapped by
`flows/hydration/log-water-and-persist.yaml`. If a control on screen cannot be
found by name, check whether an ancestor card is labelled before rewriting the
selector. That card is unlabelled now, so `flows/hydration/log-water-and-persist.yaml`
asserts its visible progress lines and its control rather than the name that used
to stand in for them. Workout
counts are still worth proving on the Progress tab, whose values are plain text,
and a specific workout through its own history card label or its completed
detail.

**Workout History is taller than one viewport.** The summary card and the period
controls push "Workouts in this period", the completed cards, and the empty
state below the fold, and off-screen content in a scroll view is absent from the
hierarchy rather than merely invisible. Scroll to anything below the summary
before asserting it.

**Dismiss the keyboard before scrolling to a control below a text field.** The
number pad covers the save action, and a scroll gesture with it open drags
across the keys and appends digits to the field being edited. `hideKeyboard`
does not work here, because the iOS number pad exposes no dismiss action; use a
short drag in the content area instead, which the screens honour through
`keyboardDismissMode="on-drag"`.

**A two-field form must be filled bottom-up, or the number pad eats the second
tap.** The set form puts assistance above repetitions. Filling top-down leaves
the pad covering the repetitions field, so `tapOn` with its identifier resolves
to the right coordinates and taps a key sitting over them — focus never moves,
and the digit lands in the field still holding it. Sprint 31's first run failed
all six scenarios this way: `20` became `2028`, repetitions stayed empty, and the
screenshot showed the product correctly refusing with "Enter valid values for
this set." The evidence read like a broken assertion and was not; the product was
right and the flow was wrong. An identifier does not protect a tap from the
keyboard — only reaching the higher field second does, which is why the guidance
above says filling a form bottom-up avoids the problem entirely.

**Removing height invalidates assertions the same way adding it does.** Sprint 30
put twenty-five filter chips away behind one button, which moved the Exercise
Library's catalog roughly five hundred pixels _up_ and moved every picker's first
card about seventy pixels _down_. Both directions break a tap written against the
old height, and the picker direction is the one that reached furthest: five
shared workout flows tapped `Add E2E Push-up` where it used to sit, and between
them thirty-two suites compose one of those flows. Every one of them now scrolls
to the card. Re-audit both directions whenever a section changes size, not only
when it appears.

**What a workout recorded changed how tall Workout History is.** The performed
summary used to add a "recorded load volume" line only for external and added
load; assisted and bodyweight work never produced one, because assistance is
excluded from load volume by design. That single extra line pushed "Recent
workouts" and the first `completed-workout-card` below the fold, and Sprint 32
lost a scenario to it after the same shared flow had passed twice in the same
suite against assisted data. Height that depends on the fixture is the same trap
as height that depends on the build — vary the data, not just the screen.

Sprint 33 closed this particular instance by stating the dimension in both
directions: a period that recorded any set now renders either the covered total
or `No recorded load volume from weighted sets`, so this line no longer changes
the screen's height with the data. Closing it cost height in the other
direction — every reps-only, assisted, bodyweight, duration, and distance
fixture gained a line it never had — which is why
`flows/workout/complete-and-review-history.yaml` now scrolls to the completed
card it used to tap where it sat. `flows/workout/open-completed-workout.yaml`
already scrolled and was safe in both directions. The remaining lines still
appear conditionally: repetitions, performed duration, and performed distance
each render only when the period recorded that dimension, so the card's height
still varies with the fixture and anything below it still needs scrolling to.

**A drag cannot dismiss the keyboard over a list with nothing left to scroll.**
`keyboardDismissMode="on-drag"` fires on a scroll drag, so the short swipe every
entry flow uses works only while the content below the field can still move.
Searching the exercise picker filters it to one card, which leaves nothing to
scroll, so the swipe is swallowed and the keyboard stays up over the only
result. Maestro's hierarchy does not model the keyboard: `scrollUntilVisible`
reports the covered card 100% visible and `tapOn` reports COMPLETED, while the
tap actually lands on the QuickType suggestion row and appends a word to the
field that still has focus. Sprint 32 lost a scenario to this — "E2E Weighted
Dip" became "E2E Weighted Dipping" and the exercise was never added. Dismiss a
text keyboard with `pressKey: Enter` after searching, rather than with the drag
that works on longer screens. The number-pad form of this trap is separate and
still has no dismiss action.

**Qualifying a recorded set makes every set row taller.** Sprint 32 changed
`Set 1: 20 kg × 8` to `Set 1: Assistance 20 kg × 8` for assisted work and
`Set 1: Added 20 kg × 8` for added load. The set row wraps rather than truncates,
so the longer sentence can take a second line and push the Edit, Delete, and
Correct controls beside and below it further down — on three screens that already
list many sets. This is the changed-height class in the direction that has broken
runs before, and it is why every Sprint 32 scenario scrolls to a control below a
set row rather than tapping where it sat. Only the two marked modes grow;
`external-load-and-repetitions` is deliberately unchanged, which is what keeps
every pre-existing weighted assertion valid.

**A record card replaces the sentence that stood in for it, and the screen grows.**
Sprint 31 gave assisted work a personal record, so an exercise that used to show
one line of explanation now shows a full card. That is the create-the-first-record
class again — an assertion written against the screen before the record existed is
not evidence about the screen that now holds it — and it is why every flow reaching
the personal-records screen scrolls to what it asserts. The eleven existing
scenarios that reach that screen all do so for definitions with no assisted
history, so their screens are unchanged; that is a fact to re-verify against a run,
not to assume.

**Adding a section to a screen invalidates every unscrolled assertion below it.**
A screen that acts in place keeps its scroll offset across the change, and that
offset is only clamped back by the content height. Sprint 26 added an
"Add exercise to this workout" section to the completed detail, which made the
page taller, so the offset a removal leaves behind stopped clamping far enough to
bring the surviving exercise's recorded set back on screen — and a Sprint 25
scenario that had passed for a sprint began failing on an assertion about
behavior that had not changed. Scroll to what you assert on any screen that
mutates in place, rather than relying on a clamp.

**A control that sits last on a screen moves below the fold as the list above it
grows.** "Create exercise" in the Exercise Library, "Add Exercise To This
Workout" on the completed detail, and the deletion section beneath it are all on
screen while their lists are short and below it as soon as a scenario records
more. A flow that worked against an empty state is not evidence that it works
against a populated one; scroll to the control every time rather than only when a
run has already failed. Sprint 27 proved the point on the empty state itself:
adding the starter-exercise section made even an empty library tall enough to
push "Create exercise" down, so `create-exercise.yaml` — which forty-six suites
compose — now scrolls to it instead of tapping it where it used to sit.

**`scrollUntilVisible` gives up long before the bottom of a very long screen.**
The first Sprint 27 run failed six of seven scenarios this way: the import had
worked and all twenty-six definitions were on the device, but the starter
section sat beneath the catalog, and neither the result sentence below
twenty-six cards nor an exercise partway up the alphabet could be reached before
the scroll budget ran out. The evidence looked like a product failure and was
not. Two lessons: put a control and its result where growth cannot bury them —
the section moved above the lists, which is better for a person too — and reach
one item in a long list through the screen's own search rather than by scrolling
to it. The Exercise Library search carries `exercise-library-search` for that,
alongside the picker's `exercise-picker-search`.

**A populated catalog changes what the exercise picker's fallback shows.** The
picker lists recently performed exercises first and falls back to the whole
catalog only while no completed workout exists. That fallback used to hold the
one or two definitions a suite had authored; once the starter set has been
imported it holds twenty-six, ordered by name, and the definition a scenario
wants is usually several screens down. Type the name into
`exercise-picker-search` rather than expecting the fallback list to show it —
the same technique `flows/workout/add-completed-exercise.yaml` already uses for
the completed-history picker, and the one every Sprint 27 scenario uses.

**A destructive alert option must read differently from the control that opens
it.** The data-erasure alert says "Delete everything" beside a screen control
reading "Delete all local data", and completed-workout deletion says "Delete
Workout", so each is reachable by text alone. The exercise editor's alert
originally repeated its own control's "Delete exercise" verbatim, which left no
way to confirm a deletion without a positional selector; it now reads "Delete
this exercise". Keep new confirmations distinct for the same reason.

**Reusable flows that start from a tab cannot follow a pushed screen.** Personal
records, completed detail, the correction screens, and the Workout History a
deletion returns to have no tab bar, so a flow beginning with
`tapOn: id: tab-workout` fails there. Relaunch the app between phases to return
to a known root rather than guessing at back gestures.

**Workout History cards are indistinguishable by label unless a scenario names
them.** A synthetic workout is named "Workout" by default, so a scenario that
must open an older one selects `completed-workout-card` by index after scrolling
the list into view. Index 0 is the most recent workout.

**Ten assertions match the default workout name, and depend on a default rather
than on a guarantee.** Six match `Open Workout,.*` — four in
`flows/workout/complete-and-review-history.yaml` and two in
`suites/sprint-33/01-a-weighted-period-states-what-its-total-covers.yaml` — and
four match `in Workout, set 1`, in `suites/sprint-22/02`, `suites/sprint-23/03`
(twice), and `suites/sprint-31/01`. They were written when nothing could rename a
workout. A workout of either status can now be renamed, so **a scenario that
renames one must not compose those flows, and must assert the name it chose.**
Use an `E2E`-prefixed name and check every selector that would then match it: a
workout's name is interpolated into the history card's accessible label, the
exercise performance card's label, a personal record's evidence sentence, the
add-exercise and delete control labels, and the deletion alert's title.

**The naming control is selected by identifier, not by the words it displays.**
`rename-active-workout` and `rename-completed-workout` both display "Rename This
Workout", but an `AppButton` is read by its accessible label, and theirs carry
the workout's current name — the very thing a renaming scenario is about to
change. `flows/workout/rename-workout.yaml` takes the identifier as a parameter
for this reason.

**Adding the naming control made two screens taller, and where it was added
mattered more than that it was.** The completed detail carries it under the date
line; the active workout carries it among the whole-workout actions above "Finish
Workout". It was originally under the active workout's heading, and Sprint 35's
first QA run failed all four scenarios because of it: the extra row pushed the set
form down until the iOS number pad covered "Save Set", so every scenario died on
`Set 1: 12 reps` having never reached a naming assertion. The screenshot showed
the rename had worked perfectly and the save control was simply behind the
keyboard. **A control added above a keyboard-driven form can hide a control below
it without any selector being wrong.** Four completion flows and one Sprint 27
scenario still scroll to "Finish Workout" before tapping it, because the naming
control now sits directly above it; that scroll is a no-op when it is already
visible. This is the same trap a taller exercise picker set earlier: a flow that
worked against a shorter screen is not evidence that it works against a taller
one.

**An alert's confirm option is `index: 0`, not `index: 1`.** Maestro enumerates
the alert before the screen behind it, so when a confirmation repeats the words
of the control that opened it, the alert's own option comes first. Every
confirmation here uses `index: 0`; `flows/workout/empty-session-lifecycle.yaml`
used `index: 1` and so had always been tapping the screen's own "Discard Workout"
button, passing only because that button's coordinates happened to fall under the
alert's confirm button. Sprint 35 moved the button roughly one row lower, the same
tap landed on the backdrop instead, and the workout survived the discard. **A
positional selector that happens to overlap the right target is not a working
selector; it is a coincidence waiting for a layout change.**

**A destructive alert's title contains its action's own words.** "Delete
Workout?" and the "Delete Workout" button differ by one character, so tap the
button by its exact text and let Maestro's full-match semantics separate them,
or assert the title with an explicit `.*` suffix.

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
