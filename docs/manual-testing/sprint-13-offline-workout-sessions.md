# Sprint 13 manual QA: Offline workout sessions

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, app build, schema origin (fresh or upgraded from 8), network
state, and result for every check. A failure blocks merge readiness. Fix it, add
regression coverage where feasible, rerun relevant automation, and repeat the
affected checks.

## Start, logging, and lifecycle

| Check                | Exact steps                                                    | Expected result                                                               | Why it matters                                |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| Existing launch      | Upgrade a Sprint 12 install, then launch a fresh install.      | Both open without migration errors.                                           | Proves upgrade and clean schema safety.       |
| Workout tab          | Open Workout with no active session.                           | Start actions, Weekly Plan, and Exercise Library are clear.                   | Preserves navigation hierarchy.               |
| Planned start        | Configure today's Push Day with targets; tap Start Push Day.   | Independent active session opens with ordered snapshots and planned guidance. | Verifies transactional plan snapshot.         |
| Empty start          | Finish/discard, then tap Start Empty Workout.                  | A recoverable Workout session opens empty.                                    | Supports unplanned training.                  |
| Weight + reps        | Add Bench Press and save 60 kg × 8, then several more sets.    | Each set appears individually in order.                                       | Preserves actual set-level truth.             |
| Actual differs       | Log fewer reps or different weight than planned.               | Values save normally with no judgment.                                        | Keeps intent separate from performance.       |
| Edit set             | Edit set 2 and save.                                           | ID/order remain; only values change.                                          | Verifies targeted user correction.            |
| Delete/re-add        | Delete set 2, confirm, then add another.                       | Display renumbers coherently and persists.                                    | Verifies deterministic compaction.            |
| Reps only            | Add a repetition/bodyweight exercise and save reps.            | Only repetitions are requested.                                               | Prevents irrelevant fields.                   |
| Duration             | Add Plank and save 45 seconds.                                 | Duration persists and restores.                                               | Verifies canonical Duration.                  |
| Distance             | Add distance exercise and save a distance.                     | Only distance appears with preferred units.                                   | Verifies canonical Length.                    |
| Distance + duration  | Add treadmill and save both fields.                            | Both values persist as one set.                                               | Verifies combined result discrimination.      |
| Assistance           | Add assisted exercise and save assistance plus reps.           | Label says Assistance, not generic weight.                                    | Preserves resistance semantics.               |
| Add exercise         | Add an exercise during Push Day.                               | It appears only in the active session.                                        | Protects Planner independence.                |
| Remove empty         | Remove an exercise with no sets.                               | It is removed without changing plan/catalog.                                  | Supports real workout changes.                |
| Remove performed     | Remove an exercise containing sets; cancel once, then confirm. | Cancel preserves it; confirmation removes exercise and sets.                  | Protects performed data.                      |
| Invalid/empty finish | Try Finish before any set.                                     | Completion is blocked with safe feedback.                                     | Prevents meaningless history.                 |
| Finish               | With a set present, confirm Finish.                            | Completion is atomic and no active session remains.                           | Establishes historical boundary.              |
| New after finish     | Start another workout.                                         | Start succeeds.                                                               | Verifies active uniqueness lifecycle release. |
| Discard              | Start/log, tap Discard, cancel once, then confirm.             | Cancel preserves everything; confirmation removes the aggregate.              | Verifies deliberate destructive behavior.     |

## Independence, recovery, and failure

| Check                | Exact steps                                                          | Expected result                                           | Why it matters                            |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| Second start         | While active, return to Workout and attempt another start.           | Resume is prominent; no second session is created.        | Defends single-active invariant.          |
| Planner independence | Start planned workout, then change the recurring plan.               | Active snapshot and targets do not change.                | Prevents intent from rewriting execution. |
| Catalog rename       | Start a session, then rename its catalog definition where allowed.   | Captured session name remains stable.                     | Protects historical meaning.              |
| Catalog deletion     | Remove Planner references and delete a definition used by a session. | Deletion succeeds; session remains understandable.        | Confirms non-relational snapshots.        |
| Background/lock      | Log a set, background and lock, then resume.                         | Confirmed data remains.                                   | Covers common gym interruptions.          |
| Force close          | Terminate while active and reopen.                                   | Resume Workout restores the aggregate.                    | Proves SQLite—not React state—owns truth. |
| Cold offline         | Enable airplane mode, terminate, and relaunch.                       | Active workout restores and all mutations work.           | Confirms complete offline behavior.       |
| Restart after finish | Finish, terminate, and relaunch.                                     | No active workout appears.                                | Confirms durable completion.              |
| Save failure         | Practically induce a development persistence failure and save a set. | Set is not shown as saved; typed fields remain for retry. | Prevents misleading data loss.            |

## Units, accessibility, platforms, and regressions

| Check               | Exact steps                                                     | Expected result                                                                | Why it matters                             |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| Metric/imperial     | Repeat weight and distance entry after switching Profile units. | kg/km or lb/mi display equivalent canonical values.                            | Prevents unit drift.                       |
| Light/dark          | Complete the active flow in both appearances.                   | Content, errors, and actions remain legible.                                   | Verifies semantic theme use.               |
| Large text          | Use large and largest practical Dynamic Type with long names.   | Screen scrolls; cards/actions do not overlap or clip.                          | Covers repeated expanding content.         |
| VoiceOver/TalkBack  | Read and operate exercise, set, finish, and discard controls.   | Headings, units, contextual set actions, and confirmations are understandable. | Ensures nonvisual gym use.                 |
| Keyboard            | Navigate fields/actions with a hardware keyboard.               | Focus order is logical; input remains visible.                                 | Supports non-touch entry.                  |
| iOS/Android         | Complete the principal flow on each available platform.         | SQLite, alerts, keyboard, and navigation behave consistently.                  | Covers native integrations.                |
| Planner/Catalog     | Edit plan; search, favorite, edit, and delete catalog items.    | Sprint 11/12 behavior remains correct.                                         | Guards directly adjacent capabilities.     |
| Hydration/Nutrition | Log/edit/delete and restart each diary.                         | Existing data remains correct.                                                 | Guards shared migration infrastructure.    |
| Profile/Goals       | Edit Profile units and Goals & Energy.                          | Existing persistence/calculations remain correct.                              | Guards shared composition/domain behavior. |
