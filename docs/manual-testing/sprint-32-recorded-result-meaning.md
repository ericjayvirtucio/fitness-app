# Sprint 32 manual QA: recorded result meaning

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the assisted
sentence in the active session, in completed history, on the correction screen,
the added-load sentence, or the relaunch, which the Sprint 32 Maestro suite and
regression scenario 25 already automate.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture               | How to produce it                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| One per logging mode  | One completed workout for each of the eight logging modes, each with a single recorded set.                           |
| Same mass, two modes  | An assisted exercise and an added-load exercise, each with a set of exactly 20 kg, in the same completed workout.     |
| Planned beside actual | A planned workout whose assisted exercise targets 20 kg for 8 repetitions, performed and recorded at the same values. |
| Planned, no actual    | A planned assisted exercise started but never recorded, so the planned line stands alone.                             |
| Actual, no planned    | An assisted exercise added to an empty workout and recorded, so the recorded line stands alone.                       |
| Recorded before       | A workout recorded on the previous build, read after installing this one.                                             |

## What each mode says

One recorded set per mode, read in the active session, in completed history, and
on the correction screen. The three sentences must be identical apart from their
leading words ("Set 1:", "Performed set 1:", "Currently recorded set 1:").

| Logging mode        | Expected result, metric | Expected result, imperial |
| ------------------- | ----------------------- | ------------------------- |
| Reps                | `8 reps`                | `8 reps`                  |
| Bodyweight + reps   | `8 reps`                | `8 reps`                  |
| Weight + reps       | `20 kg × 8`             | `20 lb × 8`               |
| Added weight + reps | `Added 20 kg × 8`       | `Added 20 lb × 8`         |
| Assistance + reps   | `Assistance 20 kg × 8`  | `Assistance 20 lb × 8`    |
| Duration            | `1 min 30 sec`          | `1 min 30 sec`            |
| Distance            | `5 km`                  | `5 mi`                    |
| Distance + duration | `5 km in 1 min 30 sec`  | `5 mi in 1 min 30 sec`    |

| Check                   | Steps                                            | Expected result                                                                                                        |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Same mass, side by side | Open the same-mass fixture's completed workout.  | One row reads `Assistance 20 kg × 8` and the other `Added 20 kg × 8`. Neither reads `20 kg × 8`.                       |
| Weight stays plain      | Read a "Weight + reps" set on all three screens. | `20 kg × 8`, with no qualifier. It is unchanged from the previous build.                                               |
| Agrees with entry       | Open the set form for each resistance mode.      | The field label and the displayed sentence use the same word: "Assistance", "Added weight"/"Added", or "Weight"/plain. |
| Claims nothing more     | Read every changed sentence end to end.          | Nothing about effort, difficulty, physiology, or progression. Only what the mass is.                                   |
| Recorded before         | Open the previous-build fixture.                 | It reads with the new wording, because the meaning always lived in the captured logging mode.                          |

## Planned targets

| Check              | Steps                                                            | Expected result                                                                          |
| ------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Planned agrees     | Open the planned-beside-actual fixture in the active session.    | `Planned: 3 sets · 8 reps · Assistance 20 kg` above `Set 1: Assistance 20 kg × 8`.       |
| Correction screen  | Correct that set.                                                | `Planned target: 3 sets · 8 reps · Assistance 20 kg` and the recorded line agree.        |
| Planned, no actual | Open the planned-only fixture.                                   | The planned line reads with its qualifier and the exercise says it has no recorded sets. |
| Actual, no planned | Open the actual-only fixture.                                    | The recorded line reads with its qualifier and no planned line appears.                  |
| No planned mass    | Plan an assisted exercise with sets and repetitions but no mass. | `3 sets · 8 reps`, with no dangling qualifier.                                           |

## Correcting a set

| Check             | Steps                                            | Expected result                                                                                       |
| ----------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Old beside new    | Correct an assisted set from 20 kg to 15 kg.     | Before saving, the previous value reads `Assistance 20 kg × 8`; after saving, `Assistance 15 kg × 8`. |
| Unchanged wording | Read the rest of the correction screen.          | Every other sentence — the heading, what correction changes, the controls — is unchanged.             |
| Records follow    | Open the exercise's personal records afterwards. | The record moves exactly as it did before this sprint. No record wording changed.                     |

## Units, accessibility, and device behaviour

| Check                 | Steps                                                                                   | Expected result                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit switch           | Switch the profile between metric and imperial and re-read every changed sentence.      | Only the unit label changes. The qualifier is identical in both.                                                                                                                  |
| Largest text size     | Set the largest accessible text size and open a completed workout listing several sets. | Set rows wrap onto more lines rather than truncating. Nothing is clipped, and the Edit, Delete, and Correct controls stay reachable and keep their touch target.                  |
| VoiceOver, set row    | Swipe through a set row.                                                                | The row announces the qualifier before the mass, then the repetitions. Its controls announce "Edit set 1 for …", "Delete set 1 for …", "Correct recorded set 1 for …", unchanged. |
| VoiceOver, both modes | Swipe through the same-mass fixture.                                                    | The two rows are distinguishable by ear alone.                                                                                                                                    |
| TalkBack              | Repeat both VoiceOver checks on Android.                                                | Same announcements, same order.                                                                                                                                                   |
| Keyboard              | Move through a completed workout with an external keyboard.                             | Focus order is unchanged: each set row, then its controls, top to bottom.                                                                                                         |
| Touch targets         | On a physical device, tap Edit, Delete, and Correct beside a wrapped set row.           | Each is at least the minimum touch target and none is overlapped by the row above it.                                                                                             |
| No network            | Enable airplane mode and repeat any check.                                              | Everything behaves identically. Nothing is requested.                                                                                                                             |
| No sensitive logging  | Watch the device log while recording and correcting a set.                              | No values, identifiers, SQL, or paths are logged.                                                                                                                                 |

## Result

Record pass or fail per check with device, OS, build, appearance, text size, and
unit system. Attach screenshots for the largest text size and for the same-mass
fixture. A failed check must say which screen, which logging mode, which unit
system, and the exact sentence that appeared.
