# Specification 0033: Summary total coverage

- Status: Approved
- Date: 2026-08-18

## Objective and scope

Make every derived total the application displays state what it covers, so no
number depends on the reader knowing what was left out of it.

[Specification 0032](0032-recorded-result-meaning.md) made a single recorded set
say what its number means. A derived total has the same defect one level up.
Recorded load volume sums `external-load-and-repetitions` and
`bodyweight-plus-load-and-repetitions` and nothing else, and no screen says so.

Version 1 changes three sentences and one accessible name, all in presentation.

`@fitness/domain`, every migration, user version 11, export format version 1, the
reader contract, every query, every use case, every composition root, personal
records, correction, removal, addition, the Exercise Catalog and its filtering,
all three pickers, the Workout Planner, and `workout-result-formatting` are
untouched. No stored value, result kind, record, tie, or evidence link changes.
No total's numeric value changes.

Charts, Progress redesign, changing how any total is calculated, making
assistance contribute to load volume, a second volume-like measure, per-set
notes, set types, new record categories, and localization remain excluded.

## The gap this closes

Every derived total the application displays was audited against the SQL that
produces it. Exactly one is partial.

| Total                    | Contributing modes                               |
| ------------------------ | ------------------------------------------------ |
| Completed workouts       | every completed session                          |
| Actual sets              | all eight logging modes                          |
| Performed exercises      | all eight logging modes                          |
| Workout time             | every completed session                          |
| Repetitions              | every mode that records repetitions              |
| Performed duration       | every mode that records duration                 |
| Performed distance       | every mode that records distance                 |
| **Recorded load volume** | **external load and added bodyweight load only** |

Repetitions is worth stating explicitly: it counts assisted and bodyweight
repetitions, so it is already a total over everything of its own dimension and
needs no qualification. Only recorded load volume excludes recorded work.

Two distinct failures followed from that single exclusion.

**The silent partial.** A week holding a bench press and assisted pull-ups showed
`160 kg-reps recorded load volume`, a number correct by its own definition that
said nothing about the assisted sets it did not count. Its meaning depended on
remembering how the exercises were configured, which is precisely the defect
Specification 0032 closed for a single set.

**The silent omission.** A week holding only assisted, bodyweight, duration, or
distance work showed no load volume line at all. Not a zero, not an explanation —
the line did not exist, and a person who never records weighted work never
learned that the concept does.

Neither is a data defect. The exclusion is deliberate and correct: greater
assistance does not represent greater performed load, and combining the two would
break [ADR 0022](../docs/decisions/0022-personal-record-ordering-direction.md)'s
rule that a claim may state one dimension and never combine two.
[`offline-workout-history.md`](../docs/architecture/offline-workout-history.md)
already stated the reason to a developer. The application declined to state it to
a person, in the one place where a person meets its consequence.

This is a presentation defect. The query is right, and the reader already carries
enough to tell every case apart.

## The rule

**A displayed total either covers every recorded thing of its own dimension, or
states its coverage in the sentence that carries it.**

The statement of coverage is unconditional, positive, and short. It never states
a reason, never names the excluded work, and never compares eligible work with
ineligible work.

[ADR 0023](../docs/decisions/0023-displayed-totals-state-their-coverage.md)
records the rule and the two consequences that keep it cheap.

## Wording

The same period, in each coverage case.

| Case                                      | Condition                              | Metric                                                |
| ----------------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| Some recorded work is eligible            | volume is present                      | `160 kg-reps recorded load volume from weighted sets` |
| Recorded work exists, none of it eligible | volume is absent and actual sets exist | `No recorded load volume from weighted sets`          |
| Nothing was recorded                      | no actual sets                         | no line                                               |

In imperial the unit label is `lb-reps`; the qualifier is identical, and the
absent sentence is identical in both unit systems because it carries no unit.

`from weighted sets` covers both eligible modes exactly — `Weight + reps` and
`Added weight + reps` as the Exercise Catalog names them — and excludes the other
six without naming any of them.

Rejected wordings, on evidence:

- `160 kg-reps recorded load volume (weighted sets only)` — a parenthetical
  announces as punctuation rather than as meaning.
- `160 kg-reps recorded load volume from external and added load` — internal
  vocabulary that appears on no entry surface.
