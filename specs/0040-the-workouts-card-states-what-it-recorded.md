# Specification 0040: The Workouts card states what it recorded

- Status: Approved
- Date: 2026-08-22

## Objective and scope

Make the Progress Workouts card state every dimension of work its read model
already carries, so a person whose training is not measured in repetitions can
learn what they did in a period.

The card reads an eight-field model and states five of its fields. The three it
withholds — performed duration, performed distance, and recorded load volume —
are summed by the statement the card's use case already runs, typed on the model
the card already reads, and rendered on Workout History instead.

Version 1 adds two conditional metrics and one conditional sentence to one
component. Two visible strings are added, both labels drawn from Workout
History's existing vocabulary. No visible string changes.

`@fitness/domain`, `apps/api`, every migration, user version 11, every index,
export format version 1, every reader contract, every SQL statement,
`WorkoutProgressSummary`, `progress-models.ts`,
`GetProgressSummaryUseCase`, every composition root, Workout History, exercise
performance history, personal records, correction, deletion, removal, addition,
naming, the active workout session, the Exercise Catalog, the Workout Planner,
every daily screen, every target, and body measurements are untouched. No stored
value, session, set, result kind, record, tie, or evidence link changes, and no
total's numeric value changes.

Charts, a Progress redesign or re-layout, a sub-heading or disclosure control
inside a Progress card, renaming `Workout time`, adherence, streaks, a custom
date range, versioned targets, searching history by name, starter Workout Plans,
coaching, localization, export format changes, cloud synchronization,
authentication, AI, and notifications remain excluded.

## The gap this closes

`WorkoutHistorySqliteRepository.summarizeCompletedRange` produces eight values.
`GetProgressSummaryUseCase` passes the whole object through as `summary.workout`.
`ProgressScreen`'s `WorkoutSummary` renders five of them.

| Field                                   | Computed | Progress Workouts card | Workout History summary                               |
| --------------------------------------- | -------- | ---------------------- | ----------------------------------------------------- |
| `completedWorkoutCount`                 | yes      | `Completed workouts`   | `2 completed workouts`                                |
| `actualSetCount`                        | yes      | `Actual sets`          | `6 actual sets`                                       |
| `performedExerciseCount`                | yes      | `Performed exercises`  | `2 performed exercises`                               |
| `elapsedWorkoutSeconds`                 | yes      | `Workout time`         | `45 min 0 sec workout time`                           |
| `repetitions`                           | yes      | `Repetitions`          | `24 repetitions`                                      |
| **`durationSeconds`**                   | **yes**  | **nowhere**            | `30 min 0 sec performed duration`                     |
| **`distanceMillimeters`**               | **yes**  | **nowhere**            | `5 km performed distance`                             |
| **`recordedLoadVolumeGramRepetitions`** | **yes**  | **nowhere**            | `160 kg-reps recorded load volume from weighted sets` |

The consequence is specific to who is reading. Somebody whose training is
running, rowing, cycling, or a timed hold opens Progress and sees a session
count, a set count, an exercise count, and a wall-clock time. Not one of those
says how far or how long they actually worked, and `Workout time` — which is
`completed_at` minus `started_at`, summed — invites being read as training
volume by a reader who has nothing else to read. Somebody lifting sees no volume
at all on the tab named Progress.

## This is a defect, and a milder one than Sprint 38's

Both halves of that sentence matter, and the second one is why this document
states the case rather than assuming it.

Four pieces of evidence make it a defect rather than a curation.

**[Specification 0016](0016-progress-analytics-and-qa-reporting.md) is Approved
and promises them on this screen.** Its analytics behavior section states that
the selected period presents "Completed workout count, performed exercise count,
actual set count, elapsed session time, and logging-mode-eligible result totals."
Repetitions is one such total. Performed duration, performed distance, and
recorded load volume are the other three, and "logging-mode-eligible" is the
phrase for the `CASE` on `logging_mode_snapshot` that produces the last of them.
Three of the four promised totals are unrendered.

