# Sprint 35 manual QA: owner-named workouts

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat naming an
active workout, naming a completed one, or the refusal of an invalid name, which
the Sprint 35 Maestro suite and regression scenario 28 already automate.

Never enter a real person's measurements, nutrition, or training history.

This sprint adds one screen and two controls, and changes no existing visible
string. Most checks below compare what one name looks like across every surface
that shows it, before and after a rename.

## Preparing the fixtures

| Fixture           | How to produce it                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Empty workout     | Start a workout without a plan. It is called `Workout`.                                             |
| Planned workout   | Plan a weekday with a name of your choosing and start it. It takes the plan's name.                 |
| Completed workout | Record at least one set in an empty workout and finish it.                                          |
| Record evidence   | In that workout, record a set that becomes a personal record for its exercise.                      |
| Second surface    | Open completed history in one place and the same workout's detail in another, then rename from one. |
| Recorded before   | Data recorded on the previous build, read and renamed after installing this one.                    |
| Longest name      | Exactly 80 characters.                                                                              |
| Over the limit    | Attempt more than 80 characters in the field.                                                       |

## Naming an active workout

| Check                                                           | Expected                                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Start an empty workout                                          | The heading reads `Workout`.                                                                 |
| `Rename This Workout` is present with the whole-workout actions | Present above `Finish Workout`, outside every card, full touch target.                       |
| The set form with the number pad open                           | `Save Set` is reachable without dismissing the keyboard, exactly as before this sprint.      |
| Open it                                                         | Heading `Rename workout`, field `Workout name` pre-filled with `Workout`.                    |
| The explanation                                                 | States the change reaches personal records and that no recorded set, total, or time changes. |
| Save a new name                                                 | Returns to the active workout, which now shows the new name.                                 |
| Every recorded set, its order, and the elapsed time             | Unchanged.                                                                                   |
| Finish the workout                                              | Completed history shows the chosen name, not `Workout`.                                      |

## Naming a completed workout

| Check                                         | Expected                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| Open a completed workout                      | `Rename This Workout` sits under the date line, above the summary card.      |
| Rename it                                     | Returns to the detail, which shows the new name.                             |
| Workout History list                          | The row shows the new name.                                                  |
| Summary card values, set count, workout time  | Unchanged.                                                                   |
| Delete control and its confirmation title     | Both name the workout by its new name.                                       |
| Add-exercise control                          | Names the workout by its new name.                                           |
| Exercise performance screen for that exercise | The occurrence card shows the new name.                                      |
| Personal record beneath it                    | Its evidence sentence now reads `in <new name>`, and its value is unchanged. |
| Correct a set, remove an exercise, add one    | All three still work and preserve the name.                                  |

## Names the field must handle

| Name                                         | Expected                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Empty                                        | Refused: `Enter a workout name of 1 to 80 characters.` The field keeps what was typed. |
| Spaces only                                  | Refused with the same sentence. Nothing is written.                                    |
| One character                                | Accepted.                                                                              |
| Exactly 80 characters                        | Accepted. The card and every heading wrap; nothing truncates.                          |
| Over 80 characters                           | The field stops accepting input at 80.                                                 |
| Leading/trailing spaces                      | Stored trimmed.                                                                        |
| Punctuation, e.g. `Leg Day — "heavy" (wk 3)` | Stored and shown exactly, with no character treated as markup.                         |
| Emoji, e.g. `Leg Day 🔥`                     | Stored and shown exactly.                                                              |
| Right-to-left, e.g. `تمرين الأرجل`           | Stored and shown; the surrounding sentence stays readable.                             |

## Refusals

| Check                                                                                  | Expected                                                                                            |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Open the naming screen for an active workout, finish that workout elsewhere, then save | `This workout changed since this screen opened. Open it again before renaming it.` Nothing changes. |
| Open the naming screen, delete that workout elsewhere, then save                       | `This workout is no longer available.` or the unavailable screen with `Go Back`.                    |
| Force a write failure (airplane mode is not enough; use a disposable target)           | `This workout could not be renamed. Nothing was changed.` The stored name is unchanged.             |
| Press `Save Name` repeatedly while the write is in flight                              | Exactly one rename is applied.                                                                      |
| Any refusal message                                                                    | Contains no SQL, table name, column, identifier, path, or stack trace, and never the name typed.    |

## Accessibility

| Check                                        | Expected                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| VoiceOver, active workout control            | `Rename this workout, <name>`, as a button.                                                       |
| VoiceOver, completed workout control         | `Rename this workout, <name>, <date>`, as a button.                                               |
| VoiceOver, naming screen                     | Heading, explanation, `Workout name` field, `Save Name`, `Cancel`, in that order.                 |
| VoiceOver, refusal                           | Announced when it appears, without swiping to it.                                                 |
| TalkBack, all of the above                   | Same content and order.                                                                           |
| An 80-character name, both screen readers    | Announced in full; the history card's sentence stays comprehensible.                              |
| Keyboard navigation on the naming screen     | Field, then both buttons, in render order; focus visible throughout.                              |
| No labelled card contains the rename control | Confirm by swiping: the summary card and the control are separate elements.                       |
| Dynamic Type at the largest accessible size  | With an 80-character name, every heading and card wraps and grows; nothing truncates or overlaps. |
| Touch targets on a physical device           | Both controls and both buttons meet the minimum.                                                  |
| Both unit systems                            | Recorded values on every changed screen read correctly in metric and imperial.                    |

## Data lifecycle and safety

| Check                                             | Expected                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Export after a rename                             | The completed session carries the new name. The format is unchanged.    |
| Restore that export into an empty installation    | The workout restores with the new name and every recorded value intact. |
| Replacement restore                               | Unchanged behavior.                                                     |
| Local erasure                                     | Unchanged behavior.                                                     |
| Data recorded before this build, renamed after it | Renames normally; every recorded value is preserved.                    |
| Network state                                     | No request is made at any point. Airplane mode changes nothing.         |
| Logs                                              | No workout name, identifier, or recorded value appears in any log.      |