- `Weighted sets: 160 kg-reps recorded load volume` — Specification 0032 leads
  with its qualifier because a set row can lose its tail and an unqualified mass
  is ambiguous. Neither applies here: `kg-reps` is unambiguous on its own, the
  qualifier states coverage rather than meaning, and each summary line is its own
  wrapping text. The number leads because the card is a list of totals read by
  number.
- `0 kg-reps recorded load volume` — zero is a false claim about ineligible work,
  and an absent dimension has never been rendered as zero.
- A sentence naming why assistance is excluded — long, and it compares eligible
  with ineligible work in the one place the application must not.

## Why the absence is stated rather than left silent

Staying silent is quieter and leaves a person no way to learn the total exists.
Stating the absence costs one short line and buys three things:

1. A period whose work is entirely ineligible says so, in the same words the
   covered case uses.
2. The claim becomes provable end to end. A negative assertion about the inside
   of a card that is one accessibility element cannot be made at all.
3. **The load volume line stops changing the height of Workout History with the
   fixture.** Exactly one load volume line now renders for every period that
   recorded any set. The height that cost Specification 0032 an end-to-end
   scenario is closed rather than re-armed.

## Coverage is unconditional

The qualifier appears whether or not the period holds ineligible work, because it
is true either way. A qualifier appearing only when assisted work is present
would be contextual, would read differently from one week to the next, and would
require the reader to report the presence of ineligible sets — a field it does
not carry and that Progress would inherit.

Unconditional wording costs one clause and widens no contract.

## Ownership

`workout-history-formatting` owns the wording, because it already owns
`formatRecordedLoadVolume`. It gains `formatRecordedLoadVolumeSummary`, which
composes the covered sentence, and `absentRecordedLoadVolumeMessage`, which is
the absent one. `formatRecordedLoadVolume` keeps its signature and its output and
is still the only place a gram-repetition value becomes a unit.

Eligibility stays in SQL, where it already lives, expressed as two copies of the
same `CASE WHEN` — one in the range summary and one in the per-exercise query.
Neither query changes. Naming the list once would be a refactor this change does
not require: presentation never consults it, because the wording is
unconditional. The coupling between that list and the word `weighted` is guarded
by a test driven by `exerciseLoggingModes`, so a ninth logging mode fails the
suite until someone decides whether it contributes.

`@fitness/domain` does not gain the concept of an eligible dimension. It owns the
modes; which of them a read-time aggregate sums is a query decision with one
consumer, and [ADR 0017](../docs/decisions/0017-deterministic-workout-personal-records.md)
refused the same move for record labels.

## The reader contract

Unchanged, field for field:

```ts
export type WorkoutProgressSummary = Readonly<{
  actualSetCount: number;
  completedWorkoutCount: number;
  distanceMillimeters: number | null;
  durationSeconds: number | null;
  elapsedWorkoutSeconds: number;
  performedExerciseCount: number;
  recordedLoadVolumeGramRepetitions: number | null;
  repetitions: number | null;
}>;
```

It already distinguishes every case the screen needs. Recorded work with no
eligible sets is `recordedLoadVolumeGramRepetitions === null` with
`actualSetCount > 0`; nothing recorded at all is `actualSetCount === 0`. No field
is added, so no capability inherits a widened contract.

## The per-exercise screen

`ExercisePerformanceHistoryScreen` lists one row per performed exercise per
workout, grouped by `exercise.id`, each carrying one `loggingModeSnapshot`. A
per-exercise total therefore cannot mix eligible and ineligible work: the row is
wholly one or wholly the other. The silent partial does not exist there.

Its covered sentence takes the same wording, from the same function, because the
same coverage worded two ways is two claims.

Its absent case stays absent. A row whose mode is ineligible already states its
own dimension — `60 kg maximum assistance` — so the absence is explained by what
the card does say, and repeating `No recorded load volume from weighted sets` on
every assisted, bodyweight, duration, and distance row would be noise on a line
that already joins four values. This asymmetry with the period summary is
deliberate: the summary describes a period that can mix modes, and a row cannot.

## Undescribed logging modes

A captured mode this version does not classify contributes nothing, exactly as
before. The wording stays true: the total is still from weighted sets, and no
sentence claims the period held only weighted work. A period holding only such
modes renders the absent sentence.

## Error model

