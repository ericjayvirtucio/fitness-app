# Specification 0045: Foreground rest timing between sets

- Status: Approved
- Date: 2026-08-25

## Objective and scope

Let a person start an optional, dismissible rest countdown after successfully
recording a set during an active Workout Session, entirely while the app is in
the foreground, with no persisted timer state and no notification.

This is Phase 4's (Training Depth) first shipped capability. It closes the
provisional outcome recorded in
[the product roadmap](../docs/product-roadmap.md#training-depth-direction-provisional):
"a person can start an optional, dismissible rest countdown after logging a
set during an active Workout Session, entirely in the foreground, with no
persisted state and no notification." No approved specification named rest
timing before this one; Specifications 0013 and 0032 both listed "rest
timers" only as excluded to date, not rejected.

Version 1 adds one pure countdown model, one presentation component, and one
integration point on the active Workout Session screen. It adds no schema, no
migration, no repository method, no use case, and no dependency. Nothing about
a recorded set, a session, completed history, personal records, Progress, the
Workout Planner, the Exercise Catalog, export, restore, replacement, erasure,
synchronization metadata, or the outbox changes.

Persisted rest-duration preferences; a rest-duration field on Exercise
Definition, Planned Exercise, or a recorded set; notifications, alarms, or
background timers; sound, vibration, or haptic behavior; automatic timer
start; RPE, RIR, or estimated one-repetition maximum; supersets or grouped
sets; and any claim that a duration is medically correct, optimal, or
recommended are excluded from this version. See "Explicit exclusions" below
for the complete list.

## Terminology

- **Countdown** — the in-memory state described below. It exists only while
  its owning component is mounted and never has a database row.
- **Preset duration** — one of four fixed values a person chooses before
  starting a countdown: 60, 90, 120, or 180 seconds. There is no other way to
  set a duration in this version.
- **Foreground-only** — the countdown runs only while its screen is mounted
  and the JavaScript runtime is live. It schedules no background work, no
  notification, and no native alarm, and it does not claim to.
- **Deadline** — an absolute point in time (`getCurrentTime() + duration`)
  computed once when a countdown starts. Remaining time is always derived from
  this deadline and the current time, never from a decrementing tick count.

## The safe offer point

Verified directly against `apps/mobile/src/features/workout-session/presentation/WorkoutSessionScreen.tsx`
and `WorkoutSetForm.tsx`:

`WorkoutSetForm` validates a result synchronously and calls `onSave` only on
success (`WorkoutSetForm.tsx:136-167`). `onSave` is `WorkoutSessionScreen.saveSet`
(`WorkoutSessionScreen.tsx:86-103`), which calls
`WorkoutSessionMutationUseCases.addSet`/`updateSet`
(`workout-session-use-cases.ts:175-212`) inside one exclusive transaction. If
the mutation outcome is unsuccessful, `saveSet` throws before reaching
`setEditor(undefined)` (`WorkoutSessionScreen.tsx:100`), so the set editor
stays open and no rest offer is possible from that state. Only on success does
`saveSet` close the editor and `await refresh()` (`WorkoutSessionScreen.tsx:101-102`),
which is the one point where the screen's own state is guaranteed to reflect a
set already committed to SQLite.

The rest offer is therefore made available only from inside that success
branch. A failed save and a successful one are structurally distinguished by
the existing code before this specification adds anything; the countdown adds
no new confusion between them because it can only ever be reached from the
branch that already implies a committed write.

## Interaction

Explicit, person-controlled start. After a set saves successfully, the screen
shows a rest offer: four preset-duration buttons and no timer runs until one
is pressed. The timer never starts automatically, and no permanent
always-available timer control exists independent of a just-saved set.

The offer is scoped to the screen, not to the specific exercise or set just
saved — the active Workout Session has exactly one countdown at a time, and
starting a new one while a completed or dismissed one is showing replaces it.
Because Start only renders from `idle`, `completed`, or `dismissed` states
(see "Countdown state" below), a countdown can never be running when another
Start action would be reachable, so two simultaneous countdowns are not a
representable state.

## Duration

Four presets only: 60, 90, 120, and 180 seconds. Default selection: 90
seconds. There is no free-form entry, no numeric keyboard, and no plus/minus
adjustment control. Invalid duration input cannot occur, because duration is
never typed. The presets are not stated, implied, or labeled as medically
correct, optimal, or recommended; they are simply four common choices.

The selected duration cannot change while a countdown is running. Changing a
running countdown's duration was considered and rejected: it introduces an
unresolved "restart or extend" ambiguity that this smallest useful version
does not need to answer. A person who wants a different duration dismisses
the running countdown and starts a new one.

No duration choice persists. The offer resets to the 90-second default every
time the Workout Session screen mounts. This is a deliberate distinction from
the excluded "persisted rest-duration preferences": component state scoped to
one mount is not durable storage, and this version stores nothing about a
choice beyond the lifetime of the screen instance that made it.

## Countdown state and time calculation

States: `idle`, `running`, `completed`, `dismissed`. `idle` is the initial and
the state after a fresh mount. `start(duration)` transitions `idle` (or
`completed`/`dismissed`) to `running` and computes
`deadlineEpochMs = getCurrentTime() + duration * 1000` once, from an injected
clock function — the same pattern already used by
`FinishWorkoutSessionUseCase`'s constructor-injected `getCurrentTime: () =>
number` (`workout-session-use-cases.ts:288`). `dismiss()` transitions
`running` or `completed` to `dismissed`. Starting again from any terminal
state computes a fresh deadline; there is no separate "restart" transition.

Remaining time is always derived, never accumulated: `remainingMs =
Math.max(0, deadlineEpochMs - getCurrentTime())`, recomputed on every tick
from the fixed deadline rather than decremented from a counter. Reaching
`remainingMs === 0` — not a tick count — is what triggers the `running →
completed` transition. This makes the countdown resistant to a delayed,
throttled, or skipped tick: whenever the next tick does run, it reports true
elapsed time rather than compounding drift.

This state machine and its time-derivation function are implemented as one
small pure module,
`apps/mobile/src/features/workout-session/presentation/rest-countdown.ts`,
framework-independent and covered by Jest tests that supply a fixed clock —
no real timers required for its own unit tests.

## Foreground-only lifecycle

- **Finishing or discarding the workout** unmounts `WorkoutSessionScreen`
  (`onClose` → `router.replace('/workout')`, `active.tsx:7`), which unmounts
  the countdown with it; its interval is cleared in effect cleanup. No
  special-casing is added for this — it is ordinary React unmount behavior.
- **Renaming the workout** pushes a new screen (`onRename` → `router.push(...)`,
  `active.tsx:8-10`) without unmounting `WorkoutSessionScreen`, so a running
  countdown keeps ticking underneath. This is stated here as intended: the app
  has not backgrounded, so the countdown behaves exactly as it does on the
  screen it is still mounted on.
- **The app enters the background** — no `AppState` listener is added; none
  exists anywhere in this app today. The interval may simply not fire while
  backgrounded; nothing is scheduled to run in the background.
- **The app returns to the foreground** — because remaining time is always
  derived from the stored deadline (not accumulated), the next tick after
  resuming reports true elapsed time, including landing directly on
  `completed` if the full duration passed while backgrounded. This is a
  consequence of the time-derivation model, not an added foreground-detection
  feature.
- **The app is terminated** — all in-memory countdown state, including the
  deadline, is destroyed with the process. On relaunch, no countdown UI shows.
  This is intended: the countdown never claims to survive termination, and it
  is safe because the set that offered it was already durably committed to
  SQLite before the countdown could mount (see "Recorded-data non-impact").
- **Recovery after restart** is unaffected.
  `GetActiveWorkoutSessionUseCase.execute()` (`workout-session-use-cases.ts:105-109`)
  reconstructs the active session exactly as it does today; the countdown was
  never part of that read path and holds nothing for it to recover.

## Accessibility

- Start action accessible name: `Start rest timer, {duration} seconds`, one
  per preset button.
- Stop/dismiss accessible name: `Stop rest timer`, one control for both
  stopping a running countdown and dismissing a completed one.
- Remaining time renders as plain text with **no** `accessibilityLiveRegion`,
  so a screen reader reads it only on demand and never announces every tick.
- Completion is announced **exactly once**, through a separate, discrete node
  with `accessibilityLiveRegion="polite"` that changes value one time (empty →
  "Rest complete"), matching the existing one-shot pattern already used at
  `WorkoutSessionScreen.tsx:122-126` and `WorkoutSetForm.tsx:128-131`. The
  ticking numeral never carries a live region.
- Large Dynamic Type is supported through `AppText`'s existing `isSingleLine`
  behavior (shrink rather than wrap or clip,
  `apps/mobile/src/design-system/components/AppText.tsx:44-49`) and the
  existing `maxFontSizeMultiplier={2}` cap.
- Keyboard reachability and focus rings come from the existing `AppButton`
  `Pressable` implementation; no custom control is introduced.
- Starting, stopping, or completing a countdown never moves focus
  programmatically — no precedent for that exists in this codebase, and doing
  so risks disorienting someone still mid set-entry.
- Completion is never signaled by color alone; the "Rest complete" text is the
  signal, and any color accent is additive.
- No animation is used. This is a deliberate choice, not an oversight: it
  removes any need to check `isReduceMotionEnabled` (which nothing in this app
  currently reads), and a countdown communicated by a plainly stated number
  needs no motion.
- The countdown renders in its own labelled region, visually and structurally
  distinct from the `Set N: <result>` sentence format
  (`WorkoutSessionScreen.tsx:166-173`), so it cannot be mistaken for a
  recorded duration-mode set.
- Zero is displayed as `0:00` alongside the one-shot completion text; it never
  blinks or disappears.
- A second Start press cannot occur: Start only renders in `idle`, `completed`,
  or `dismissed`, never in `running` (see "Countdown state"), so there is no
  control to double-press once a countdown is active.

## Recorded-data non-impact

No schema, migration, repository, use case, export, or composition change is
made. The countdown component is constructed with only a duration number and
a dismiss callback — never a `session`, a `sessionId`, or any repository
reference — so it cannot read or write `WorkoutSession`, `WorkoutSet`, session
timestamps, completed history, personal records, Progress, the Workout
Planner, the Exercise Catalog, export, restore, replacement, erasure,
synchronization metadata, or the outbox. It becomes reachable only after
`WorkoutSessionMutationUseCases.addSet`/`updateSet` has already returned a
successful outcome and its transaction has already committed (see "The safe
offer point").

## Failure and recovery

A countdown failure cannot roll back a recorded set: the SQLite write
completes, or the whole mutation fails and throws, entirely inside
`saveSet`/`mutate` before the countdown component could ever mount. The
countdown's own interval is cleared on every terminal transition
(`completed`, `dismissed`) and on component unmount; tests assert
`jest.getTimerCount() === 0` afterward, matching the existing fake-timer
discipline already used in `ExercisePicker.spec.tsx:124-129` and
`ExerciseLibraryScreen.spec.tsx:569-573`. Session completion and abandonment
stop any running countdown only as a consequence of `onClose` unmounting
`WorkoutSessionScreen` — no separate wiring is added for this.

## Performance, privacy, and security

The tick interval is approximately 250 milliseconds, matching the debounce
granularity already used elsewhere in this codebase
(`ExercisePicker.spec.tsx:105-120`), runs only while a countdown is active,
and is cleared immediately on completion, dismissal, or unmount. No timer or
set value is logged. There is no network call, no telemetry, and no new
dependency: the implementation uses only `setInterval`/`clearInterval` and an
injected clock function, consistent with `AGENTS.md`'s preference for
platform and standard-library capabilities. No new personal information is
persisted anywhere.

## Architecture

The countdown state machine and time-derivation function live in one pure,
framework-independent module,
`apps/mobile/src/features/workout-session/presentation/rest-countdown.ts`. No
Vitest coverage is added: Vitest is configured only in
`packages/domain/vitest.config.ts`, and this logic has no cross-runtime
(mobile and API) business rule to share through `@fitness/domain` — it is
mobile-only foreground UI behavior, tested with Jest like every other
presentation module in this feature.

The presentation component,
`apps/mobile/src/features/workout-session/presentation/RestCountdown.tsx`,
holds the interval and renders the offer, the running display, and the
completion state. `WorkoutSessionScreen.tsx` renders it only from the success
branch described in "The safe offer point," passing it nothing beyond a
callback invoked when a countdown becomes available.

No application-layer use case, global context, singleton, or new shared
package is introduced. This boundary was chosen deliberately over those
alternatives: nothing here touches a repository, a transaction, or a
persisted domain type, so an application-layer use case would have no
persistence or orchestration to perform; and this capability has exactly one
consumer, so a shared timer service or package would be premature
abstraction with no second consumer to justify it.

## Testing

- **Pure module** (`rest-countdown.spec.ts`, Jest, fixed injected clock, no
  real timers): initial `idle` state; `start` transitions to `running` with
  the correct deadline for a given clock and duration; `remainingMilliseconds`
  at values before start, during the run, and past the deadline (clamped at
  zero); reaching the deadline transitions to `completed` exactly once;
  `dismiss` from `running` or `completed` returns to `idle`; starting again
  from a terminal state computes a fresh deadline.
- **Component** (`RestCountdown.spec.tsx` plus additions to
  `WorkoutSessionScreen.spec.tsx`, Jest, `jest.useFakeTimers()` /
  `useRealTimers()` following the existing convention in
  `ExercisePicker.spec.tsx` and `ExerciseLibraryScreen.spec.tsx`): the rest
  offer appears only after a successful `addSet`/`updateSet` outcome and never
  after a rejected one; pressing a preset Start button shows remaining time
  and a Stop control; `jest.advanceTimersByTime` to the deadline shows "Rest
  complete" exactly once, with the live-region assertion targeting only that
  node; Stop/dismiss while running clears the countdown; unmounting mid-run
  leaves `jest.getTimerCount() === 0`; no mutation use case is ever invoked by
  a countdown interaction; the existing Finish/Discard flow tests gain an
  added assertion that no timer is leaked.
- **Manual, physical device**: the existing critical smoke checklist
  (`docs/manual-testing/README.md`) plus a new capability checklist —
  completion announced once, not per tick; largest Dynamic Type; backgrounding
  mid-countdown then returning to the foreground shows an honest state with no
  notification; recorded sets remain intact after backgrounding during a
  countdown; VoiceOver/TalkBack names for Start and Stop.
- Not proposed: Maestro, simulator, emulator, or any automated UI
  sprint/regression suite, per [ADR 0033](../docs/decisions/0033-risk-based-manual-device-testing.md).
  Coverage percentage is not a completion gate.

## Documentation

- This specification.
- `docs/architecture/offline-workout-sessions.md`, whose "Encryption, charts,
  advanced analytics, advanced sets, timers, and synchronization remain
  deferred" line is corrected to describe the shipped foreground-only
  countdown and link here.
- `docs/product-roadmap.md`, recording the shipped capability under Phase 4
  with a material-change-log entry. Phase 4 does not exit: its stated exit
  criterion is broader than a rest countdown alone.
- `README.md`'s current-status paragraph.
- `docs/manual-testing/sprint-46-foreground-rest-timing.md`, the new
  capability checklist.
- `specs/0013-offline-workout-sessions.md`'s exclusion list, amended with a
  pointer to this specification rather than a rewrite of its history.

## Explicit exclusions

Persisted rest-duration preferences; a rest-duration field on Exercise
Definition, Planned Exercise, or a recorded set; a database migration; an
export-format change; restore-parser changes; synchronization metadata or
outbox changes; cloud synchronization; notifications, local or push;
native alarms; sound, vibration, or haptic behavior; background timers or
background tasks; lock-screen controls; Dynamic Island or live activities;
watch integration; automatic exercise advancement, automatic set creation, or
automatic set completion; automatic timer start; RPE or RIR; estimated
one-repetition maximum; supersets, circuits, or grouped sets; progression
schemes; coaching, medical advice, or prescribed recovery durations;
AI-generated durations or recommendations; analytics, telemetry, achievements,
or streaks; a generic or reusable timer service; a process-wide timer
singleton; a new primary tab; any new external dependency; Maestro; simulator
or emulator automation; automated UI sprint or regression suites.

A natural extension — a per-exercise default rest duration stored on
`ExerciseDefinition` — is recorded as a future candidate in
[the product roadmap](../docs/product-roadmap.md#training-depth-direction-provisional)
and is explicitly not this version's scope.

## Unresolved questions

None. This specification settles the interaction, duration, state model,
lifecycle, accessibility, and architecture questions the product roadmap's
Sprint 45 discovery left open for Phase 4's first candidate.

The repository owner approved the Stage 1 design and requested staged,
commit-by-commit implementation on 2026-08-25.