**Two live documents already claim the opposite of the code.** The
[offline Progress architecture](../docs/architecture/offline-progress-analytics.md)
states "Every value the summary computes is a value the screen states." The
[mobile development guide](../docs/mobile-development.md) states "Every value the
summary computes is displayed." Both were true of nutrition and hydration when
written and were never true of workouts. A curated presentation subset does not
leave two documents asserting it does not exist.

**No document argues for withholding them.** Specification 0038 excludes "fiber,
sugar, and sodium in Progress" and says nothing about workout dimensions.
Specification 0039 excludes none. Specification 0033 excludes a "Progress
redesign", which this is not. `ProgressScreen.tsx` comments its other omissions
carefully — why an average is omitted rather than defaulted, why the
completeness sentence is conditional — and says nothing here.

**[ADR 0028](../docs/decisions/0028-a-summary-states-every-value-it-computes.md)
reaches it at screen granularity, with deletion foreclosed.** Its rule is that a
value an application computes for a screen is a value that screen states, or it
is a value the application does not compute. The Progress screen computes all
three on every load and states none. Of the rule's two exits, deletion is closed:
the fields come from one shared statement and Workout History renders all three,
so removing them would break a second capability to satisfy a rule about a third.

The discount is real and is recorded rather than buried. These three values are
**reachable**. A person can open Workout, then Workout History, and read all
three; since Specification 0033 a screen-reader user hears them too, because that
card's accessible name carries every sentence it displays. Sprint 38's five
values were reachable by nobody. And ADR 0028's own audit scoped itself to values
displayed nowhere — a grep finding them "in the use case and the model and
nowhere else" — which does not hold here.

That gap is what
[ADR 0030](../docs/decisions/0030-a-value-is-stated-by-every-screen-that-computes-it.md)
records: a value is stated by every screen that computes it, not by one screen
somewhere.

## What the card presents after this change

The card carries no `accessibilityLabel`, so every line below is its own
accessibility element.

A period with no completed workouts is unchanged:

```
Workouts
No completed workouts in this period.
```

A period with completed workouts, in render order:

| Line                  | Condition                              | Example                                               |
| --------------------- | -------------------------------------- | ----------------------------------------------------- |
| `Completed workouts`  | always                                 | `3`                                                   |
| `Actual sets`         | always                                 | `9`                                                   |
| `Performed exercises` | always                                 | `4`                                                   |
| `Workout time`        | always                                 | `2 hr 15 min`                                         |
| `Repetitions`         | `repetitions !== null`                 | `96`                                                  |
| `Performed duration`  | `durationSeconds !== null`             | `45 min 0 sec`                                        |
| `Performed distance`  | `distanceMillimeters !== null`         | `12.5 km`                                             |
| coverage sentence     | volume present                         | `160 kg-reps recorded load volume from weighted sets` |
| coverage sentence     | volume absent and `actualSetCount > 0` | `No recorded load volume from weighted sets`          |
| no sentence           | `actualSetCount === 0`                 | —                                                     |

Seven metrics at most, plus one sentence. Not eight metrics: recorded load volume
is a sentence rather than a metric, for the reason below.

**Nothing above `Repetitions` moves.** The three additions are appended after the
card's current last line. That is deliberate: four end-to-end scenarios anchor on
`Performed exercises, N` and assert siblings from that viewport, and appending
below the anchor leaves every one of those positions identical.

**The order is Workout History's `summarySentences` order, exactly.** After this
change the two surfaces state the same eight values in the same sequence in the
same vocabulary — Workout History as sentences inside one announced card,
Progress as individually navigable metrics.

## Recorded load volume is a sentence, not a metric

[ADR 0023](../docs/decisions/0023-displayed-totals-state-their-coverage.md)
requires that a displayed total "either covers every recorded thing of its own
dimension, or states its coverage in the sentence that carries it". Recorded load
volume sums `external-load-and-repetitions` and
`bodyweight-plus-load-and-repetitions` and nothing else, so it is the one total
here that must state coverage.

