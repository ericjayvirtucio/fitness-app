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

An optional value travels to a screen as an expo-router query parameter: push with `router.push({ pathname, params })` and read with `useLocalSearchParams<{ name?: string }>()`, then spread it into the screen prop conditionally, because `exactOptionalPropertyTypes` makes an explicitly `undefined` optional property a type error rather than a no-op. `fromEntryId` and the daily screens' `date` both travel this way. A route parameter is untrusted input: validate it before it prefills a field or reaches a query, and fall back to a value the screen displays rather than to one it hides.

## Design system and appearance

The public design-system boundary is `src/design-system/index.ts`. Mobile routes
and features import components and tokens from `src/design-system`, not its
internal files. Semantic colors live in `theme/colors.ts`; typography, spacing,
radius, opacity, border, icon, motion, and touch-target values live in
`theme/tokens.ts`; platform elevation intent lives in `theme/elevation.ts`.
Components consume the active theme instead of repeating visual values.

The application follows the device light or dark setting. There is no stored manual override. Verify both appearances in the simulator and check that larger accessibility text remains readable.

Because no feature file holds a color literal, replacing a palette is one file and
reaches every screen without a screen being edited. That boundary is load-bearing
rather than tidy, so verify it rather than trusting it:

```bash
grep -rInE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" apps/mobile/src apps/mobile/app \
  --include="*.ts" --include="*.tsx" | grep -v "design-system/theme/"
```

`theme/contrast.ts` computes a WCAG ratio and `theme/theme.spec.ts` asserts every
pair a component renders, so a proposed color that fails its threshold is caught
before it is committed. Adding a role, or a component that renders a new pair,
means adding its assertion in the same change.

Usage, accessibility guidance, the card-variant rule, and extension rules are
documented in the
[mobile design-system guide](../apps/mobile/src/design-system/README.md);
the boundary, the contrast contract, and what may enter the system are described
in [the design-system architecture](architecture/design-system.md).

## Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @fitness/mobile exec expo install --check
```

## Mobile verification

`pnpm test` runs Jest and Vitest in the terminal without starting an iOS
Simulator or Android Emulator. Test workspaces and their files run serially to
reduce memory use.

Verify native presentation, accessibility, and platform integration on an
available physical device. Use the [manual testing guide](manual-testing/README.md)
to select the changed capability and critical smoke checks and to record the
device, platform version, build, results, and limitations.

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
unknown; zero must be entered only when known. Recording from the diary applies
to the day the diary is showing: the day travels as a validated `date` route
parameter, a past day prefills `12:00` while today keeps the current clock, the
Date field stays editable as the override, and `Next` is disabled on today
because every entry builder refuses a future instant. See
[offline nutrition logging architecture](architecture/offline-nutrition-logging.md),
the [manual QA checklist](manual-testing/sprint-8-offline-nutrition-logging.md),
and [troubleshooting guidance](troubleshooting/offline-nutrition-logging.md).

## Offline hydration tracking

The Today tab lists plain-water and explicit other-fluid volumes for a captured
local calendar day. Entry routes accept exact presets or custom milliliters plus
`YYYY-MM-DD` and 24-hour `HH:MM`. Recording applies to the day the screen is
showing, under the same rule Nutrition uses. The optional target is user-defined
in mL or L; progress appears only for today because target history is not
versioned. See
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

## Active workout sessions

At most one workout is active at a time. Starting, adding an exercise, recording
a set, finishing, and discarding are each one short exclusive transaction, so an
interruption at any point leaves a coherent workout or none — a failed discard
leaves the workout with every set it held rather than one that recovers with its
recorded work missing. Discarding is the only way to remove an active workout and
refuses anything that is not active; completed history is removed through its own
separate path. See
[offline workout session architecture](architecture/offline-workout-sessions.md),
[Specification 0028](../specs/0028-atomic-active-workout-lifecycle.md), the
[Sprint 13 manual checklist](manual-testing/sprint-13-offline-workout-sessions.md),
the
[Sprint 28 manual checklist](manual-testing/sprint-28-atomic-active-workout-lifecycle.md),
and
[troubleshooting guidance](troubleshooting/offline-workout-sessions.md).

## Offline workout history

Workout History reads completed session snapshots and provides detail,
captured-local-date Day/Week/Month summaries, bounded pagination, and genuinely
performed exercise recents. It never derives performance from Planner targets or
current Catalog definitions. The selected period governs the workout list as well
as the summary, by the date a workout started, so a workout crossing midnight is
listed and counted by the same period; a period holding none says
`No workouts in this period`, which is a different sentence from
`No completed workouts yet`. See
[Workout History architecture](architecture/offline-workout-history.md),
[Specification 0036](../specs/0036-history-obeys-its-period.md),
[ADR 0026](decisions/0026-a-period-control-governs-every-list-beneath-it.md), the
[Sprint 15 manual checklist](manual-testing/sprint-15-workout-history.md),
the [Sprint 36 manual checklist](manual-testing/sprint-36-history-obeys-its-period.md),
and [troubleshooting guidance](troubleshooting/offline-workout-history.md).

## Completed workout correction

A recorded set inside a completed workout can be deliberately edited, added, or
deleted from Workout History. The workout keeps its identity, its lifecycle
instants, and every captured snapshot, and derived records, progress, and export
recompute from the corrected facts. There is no audit trail: the previous value
is not retained and nothing claims otherwise. See
[completed workout correction architecture](architecture/completed-workout-correction.md),
[ADR 0018](decisions/0018-explicit-completed-workout-correction.md), the
[Sprint 23 manual checklist](manual-testing/sprint-23-completed-workout-correction.md),
and
[troubleshooting guidance](troubleshooting/completed-workout-correction.md).

## Completed session exercise removal

One exercise can be removed from a completed workout, with every recorded set it
owns, after a destructive confirmation that names it. The surviving exercises keep
their identifiers and captured snapshots and take contiguous positions, the parent
workout and its lifecycle instants are untouched, and a removal that would leave
the workout with no recorded set is refused in words. The write reuses the
`correctCompleted` contract inside one exclusive transaction, child-first. See
[completed session exercise removal architecture](architecture/completed-session-exercise-removal.md),
[ADR 0020](decisions/0020-completed-session-exercise-removal.md), the
[Sprint 25 manual checklist](manual-testing/sprint-25-completed-session-exercise-removal.md),
and
[troubleshooting guidance](troubleshooting/completed-session-exercise-removal.md).

## Completed workout exercise addition

One exercise that was performed but never logged can be added to a completed
workout, with the first set it recorded, entered in the same action and saved
explicitly. It is appended last, so every existing exercise keeps its identifier,
position, and captured snapshots, and the parent workout and its lifecycle
instants are untouched. The Exercise Catalog is read once, to capture a fresh
snapshot for the exercise entering the session now; no existing snapshot is
re-read. An addition to a workout already holding the maximum number of exercises
is refused in words. The write reuses the `correctCompleted` contract inside one
exclusive transaction, child-first. See
[completed workout exercise addition architecture](architecture/completed-workout-exercise-addition.md),
[ADR 0021](decisions/0021-completed-workout-exercise-addition.md), the
[Sprint 26 manual checklist](manual-testing/sprint-26-completed-workout-exercise-addition.md),
and
[troubleshooting guidance](troubleshooting/completed-workout-exercise-addition.md).

## Starter exercise library

The Exercise Library offers a code-owned set of twenty-six exercise definitions
that a person can add in one deliberate press, from the empty state and from the
populated library alike. It is an import, never a seed: nothing is written until
the person asks, which is what keeps a fresh installation eligible for restore
and keeps erasure a way back to an empty installation. Entries whose normalized
name or identifier the catalog already holds are skipped and reported, never
overwritten. Everything it writes is an ordinary catalog row with no origin
column, marker, or privileged tier, and the whole import runs in one exclusive
transaction that rolls back completely on failure. No migration, schema change,
or dependency was added. See the
[starter exercise library architecture](architecture/starter-exercise-library.md),
[Specification 0027](../specs/0027-starter-exercise-library.md), the
[Sprint 27 manual checklist](manual-testing/sprint-27-starter-exercise-library.md),
and
[troubleshooting guidance](troubleshooting/starter-exercise-library.md).

## Exercise Library filtering

The Exercise Library narrows by one equipment value and one primary muscle group
alongside its existing name search. Each narrowed read is one bounded,
parameter-bound query on the path browsing and searching already used; no filter
value is interpolated, and an absent criterion contributes no clause, so an
unnarrowed read issues the statement the catalog has always issued. Favorites and
Recently performed are hidden and unread while anything narrows the list, exactly
as they already are while a search is being typed, and one "Clear filters"
control restores them. A narrowed list that matched nothing states what is
narrowed instead of claiming the library is empty, and a list that came back at
its read bound — 100 browsing, 50 searching — says so. Filter state belongs to
the screen and is not persisted, the filters sit below the starter section and
directly above the lists they narrow so that their appearance after an import
cannot carry the import control off screen, they are absent while the library is
empty. The controls carry `exercise-library-equipment-filter` and
`exercise-library-muscle-filter`, each option suffixed with its value, and the
summary carries `exercise-library-filter-summary`. No migration, schema change,
index, or dependency was added. See the
[offline exercise catalog architecture](architecture/offline-exercise-catalog.md),
[Specification 0029](../specs/0029-exercise-library-filtering.md), the
[Sprint 29 manual checklist](manual-testing/sprint-29-exercise-library-filtering.md),
and
[troubleshooting guidance](troubleshooting/offline-exercise-catalog.md).

## Compact, reusable exercise filtering

Both filters, their summary, and their clear action live in one capability-owned
`ExerciseFilterControls`, used by the Exercise Library and by all three Exercise
Pickers. It is not a design-system component, because it knows the equipment and
muscle-group vocabularies and the product's own sentences about them; the
disclosure it uses is an `AppButton` and a conditional render rather than a new
shared primitive, since one collapsible is not yet a demonstrated reuse.

Twenty-five options measure 576 px at default text and 1350 px at the largest
accessible size, against a scroll viewport of roughly 700 px, so the choosing is
put away by default behind a labelled "Filters" button and collapsing removes 532
of those pixels. Only the choosing closes: the chosen values stay on the button's
accessible name, and the summary and "Clear filters" are rendered outside the
region that closes, so an active filter is never hidden by the control that
applied it. The button is outside that region too, so it is the same element
across an open and a close and focus is not lost. Its accessible name is the act
pressing performs followed by the sentence the summary already states — "Show
filters. Filtered by Dumbbell. 3 exercises." — and `accessibilityState.expanded`
carries the open state, so nothing is announced twice.

`ExercisePicker` composes the control rather than accepting it as a prop, so no
consumer can switch filtering on or off and the Planner, the active Session, and
completed-workout addition narrow identically. Recently performed is suppressed
while a picker is narrowed, and a narrowed miss states what is narrowed instead
of advising somebody who has a full catalog to create exercises. Picker criteria
belong to the picker and reset when it is dismissed, exactly as its search
already does, and its reads are now numbered so a superseded response — or a
failure a newer read has replaced — cannot reach the screen.

Picker identifiers mirror the library's under an `exercise-picker` prefix:
`exercise-picker-filters-toggle`, `exercise-picker-equipment-filter`,
`exercise-picker-muscle-filter`, and `exercise-picker-filter-summary`; the
library's own toggle is `exercise-library-filters-toggle`. Nothing below
presentation changed, and no migration, schema change, index, or dependency was
added. See
[Specification 0030](../specs/0030-compact-exercise-filtering.md), the
[Sprint 30 manual checklist](manual-testing/sprint-30-compact-exercise-filtering.md),
and
[troubleshooting guidance](troubleshooting/offline-exercise-catalog.md).

## Completed workout deletion

One completed workout can be deleted from its own detail screen after a
destructive confirmation. The deletion removes that workout with every session
exercise and actual set it owns, child-first, inside one exclusive transaction
that verifies no owned row survives before it commits, and it touches nothing
else. History, progress, personal records, per-exercise history, and export
recompute from the workouts that remain. There is no undo, trash, audit trail,
or tombstone: the workout is gone and nothing claims otherwise. See
[completed workout deletion architecture](architecture/completed-workout-deletion.md),
[ADR 0019](decisions/0019-deliberate-completed-workout-deletion.md), the
[Sprint 24 manual checklist](manual-testing/sprint-24-completed-workout-deletion.md),
and
[troubleshooting guidance](troubleshooting/completed-workout-deletion.md).

## Workout personal records

Opening a performed exercise from Workout History shows its best recorded
results, derived only from completed actual sets and each linked to the workout
that proves it. Categories are defined per logging mode, and nothing derived is
stored or exported.

Every logging mode the domain defines now yields a record. Assisted work claims
"Least recorded assistance in a set", ordered ascending, and claims nothing about
the repetitions performed under that assistance — the same way "Heaviest recorded
load in a set" claims a load and stays silent about its repetitions. Ordering
direction is a required field on each descriptor, because the dimension cannot
decide it: load and assistance both order on resistance and order oppositely.
Zero assistance is not recordable, because an unassisted repetition is a
different logging mode with its own record group.

The set form's resistance field carries `workout-set-resistance-input` whatever
the mode labels it — "Weight", "Added weight", or "Assistance" — because its
visible label and its accessible name are the same words, so a text selector
cannot say which of the two an end-to-end step meant.

Displayed results now use that same vocabulary. Three logging modes share one
result variant, so `formatWorkoutResult` and `formatPlannedWorkoutResult` take
the captured mode and mark the two whose mass is not the mass lifted:
`Assistance 20 kg × 8` and `Added 20 kg × 8`, beside the unmarked `20 kg × 8`.
The qualifier leads so a truncated row keeps its meaning, and the same sentence
is produced in the active session, in completed history, and while correcting a
set. Set rows are therefore taller for those two modes, which moves the controls
below them. See
[Specification 0032](../specs/0032-recorded-result-meaning.md) and the
[Sprint 32 manual checklist](manual-testing/sprint-32-recorded-result-meaning.md).

A derived total states what it covers by the same reasoning. Recorded load volume
sums external and added load alone, so both screens that display it say
`160 kg-reps recorded load volume from weighted sets`, and the Workout History
summary states `No recorded load volume from weighted sets` for a period that
recorded work with none of it eligible. Every other total covers all recorded
work of its dimension and is left unqualified. The summary card is one
accessibility element, so its accessible name now carries every sentence it
displays — without that, none of its numbers reached a screen reader, and the
coverage sentence would not have either. See
[Specification 0033](../specs/0033-summary-total-coverage.md),
[ADR 0023](decisions/0023-displayed-totals-state-their-coverage.md), and the
[Sprint 33 manual checklist](manual-testing/sprint-33-summary-total-coverage.md).

That card was the first instance of a class, not the whole of it. A labelled
container's accessible name is now its identity phrase followed by every string it
renders, in render order, composed through `describeCardContents` so there is one
path rather than one per screen; a rendered heading that only restates the
identity phrase is omitted. A container whose children include a control is not
labelled at all, because no name recovers a control the name has hidden — the
hydration target progress card carried one, and `Change daily target` never
reached the accessibility tree while it did. `Card` is the only design-system
component that couples a label to grouping: it sets
`accessible={Boolean(accessibilityLabel)}`, while `Screen` and `SelectionField`
pass a label through without it and hide nothing. See
[Specification 0034](../specs/0034-announced-card-contents.md),
[ADR 0024](decisions/0024-labelled-containers-announce-their-contents.md), and the
[Sprint 34 manual checklist](manual-testing/sprint-34-announced-card-contents.md).

A workout of either status can be renamed by its owner, through one screen at
`/workout-session/[id]/name` reached from the active workout and from completed
history. The name is user-authored free text, capped at 80 characters by the same
policy the schema's `CHECK` already carried, rendered only through `AppText` and
interpolated only into accessible names and one alert title. It never reaches a
refusal sentence. Because both history readers project `display_name` through a
live join rather than reading a stored snapshot, a rename also changes what a
personal record says its evidence is called. See
[Specification 0035](../specs/0035-owner-named-workouts.md),
[ADR 0025](decisions/0025-a-workout-name-is-its-owners-label.md), and the
[Sprint 35 manual checklist](manual-testing/sprint-35-owner-named-workouts.md). See the
[personal records architecture](architecture/workout-personal-records.md),
[ADR 0017](decisions/0017-deterministic-workout-personal-records.md),
[ADR 0022](decisions/0022-personal-record-ordering-direction.md),
[Specification 0031](../specs/0031-assisted-repetition-records.md), the
[Sprint 22 manual checklist](manual-testing/sprint-22-workout-personal-records.md),
the
[Sprint 31 manual checklist](manual-testing/sprint-31-assisted-repetition-records.md),
and [troubleshooting guidance](troubleshooting/workout-personal-records.md).

## Offline Progress analytics

The Progress tab combines bounded, capability-owned Nutrition, Hydration, and
completed-workout readers. It derives Today, Sunday-to-Saturday week, and calendar
month summaries from captured local dates without persisted rollups.

Every value the summary computes is displayed by the screen that computes it,
and every nutrient the entry form captures is summarized over a period as well as
over a day. The Nutrition card carries sixteen metrics: energy, its average, the
logged day and entry counts, and a total and an average per logged day for
protein, carbohydrate, fat, fiber, sugar, and sodium. Each average is labelled by
the value it averages and divides by logged days, the count the card names beside
it; an average that cannot be computed is omitted rather than rendered as zero.

The Workouts card carries up to seven metrics and one sentence. The completed
workout, actual set, and performed exercise counts and the elapsed `Workout time`
are always present; repetitions, performed duration, and performed distance
render only when the period recorded that dimension. Recorded load volume is the
one total on either card that excludes recorded work, so it is the sentence
carrying its own coverage rather than a labelled value, stated in the covered
form or in that form with the number removed for every period holding a set.
Nothing here is formatted twice: `formatDuration`, `formatRecordedDistance`,
`formatRecordedLoadVolumeSummary`, and `absentRecordedLoadVolumeMessage` are the
functions Workout History already uses, so the two screens state the same period
in the same words. `Workout time` is elapsed wall-clock session length and is not
the performed duration beside it; the labels are what tell them apart.

A nutrient's period value stays in the unit it was recorded in — sodium in
milligrams, the other five in grams — and `formatProgressMass` takes that unit as
a parameter rather than a second formatter existing for one of them.

The Progress summary cards deliberately carry no `accessibilityLabel`, so each
metric stays its own accessible element announcing `label, value`. See the
[offline Progress architecture](architecture/offline-progress-analytics.md),
[Specification 0038](../specs/0038-progress-states-everything-it-counted.md),
[Specification 0039](../specs/0039-progress-counts-every-nutrient-you-logged.md),
[Specification 0040](../specs/0040-the-workouts-card-states-what-it-recorded.md),
[ADR 0028](decisions/0028-a-summary-states-every-value-it-computes.md),
[ADR 0029](decisions/0029-a-captured-value-is-a-value-a-summary-can-state.md),
[ADR 0030](decisions/0030-a-value-is-stated-by-every-screen-that-computes-it.md),
the [Sprint 16 manual checklist](manual-testing/sprint-16-progress-analytics.md),
the [Sprint 38 manual checklist](manual-testing/sprint-38-progress-states-everything-it-counted.md),
the [Sprint 39 manual checklist](manual-testing/sprint-39-progress-counts-every-nutrient-you-logged.md),
the [Sprint 40 manual checklist](manual-testing/sprint-40-the-workouts-card-states-what-it-recorded.md),
and the [Progress troubleshooting guide](troubleshooting/offline-progress-analytics.md).

## Offline data export

Export, restore, replacement, and deletion share one entry point:
Profile → Data controls (`/data-controls`). The Profile tab shows that single
action in both its populated and its empty state, so a returning user and a
long-time user reach every lifecycle operation the same way. Each operation
keeps its own named control there; nothing infers which one was meant.

The Data controls screen can create one versioned JSON file describing everything the
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

Data controls can also read a saved `formatVersion` 1 export back in. Because a
new device starts with nothing, Data controls is reachable from the profile
empty state as well as from below the form. A selected file is untrusted input: it
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

## Offline local data erasure

Data controls can also delete everything the app stores on the device. It takes
three deliberate acts — reaching `/delete-local-data`, ticking an
acknowledgement that enables the destructive control, and confirming in a
platform alert — and it is never triggered by navigation, startup, a failure, or
a retry.

Every capability exposes a `StoredDataEraser` beside its existing
`StoredDataProbe`. One exclusive transaction runs every eraser children-first
and then every probe; a probe that still reports records rolls the whole
deletion back, so a partial deletion is never committed. Afterwards the app
clears the export it owns and, best effort, checkpoints and vacuums the
database. The database file, its schema, and migration version 11 all survive,
and the app is usable immediately.

Nothing outside the sandbox is touched, including exports the user saved
elsewhere. The app claims that it holds no information, not that bytes are
unrecoverable. No dependency and no migration was added. See
[offline local data erasure architecture](architecture/offline-local-data-erasure.md),
the [Sprint 20 manual checklist](manual-testing/sprint-20-offline-local-data-erasure.md),
and [troubleshooting guidance](troubleshooting/offline-local-data-erasure.md).

## Safe replacement restore

Data controls can also replace everything on the device with a validated export
(`/replace-local-data`). The incoming file goes through the same version 1
parser restoring uses, and no acknowledgement, destructive control, or platform
alert exists until it has passed. Nothing is erased to find out whether a file
is usable.

A copy of the current information is prominently offered and can be declined
through its own separate acknowledgement. It is the existing exporter's output,
created before the replacement begins so it can contain nothing incoming, and it
deliberately survives the commit — the app cannot see whether a share sheet
saved it, so deleting it would remove the only way back.

The database change is one exclusive transaction: every capability eraser runs
children-first, every probe must report empty, the validated dataset is written
through the same repositories and the same shared `writeRestoreData` that empty
restore uses, and capability presence is verified before the commit. Any failure
before that rolls back to the previous dataset. That guarantee is asserted
against a real SQLite engine through a test-owned adapter over Node's built-in
SQLite, not against a fake runner.

The picker and the share sheet are platform-owned, so Maestro proves the gate
and the untouched records but cannot drive a replacement to completion; that is
covered by hand. No dependency and no migration was added. See
[safe replacement restore architecture](architecture/safe-replacement-restore.md),
the [Sprint 21 manual checklist](manual-testing/sprint-21-safe-replacement-restore.md),
and [troubleshooting guidance](troubleshooting/safe-replacement-restore.md).

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