Nothing is written and no query changes, so nothing new can fail. Formatting is a
pure function of a loaded summary. The existing fixed sentences — `Workout
history could not be loaded.`, `More workouts could not be loaded.`, and
`Exercise performance could not be loaded.` — are unchanged, and none contains
SQL, table names, identifiers, internal paths, or stack traces.

Safe outcomes: a period with no completed workouts renders no load volume line; a
period with completed workouts and no eligible sets renders the absent sentence;
a mixed period renders the eligible total, unchanged in value, with its coverage;
a period holding only unclassified modes renders the absent sentence; an exercise
whose logging mode changed between workouts renders each row from its own
captured mode, and the period total sums only the eligible rows and says so.

## Experience and accessibility

Two screens change what they display, and one card changes what it announces.

The Workout History summary card is a single accessibility element: `Card`
renders a labelled, non-pressable card as one accessible view, so its children
never reach the accessibility tree. Before this change its accessible name was
`Workout progress summary` and **no number it displayed was announced at all**.
Appending only a coverage clause would have announced the coverage of a total
that was never spoken.

The card's accessible name therefore becomes its visible contents, joined, from
the same strings the card renders:

- Before: `Workout progress summary`
- After: `Workout progress summary, 2 completed workouts, 6 actual sets, 2
performed exercises, 45 min 0 sec workout time, 24 repetitions, 160 kg-reps
recorded load volume from weighted sets`

There is no second formatting path: the announced sentence is the read sentence,
which is how `HistoryCard` already labels itself.

No control label, heading, empty state, or alert changes. No control is added;
none is needed, because nothing here is chosen or dismissed.

The longest wording is `1,234,567.89 lb-reps recorded load volume from weighted
sets`. Summary lines are plain text with no line limit inside a card that lays
its children out in a column, so at the largest accessible text size the sentence
wraps onto further lines and the card grows taller, keeping the number and the
qualifier both readable.

## Privacy, security, and performance

No network, telemetry, analytics, AI, permission, or dependency is involved. No
SQL text changes, no query changes shape, no query is added, and every parameter
stays bound. Nothing is logged.

Formatting stays synchronous and allocation-light: one branch, two string
concatenations, and one join per render of a screen that already reads a period
summary. No additional render is introduced.

## Data lifecycle

Stored sets, result kinds, and logging mode snapshots are byte-identical. Every
total's numeric value is unchanged. Personal records, their categories, values,
ties, and evidence are unaffected. The Planner's stored data and the Exercise
Catalog are unaffected. Export, restore, erasure, and replacement are unaffected;
no exported field carries this wording and export format version 1 is unchanged.
Correction, removal, and addition change no behavior.

Data recorded before this change reads correctly after it, because the coverage
was always a property of the query and only the sentence ignored it.

## Verification and completion

Automated coverage:

- each coverage case produces its stated sentence, in both unit systems;
- each of the eight logging modes is proven to contribute or not contribute to
  recorded load volume, asserted against `exerciseLoggingModes` rather than a
  hard-coded list, so a ninth mode fails the suite until it is classified;
- a period with only ineligible work is distinguishable from a period with no
  work at all, from the reader alone;
- a mixed period returns and renders the eligible total unchanged;
- the Workout History summary renders all three coverage cases, and its announced
  contents are asserted, because it is one accessibility element;
- the per-exercise screen renders the covered wording and renders nothing for an
  ineligible row;
- no other sentence on either changed screen changed;
- every pre-existing reader and presentation assertion passes unmodified.

End-to-end coverage adds a Sprint 33 suite of three scenarios and one regression
scenario, all asserting the card's own accessible name, which is the only
assertable surface a labelled card has.

## Explicit exclusions

Changing how any total is calculated; assistance contributing to load volume; a
second volume-like measure; naming the eligible-mode list once; widening the
reader contract; new or changed personal record categories; one-repetition-maximum
estimation or strength scoring; per-set notes, tags, RPE, rest timers, or set
types; splitting the summary card into per-line accessible elements; charts;
Progress redesign; achievements, streaks, or adherence; coaching, progression
advice, or medical interpretation; starter Workout Plans; starter content changes;
onboarding; localization; export format changes; cloud synchronization;
authentication; backend endpoints; AI; notifications; dependency upgrades;
repository-wide refactoring.