A `Metric` composes `label, value` into one accessible element. Rendering
`Recorded load volume | 160 kg-reps` and putting the coverage in a separate
caption would detach the claim from the number, which is exactly what ADR 0023
forbids, and it would invent a second visible string saying what the shipped
sentence already says. So the value is rendered as the sentence that carries it,
using the same two strings Workout History already ships:

- `formatRecordedLoadVolumeSummary(gramRepetitions, unitSystem)` —
  `160 kg-reps recorded load volume from weighted sets`
- `absentRecordedLoadVolumeMessage` —
  `No recorded load volume from weighted sets`

Neither is new, neither is reworded, and neither is copied. Specification 0033
already settled why: "the same coverage worded two ways is two claims." A
trailing caption is also the established shape on this screen — the Nutrition
card and the Body weight card both end with one.

Performed duration and performed distance need no such sentence. Specification
0033's audit table already establishes that each is full over its own dimension:
performed duration counts "every mode that records duration", performed distance
"every mode that records distance". A total that excludes nothing has nothing to
state.

## Every dimension gets a line, and no rule says otherwise

Whether recorded load volume belongs on this card at all was decided the way
[ADR 0029](../docs/decisions/0029-a-captured-value-is-a-value-a-summary-can-state.md)
decided the nutrient averages: by trying to write the rule that would exclude it
and watching the rule fail.

"A total that needs a coverage caveat is too expensive for this card" fails
immediately: the caveat is one line, the card already ends with captions on two
of its four siblings, and Specification 0033 established that stating the
dimension in both directions makes the line's presence independent of the
fixture. "Only dimensions a majority of users record" is a description of a
guess, not a rule. "Only dimensions Workout History does not already show" would
exclude all three and defeat the sprint.

So all three are stated. The rule a fifth dimension inherits: **state every
dimension the read model carries; a total full over its dimension is a bare
metric, and a partial one carries ADR 0023's sentence in both directions.**

## Height varies with the fixture, deliberately

| Period                     | Lines                           |
| -------------------------- | ------------------------------- |
| No completed workouts      | 1 sentence                      |
| Completed workout, no sets | 4 metrics, no coverage sentence |
| Repetitions only           | 5 metrics + absent sentence     |
| Duration only              | 5 metrics + absent sentence     |
| Distance and duration      | 6 metrics + absent sentence     |
| Weighted lifting           | 5 metrics + covered sentence    |
| All four dimensions        | 7 metrics + covered sentence    |

The card already varied, because `Repetitions` is already conditional. The
alternative is rendering a zero or a dash for a dimension the period did not
record, and `0 km performed distance` is a false claim about a week of
deadlifts — the untruth ADR 0023 and ADR 0028 both forbid and that Specification
0033 rejected in the same words for `0 kg-reps recorded load volume`.

The coverage sentence is the one line that does **not** vary with what was
recorded: it renders in one form or the other for every period holding a set.
Bringing ADR 0023's both-directions wording to Progress imports the closure
Specification 0033 achieved on Workout History, not the trap it closed.

Mitigation lives entirely in the harness and not in the product. Every Sprint 40
scenario scrolls to what it asserts, every negative assertion is made from the
viewport where its subject would render, and the one pre-existing negative
assertion beneath this card is rewritten to anchor on the line its subject
occupies rather than on the card's former last line.

## `Workout time` is not renamed, and the ambiguity is recorded

`Workout time` is elapsed wall-clock session length. `Performed duration` is the
sum of recorded set durations. Both are formatted by `formatDuration` and both
read `X min Y sec`, and after this change they sit two lines apart. That is a
naming ambiguity this change creates, and Specification 0016's own vocabulary for
the first — "elapsed session time" — is the unambiguous form the card does not
use.

It is not renamed here, for three reasons. Renaming on Progress alone would make
the two screens disagree about one field's name, which is the defect
Specification 0033 avoided when it took the per-exercise wording from the same
function. Renaming on both screens would change `Workout progress summary`'s
accessible name, which ADR 0023 shipped and which the end-to-end guide documents
as the worked example of a card-name assertion — blast radius beyond this
change's goal. And the ambiguity is materially reduced by the new line existing:
a lone duration invites being read as training volume, while two durations, one
explicitly named `Performed duration`, disambiguate by contrast.

