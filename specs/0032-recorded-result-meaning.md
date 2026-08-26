# Specification 0032: Recorded result meaning

- Status: Approved
- Date: 2026-08-18
- Amended: 2026-08-26, to note that "RPE," excluded below, now has an
  approved recorded-observation counterpart in reps in reserve (RIR). See
  [Specification 0046](0046-record-reps-in-reserve.md).

## Objective and scope

Make every displayed recorded and planned result state what its number means.

Five domain result variants serve the eight logging modes the domain defines.
Three of those modes — `external-load-and-repetitions`,
`bodyweight-plus-load-and-repetitions`, and `assistance-and-repetitions` — share
one `ResistanceRepetitionResult`, so a stored result cannot carry the meaning of
its own mass. Until version 1, `formatWorkoutResult` took only the result and the
unit system, and so was structurally incapable of telling them apart: twenty
kilograms lifted, twenty kilograms added, and twenty kilograms of assistance all
rendered `20 kg × 8`.

Version 1 passes the captured logging mode into the two result formatters and
words a resistance value according to it. Nothing else changes.

`@fitness/domain`, every migration, user version 11, export format version 1, the
reader contract, every use case, every composition root, the Exercise Catalog and
its filtering, all three pickers, personal records, correction, removal, and
addition are untouched. No stored value, result kind, record, tie, or evidence
link changes.

Charts, Progress redesign, per-set notes, set types, editing a completed set's
logging mode, new record categories, and localization remain excluded.

## The gap this closes

[Specification 0031](0031-assisted-repetition-records.md) gave assisted work a
personal record that says exactly what it claims: "Least recorded assistance in a
set". Opening the workout that proves it showed `Set 1: 20 kg × 8` — the same
sentence a bench press produces for twenty kilograms lifted.

The data was never wrong and nothing was lost. A person who remembers how they
configured the exercise can infer the meaning. The application simply declined to
say it, on the three screens where saying it matters most, while saying it
everywhere else:

- `WorkoutSetForm` labels the field `Assistance (kg)`, `Added weight (kg)`, or
  `Weight (kg)`.
- `PlannedWorkoutEditorScreen` labels it `Assistance amount`, `Added weight`, or
  `Planned weight`.
- `ExercisePerformanceHistoryScreen.formatPerformance` already writes
  `maximum assistance` or `maximum resistance` from `loggingModeSnapshot`.

This is a missing-parameter defect, not a domain modelling defect.
[ADR 0017](../docs/decisions/0017-deterministic-workout-personal-records.md)
already established that the result variant cannot carry record meaning and that
the captured logging mode is what partitions it. Personal records applied that
rule. The set-rendering path never did.

## The rule

**The unmarked sentence means load lifted. Only a mode that deviates from that is
marked, and the mark leads.**

A mass beside repetitions conventionally means the mass that was lifted, so
`external-load-and-repetitions` needs no qualifier and does not get one. The two
modes whose mass means something else are marked.

The qualifier leads rather than trails because a set row truncates from the end
at the largest accessible text size. A trailing qualifier is the first thing
lost — `20 kg assis…` — while a leading one degrades to `Assistance 20 kg…`,
keeping the meaning and the number. It also places the distinguishing word first
for a screen reader, rather than qualifying an ambiguous mass three words later.

## Wording, recorded

The same set — twenty of the unit, eight repetitions — under each of the eight
logging modes.

| Logging mode                           | Before                 | After                   |
| -------------------------------------- | ---------------------- | ----------------------- |
| `repetitions`                          | `8 reps`               | `8 reps` (unchanged)    |
| `bodyweight-and-repetitions`           | `8 reps`               | `8 reps` (unchanged)    |
| `external-load-and-repetitions`        | `20 kg × 8`            | `20 kg × 8` (unchanged) |
| `bodyweight-plus-load-and-repetitions` | `20 kg × 8`            | `Added 20 kg × 8`       |
| `assistance-and-repetitions`           | `20 kg × 8`            | `Assistance 20 kg × 8`  |
| `duration`                             | `1 min 30 sec`         | unchanged               |
| `distance`                             | `5 km`                 | unchanged               |
| `distance-and-duration`                | `5 km in 1 min 30 sec` | unchanged               |

In imperial the unit label is `lb` and `mi`; the qualifier is identical.

## Wording, planned

A planned target is in scope. A card reading `Planned: 3 sets · 8 reps · 20 kg`
above `Set 1: Assistance 20 kg × 8` contradicts itself, and both sentences are
composed from the same exercise on the same screen.

| Logging mode                           | Before                         | After                                |
| -------------------------------------- | ------------------------------ | ------------------------------------ |
| `repetitions`                          | `3 sets · 8 reps`              | unchanged                            |
| `bodyweight-and-repetitions`           | `3 sets · 8 reps`              | unchanged                            |
| `external-load-and-repetitions`        | `3 sets · 8 reps · 20 kg`      | unchanged                            |
| `bodyweight-plus-load-and-repetitions` | `3 sets · 8 reps · 20 kg`      | `3 sets · 8 reps · Added 20 kg`      |
| `assistance-and-repetitions`           | `3 sets · 8 reps · 20 kg`      | `3 sets · 8 reps · Assistance 20 kg` |
| `duration`                             | `3 sets · 1 min 30 sec`        | unchanged                            |
| `distance`                             | `3 sets · 5 km`                | unchanged                            |
| `distance-and-duration`                | `3 sets · 1 min 30 sec · 5 km` | unchanged                            |

A planned resistance is optional. When absent, the part is omitted entirely
rather than rendering a qualifier with no value.

