# Sprint 40 manual QA: the Workouts card states what it recorded

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat proving that
a period states its recorded load volume, that a period recording no eligible
load says so, or that a period states its performed duration and distance — the
Sprint 40 Maestro suite and regression scenario 33 already automate all three.

Never enter a real person's measurements, nutrition, or training history.

This sprint changes no stored value, session, set, result, record, migration,
index, query, reader contract, model, use case, or export. It renders three
values one screen already loaded and another screen already showed. Every check
below compares what the application recorded against what the Progress tab now
says.

## What only manual QA can cover

An end-to-end run cannot switch unit systems mid-run, exercise a screen reader,
render at the largest accessible text size, count announcement stops, or read
data written by a previous build. The claims below are therefore **manual only**:

- a period recording performed duration alone, with no distance beside it;
- a period recording performed distance alone;
- an assisted-only period, where load volume is ineligible rather than absent;
- a completed workout holding no performed set;
- every line read in imperial units;
- a value-by-value comparison against the Workout History summary;
- the Day and Month periods and the movement between them;
- VoiceOver and TalkBack stop counts on the Nutrition and Workouts cards;
- Dynamic Type at the largest accessible size;
- export output and data written before this build.

## Preparing the fixtures

Create each definition through the Exercise Library and record each workout
through the active session, with an `E2E` prefix. Complete them all today, so
the default Progress week contains every one.

| Fixture               | Definition                            | Set recorded              |
| --------------------- | ------------------------------------- | ------------------------- |
| Repetitions only      | `Reps only`, bodyweight               | 12 reps                   |
| Duration only         | `Duration`, no equipment              | 90 seconds                |
| Distance only         | `Distance`, cardio machine            | 3 km                      |
| Weighted load         | `Weight + reps`, barbell              | 60 kg × 5                 |
| Assisted load         | `Assistance + reps`, machine          | 20 kg × 8                 |
| Distance and duration | `Distance + duration`, cardio machine | 5 km in 1800 seconds      |
| Empty completed       | any definition                        | none — finish with no set |

Build the single-dimension checks one fixture at a time on a cleared install, or
use the Day period to isolate them. The all-four check needs the weighted, the
distance-and-duration, and the repetitions fixtures in one period.

## Each dimension alone

For each single-dimension fixture, open Progress and confirm the Workouts card:

- [ ] Repetitions only — states `Repetitions`, and states **neither**
      `Performed duration` nor `Performed distance`. The card ends with
      `No recorded load volume from weighted sets`.
- [ ] Duration only — states `Performed duration` with the recorded seconds
      formatted as `1 min 30 sec`, and states no `Repetitions` and no
      `Performed distance` line.
- [ ] Distance only — states `Performed distance, 3 km`, and no `Repetitions`
      and no `Performed duration`.
- [ ] Weighted load — states `Repetitions` and
      `300 kg-reps recorded load volume from weighted sets`. No performed
      duration and no performed distance.
- [ ] Assisted load — states `Repetitions, 8` and
      `No recorded load volume from weighted sets`. **The assistance is not
      counted and the card says so**; confirm no number appears in that
      sentence.
- [ ] Empty completed workout — states `Completed workouts, 1`,
      `Actual sets, 0`, `Performed exercises, 0`, a workout time, and **no
      load volume sentence in either form**. The counts already say there was
      nothing to account for.

Confirm at every step that **no line reads a zero** for a dimension the period
did not record. `0 km`, `0 sec`, and `0 kg-reps` are all defects.

## Every dimension at once

With the weighted, distance-and-duration, and repetitions fixtures in one
period:

- [ ] the card renders, in this order: `Completed workouts`, `Actual sets`,
      `Performed exercises`, `Workout time`, `Repetitions`,
      `Performed duration`, `Performed distance`, then the load volume
      sentence.
- [ ] seven metrics and one sentence, and nothing else.
- [ ] `Workout time` is larger than `Performed duration`, because it is the
      whole session and the other is the work inside it. Note both readings.

## Workout time is not performed duration

- [ ] Record one workout whose set duration is short and whose session is long —
      start the session, wait several minutes, record a 30-second hold, finish.
- [ ] Confirm `Workout time` reflects the wall clock and `Performed duration`
      reads `30 sec`.