Recorded here as a known limitation, with a concrete proposal for whoever takes
it: `Workout time` becomes `Elapsed session time` on Progress and
`… workout time` becomes `… elapsed session time` on Workout History, in one
change, with the end-to-end guide's example updated.

## Formatting, and why nothing moves

Three formatters already exist and all three are reused.

| Value       | Function                                                              | Owner                          |
| ----------- | --------------------------------------------------------------------- | ------------------------------ |
| Duration    | `formatDuration(seconds)`                                             | `workout-session/presentation` |
| Distance    | `formatRecordedDistance(millimeters, unitSystem)`                     | `workout-history/presentation` |
| Load volume | `formatRecordedLoadVolumeSummary` / `absentRecordedLoadVolumeMessage` | `workout-history/presentation` |

Reaching across a capability boundary for them is the established pattern on this
screen rather than a new one: `ProgressScreen` already imports `formatDuration`
from Workout Session and `formatBodyWeight`, `formatBodyWeightChange`, and
`getBodyWeightDisplayUnit` from Body Measurement History.
[ADR 0011](../docs/decisions/0011-cross-capability-derived-progress-analytics.md)
defines Progress as a read composer over capability-owned sources, and presenting
a capability's value with that capability's formatter is what that means.

`progress-formatting.ts` gains nothing. Writing a Progress-local distance or
volume formatter would be the second formatting path Sprint 30 spent a sprint
removing and ADR 0028 refused again.

## Both unit systems

`ProgressSummary.preferredUnitSystem` already exists, is already sourced from the
profile by the use case, and is already consumed by the Body weight card.
`WorkoutSummary` reads it from the same object. No model field is added.

| Line                  | Metric                                                | Imperial                                                 |
| --------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `Completed workouts`  | `3`                                                   | `3`                                                      |
| `Actual sets`         | `9`                                                   | `9`                                                      |
| `Performed exercises` | `4`                                                   | `4`                                                      |
| `Workout time`        | `2 hr 15 min`                                         | `2 hr 15 min`                                            |
| `Repetitions`         | `96`                                                  | `96`                                                     |
| `Performed duration`  | `45 min 0 sec`                                        | `45 min 0 sec`                                           |
| `Performed distance`  | `12.5 km`                                             | `7.77 mi`                                                |
| Coverage, present     | `160 kg-reps recorded load volume from weighted sets` | `352.74 lb-reps recorded load volume from weighted sets` |
| Coverage, absent      | `No recorded load volume from weighted sets`          | identical                                                |

Duration is unit-system independent. Distance and load volume convert through
`Length` and `Mass` in `@fitness/domain` at two fraction digits. Nothing stored
converts; the preference changes only how a canonical number is written.

## No SQL, reader, model, or use case change

Proven from the statement and the types rather than asserted.

`summarizeCompletedRange` already sums all three inside its `actual_totals` CTE
and already projects them into the outer `SELECT` as `duration_seconds`,
`distance_millimeters`, and `recorded_load_volume`. `WorkoutProgressSummary`
already declares all eight fields, so neither `WorkoutHistoryRepository` nor
`ProgressWorkoutReader` widens. `GetProgressSummaryUseCase` already spreads the
reader's object into `ProgressSummary.workout` with no projection, so every
existing consumer is preserved. `progress-models.ts` gains and loses nothing. No
composition root is rewired. No test double changes: the `ProgressWorkoutReader`
fake already returns all eight fields.

Exactly one production source file changes for the feature. One more changes for
testability only, described below.

## No migration, and the index that proves it

No statement is added, removed, or altered, so there is no plan to change and
nothing to measure. The schema stays at user version 11 with eleven migrations.