## Vocabulary

The display vocabulary matches the entry surfaces rather than inventing a third
one. `Assistance` is the word `WorkoutSetForm` and `PlannedWorkoutEditorScreen`
already use. `Added` is the trim of `Added weight`: the unit label already says
weight, so repeating it stutters, and the shorter form keeps the row narrower on
screens that list many sets.

No symbol is used. `+20 kg` and `−20 kg` are compact but announce as "plus" and
"minus" rather than as a meaning, and neither says which of the two directions is
assistance.

The wording makes no claim about physiology, effort, difficulty, or progression.
It states only what the stored mass is.

## Ownership

`formatWorkoutResult` and `formatPlannedWorkoutResult` take the captured logging
mode as a required parameter.

Composing the wording at each call site would keep the formatter narrow and
repeat the decision three times, and the repository already shows what that
produces: `ExercisePerformanceHistoryScreen` invented `maximum assistance`
inline, because the shared formatter had no way to express it. One total function
over eight modes is one place to get it right when a ninth mode is added.

The formatter stays in `workout-session/presentation`. The cross-capability
import from `workout-history` predates this change and is unchanged by it; moving
the module would be refactoring this change does not require.

`@fitness/domain` does not gain this vocabulary. It owns the modes and the result
variants, not presentation, and there is exactly one consumer. ADR 0017 refused
the same move for record labels and that reasoning still applies.

`ExercisePerformanceHistoryScreen.formatPerformance` keeps its own wording. It
words an aggregate over a period — "maximum assistance" across many sets — not a
single recorded result, so it is not the same sentence.

## Undescribed logging modes

`ExerciseLoggingMode` is a closed union, so a mode this version does not word is
only reachable through data older or newer than the code. The formatter falls
back to the unmarked sentence, which states nothing false: it reports the stored
mass and repetitions without claiming what the mass means.

A session exercise whose `logging_mode_snapshot` disagrees with its stored
`result_kind` renders the result variant it actually holds. A repetitions-only
result under an assistance mode renders `8 reps`, with no qualifier and no
invented mass.

## Error model

Nothing is written and nothing new can fail. Formatting is a pure function of a
loaded snapshot. The existing fixed-sentence failures on each screen are
unchanged, and none contains SQL, table names, identifiers, internal paths, or
stack traces.

## Experience and accessibility

Three screens change what they display:

- **Active workout session** — `Set N: <result>` and `Planned: <target>`.
- **Completed workout detail** — `Performed set N: <result>` and
  `Planned: <target>`.
- **Correction** — `Currently recorded set N: <result>` and
  `Planned target: <target>`.

No control label, heading, empty state, or alert changes. No control is added.

Each set row keeps its role, its controls, and their accessible names: `Edit set
N for <exercise>`, `Delete set N for <exercise>`, and `Correct recorded set N for
<exercise>` are unchanged, because they name the set by number and exercise
rather than by its value. The row's visible text is its accessible content, so
the announced sentence and the read sentence stay identical.

The longest wording is `Assistance 20 kg × 8` under `Set 1: `. The set row wraps
rather than truncates — it is a `flexWrap: 'wrap'` row — so at the largest
accessible text size the qualifier and value move onto their own lines and the
Edit and Delete controls move below them, keeping their minimum touch targets.
Rows therefore grow taller for the two marked modes, which pushes controls below
them further down on all three screens.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, or dependency is involved. No
SQL is issued. Nothing is logged.

Formatting stays synchronous and allocation-light: one extra branch and one
string concatenation per resistance result, on screens that already format every
row they render. No new render is introduced.

## Data lifecycle

Stored sets, result kinds, and logging mode snapshots are byte-identical.
Personal records, their categories, values, ties, and evidence are unaffected.
History, Progress, the Planner's stored data, and the Exercise Catalog are
unaffected. Export, restore, erasure, and replacement are unaffected — no
exported field carries this wording, and export format version 1 is unchanged.

A set recorded before this change reads correctly after it, because the meaning
was always in the captured snapshot and only the rendering ignored it.

## Verification and completion

Automated coverage:

- every one of the eight logging modes produces its stated recorded sentence,
  asserted exhaustively against `exerciseLoggingModes` rather than a hard-coded
  list, in both unit systems;
- the same, for planned targets;
- the three modes sharing `ResistanceRepetitionResult` produce three different
  sentences, all containing the same mass and repetitions;
- a mode the formatter does not word falls back to the unmarked sentence;
- a mode that disagrees with the stored result variant states nothing false;
- `WorkoutSessionScreen` gains its first specification, covering the session, its
  planned line, its recorded sets, the empty state, adding a set, editing a set,
  the accessible names of set controls, and the no-active-workout and load
  failure states;
- the completed detail and correction screens render the new wording, and an
  assisted set and an added-load set of the same mass are distinguishable on
  every screen that shows both;
- every pre-existing assertion that did not concern this wording passes
  unmodified.

End-to-end coverage rewrites the four files that assert the bare sentence, adds a
Sprint 32 suite, and adds one regression scenario.

## Explicit exclusions

New or changed personal record categories; one-repetition-maximum estimation or
strength scoring; per-set notes, tags, RPE, rest timers, or set types; editing a
completed set's logging mode; charts; Progress redesign; achievements, streaks,
or adherence; coaching, progression advice, or medical interpretation; starter
Workout Plans; starter content changes; onboarding; localization; export format
changes; cloud synchronization; authentication; backend endpoints; AI;
notifications; dependency upgrades; repository-wide refactoring.