- [ ] Confirm the two labels are distinguishable at a glance. This ambiguity is
      recorded as a known limitation in
      [Specification 0040](../../specs/0040-the-workouts-card-states-what-it-recorded.md);
      if it reads as confusing in practice, say so in the report — that
      observation is what would authorize the rename.

## Both unit systems

Switch the profile's preferred unit system and reopen Progress. Nothing stored
changes; only the writing does.

- [ ] Metric: `Performed distance, 5 km` and
      `160 kg-reps recorded load volume from weighted sets`.
- [ ] Imperial: `Performed distance, 3.11 mi` and
      `352.74 lb-reps recorded load volume from weighted sets`.
- [ ] `Performed duration` and `Workout time` read identically in both, because
      a duration carries no unit system.
- [ ] `No recorded load volume from weighted sets` is identical in both, because
      it carries no unit.

## The period agrees with the history summary, value by value

Open Workout History for the same period and the same selection.

- [ ] The completed workout, actual set, and performed exercise counts match.
- [ ] The workout time matches.
- [ ] The repetitions match.
- [ ] The performed duration matches.
- [ ] The performed distance matches, in the same unit.
- [ ] The load volume sentence is **word for word identical**, including its
      coverage clause. Any difference is a defect: the two screens use the same
      functions.

## Periods and navigation

- [ ] Day, Week, and Month each recompute the card, and moving between them
      leaves no stale line from the previous selection.
- [ ] Moving to a previous period with no workouts renders
      `No completed workouts in this period.` and nothing else.
- [ ] Moving forward again restores every line.
- [ ] Moving quickly between periods never leaves one period's lines above
      another period's counts.

## Assistive technology

- [ ] VoiceOver on iOS and TalkBack on Android reach **every** line of the
      Workouts card as its own stop. The card carries no label, so its children
      must be individually reachable; if the whole card announces as one
      utterance, that is a defect.
- [ ] Each metric announces `label, value` — `Performed duration, 30 min 0 sec`,
      `Performed distance, 5 km`.
- [ ] The load volume sentence announces exactly as it reads.
- [ ] **Count the stops** on the Nutrition card and on the Workouts card, and
      record both numbers. Expect 16 metrics plus the section header on
      Nutrition, and up to 7 metrics plus the header and the sentence on
      Workouts.
- [ ] Keyboard navigation reaches every line in render order, and focus never
      skips or traps.
- [ ] No line communicates anything by color alone.

## Dynamic Type

- [ ] At the largest accessible text size, every label and value on the Workouts
      card is fully readable. A metric whose label and value cannot share a line
      wraps onto two lines rather than truncating.
- [ ] The load volume sentence wraps rather than truncating, and both the number
      and `from weighted sets` remain readable.
- [ ] **Record how the whole Progress screen behaves at that size**, with a
      sixteen-metric Nutrition card above a taller Workouts card. Note the total
      scroll length and whether reaching the Body weight card is practical. This
      measurement is the point of the check: if the screen is unusable, that is
      the evidence that would authorize grouping the Progress cards, and it must
      be reported rather than worked around.

## Unchanged behavior

- [ ] The Nutrition, Hydration, and Body weight Progress cards render exactly as
      before, line for line.
- [ ] Daily activity renders as before.
- [ ] Workout History's own summary, its list, and the per-exercise performance
      screen are unchanged.
- [ ] Personal records are unchanged.
- [ ] Recording, editing, and finishing an active workout are unchanged,
      including the duration and distance fields on the set form.
- [ ] Correction, deletion, exercise removal, exercise addition, and workout
      naming behave as before.
- [ ] The nutrition diary, the hydration daily screen, Goals & Energy, and body
      measurements are unchanged.
- [ ] Export produces byte-identical output for the same data. Open the exported
      file and confirm no period summary and no load volume wording appears in
      it.
- [ ] Data recorded on a build from before this change reads correctly after
      installing this one, and its periods state the same dimensions.

## Privacy, security, and failure

- [ ] With the device offline, every check above still passes.
- [ ] No network request is made at any point.
- [ ] No log line contains a recorded value, an exercise name, an identifier, a
      SQL fragment, a table name, or a file path.
- [ ] Forcing a read failure renders `Progress unavailable`,
      `Progress could not be loaded from this device.`, and `Try Again`, with no
      stale value visible behind it, and retry recovers.
- [ ] Every fixture used was synthetic.