For completeness on the statement that already runs: the `completed` CTE
predicates on `status = 'completed' AND started_local_calendar_date BETWEEN ? AND ?`,
served by `workout_session_completed_local_date`, whose leading columns are that
pair — the same index the completed-page reader cites for its seek. The remaining
CTEs join by foreign key. Every parameter stays bound.

## Two set-form identifiers, for testability only

The set form's duration and distance fields carry no `testID`. `TextField`
renders its label as text and puts the same string on the input's accessible
name, so `Duration (seconds)` matches two elements and choosing one is a
coincidence rather than a selector — the reasoning that made Sprint 38 add
`nutrition-protein-input` and its two siblings.

`WorkoutSetForm` therefore gains `workout-set-duration-input` and
`workout-set-distance-input`, matching the existing
`workout-set-resistance-input` and `workout-set-repetitions-input`. No visible
string, label, validation, keyboard type, layout, or behavior changes. Without
them the two dimensions this change exists for could not be proven end to end.

## Error model

Nothing is written, no query changes, and formatting is a pure function of a
loaded summary, so no new failure is reachable.

Safe outcomes: a period recording every dimension renders seven metrics and the
covered sentence; a period recording exactly one dimension renders that
dimension's line and the sentence appropriate to its load; a period recording
sets but none eligible renders `No recorded load volume from weighted sets`; a
period holding a completed workout with no sets renders four metrics and no
sentence; a period with no completed workouts renders
`No completed workouts in this period.` and nothing else.

A reader that fails mid-load replaces the whole screen with the existing labelled
error subtree — `Progress unavailable`,
`Progress could not be loaded from this device.`, and `Try Again` — so no stale
value is announced. A corrupt row is rejected by the repository's existing
`nonnegativeInteger`, `nullableNonnegative`, `requiredDate`, and `requiredId`
guards, which raise `PersistenceError('operation-failed')` and reach the same
fixed sentence. Every sentence involved is pre-existing and contains no SQL,
table name, identifier, internal path, or stack trace.

## Experience and accessibility

One card changes what it displays. No control, heading, empty state, or alert
changes, and none is added.

The Progress summary cards deliberately carry no `accessibilityLabel`, so each
metric stays its own element announcing `label, value` and the coverage sentence
is its own stop. Three accessible names are added and none is changed:

- `Performed duration, 45 min 0 sec`
- `Performed distance, 12.5 km`
- `160 kg-reps recorded load volume from weighted sets`, or
  `No recorded load volume from weighted sets`

Stops across the four summary cards, worst case — a logged day with an incomplete
nutrient, hydration, all four workout dimensions, and two check-ins:

| Card        | Before | After  |
| ----------- | ------ | ------ |
| Nutrition   | 18     | 18     |
| Hydration   | 8      | 8      |
| Workouts    | 6      | **9**  |
| Body weight | 6      | 6      |
| Total       | 38     | **41** |

Three stops, all on one card. A repetitions-only period gains one. A period with
no workouts gains none.

No `Card` is added, so Sprint 34's guarantee — 56 card usages, 19 labelled, none
of the 19 holding a control — is unchanged, and this card stays unlabelled
because it must: labelling it would hide every metric it exists to state, which
is [ADR 0024](../docs/decisions/0024-labelled-containers-announce-their-contents.md)'s
rule read in the direction that matters here.

Each metric is a wrapping row, so a label and value that cannot share a line
stack rather than truncate. The coverage sentence is plain text with no line
limit inside a column-laid-out card, so at the largest accessible text size it
wraps and the card grows taller, keeping the number and the qualifier both
readable — the behavior Specification 0033 already shipped for the identical
sentence.

What this document does not claim is that a screen carrying a sixteen-metric
Nutrition card and a nine-stop Workouts card is comfortable at the largest
accessible size. Nobody has measured it. ADR 0029 recorded that the measurement
is what authorizes a layout change, so the Sprint 40 manual pass counts stops on
both cards at that size and records the number. If that pass finds the screen
unusable, the honest next step is a Progress card-grouping change, and this
document does not perform one under its own authority.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, background work, or dependency.
No SQL text changes and every existing parameter stays bound. Nothing is logged.

Per render: two additional pure formatter calls and one string concatenation,
only when the corresponding value is non-null. Both functions are already called
once per Workout History render. No additional read, query, render pass, effect,
or memoization.

## Data lifecycle

Stored sessions, sets, result kinds, and logging mode snapshots are
byte-identical, and every total's numeric value is unchanged. Personal records,
their categories, values, ties, and evidence are unaffected. Export, restore,
erasure, and replacement are unaffected: no derived period summary has ever been
exported, no exported field carries this wording, and export format version 1 is
unchanged. Correction, deletion, removal, addition, and naming change no
behavior. Data recorded before this change reads correctly after it, because
nothing about how it is stored or aggregated changed — only which of the
already-computed aggregates one screen prints.

## Derived behavior

- **Progress Workouts card** — two conditional metrics and one conditional
  sentence. The only surface whose content changes.
- **Progress Nutrition, Hydration, and Body weight cards** — unchanged in
  content. Body weight and Daily activity sit lower on the page when the Workouts
  card grows.
- **Daily activity** — unchanged; `WorkoutProgressDay` carries only counts and is
  not read here.
- **Workout History** — unchanged. Its summary renders and announces the same
  eight sentences in the same order.
- **Exercise performance history** — unchanged, including its deliberately silent
  absent load-volume case.
- **Personal records, the active workout session, correction, deletion, removal,
  addition, naming, the nutrition diary, the hydration daily screen, Goals &
  Energy, body measurements** — unchanged. The active session's set form gains
  two identifiers and no behavior.

## Verification and completion

Automated coverage:

- each new line renders with its exact text when the period recorded that
  dimension, in both unit systems for distance;
- each new line is absent when the period did not, asserted as a negative;
- the coverage sentence renders in one form or the other whenever the period
  recorded any set, and in neither when it recorded none;
- a period recording sets but no eligible load renders the covered sentence with
  the number removed, in its exact wording;
- a period recording every dimension renders exactly seven metrics and one
  sentence, asserted by count;
- the empty-period state is unchanged;
- the Nutrition and Hydration cards render unchanged against the pre-existing
  fixture, and every pre-existing assertion in the Progress presentation suite
  passes unmodified;
- Workout History's own rendering of the same three values is unchanged, proven
  by its suite being unedited and green;
- export output is unchanged, proven the same way;
- the workout summary reaches `ProgressSummary` field for field.

Tests that pin existing behavior rather than proving new behavior are labelled as
pins, because a test that would pass against the previous commit is not evidence.

End-to-end coverage adds a Sprint 40 suite of three scenarios, one regression
scenario carrying all four dimensions at once, and two reusable flows. Three
claims become assertable that could not be stated before: on Workout History
these values sit inside a card carrying an `accessibilityLabel`, so no individual
line can be matched, while on Progress each is plain text.

Manual QA covers each dimension alone and all four together, an assisted-only
period whose load is ineligible, a completed workout with no sets, Day, Week and
Month, both unit systems, a value-by-value comparison against the Workout History
summary, VoiceOver and TalkBack stop counts on both the Nutrition and Workouts
cards, keyboard focus order, Dynamic Type at the largest accessible size,
unchanged export output, and data recorded before the change read after it.

Repository formatting, lint, type checking, tests, and builds pass without
warnings.

## Explicit exclusions

Charts and any graphical presentation; a Progress redesign, re-layout,
sub-heading, or disclosure control; renaming `Workout time`; changing how any
total is calculated; making assistance contribute to load volume; a second
volume-like measure; widening any reader contract; adherence against the
calculated calorie target; streaks, achievements, badges; a custom date range or
calendar picker; versioned hydration or calorie targets; searching history by
name; starter Workout Plans; coaching, dietary advice, or medical interpretation;
onboarding; localization; export format changes; cloud synchronization;
authentication; backend endpoints; AI; notifications; broad dependency upgrades;
repository-wide refactoring; unifying the four time navigators; renaming the
`Snapshot`-suffixed projected fields; unit tests for the four screens that still
have none.
