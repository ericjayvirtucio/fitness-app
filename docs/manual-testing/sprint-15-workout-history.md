# Sprint 15 manual QA: Workout history and progress foundation

Record device, OS, app build, schema origin, timezone, appearance, network state, and
result. A failure blocks merge readiness. Use synthetic fitness data.

## History, snapshots, and calculations

| Check                | Exact steps                                                               | Expected result                                                                   |
| -------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Upgrade              | Upgrade a schema-9 install containing active and completed sessions.      | Migration 10 succeeds; all sessions and active recovery remain intact.            |
| Empty state          | Open History before completing a workout.                                 | A clear empty state appears; no fake progress is shown.                           |
| Completion           | Record an actual set, finish, and open History.                           | One completed card appears and no active session remains.                         |
| Detail               | Open the completed card.                                                  | Captured names, planned context, and performed sets appear read-only.             |
| Snapshot stability   | Complete a planned workout, then rename Catalog and Planner records.      | Old history retains captured names and targets.                                   |
| Actual only          | Complete a planned exercise with actual values different from its target. | Summaries and detail use actual values; the target stays labeled Planned.         |
| Unperformed exercise | Complete a session where one planned exercise has no sets.                | Detail preserves it as unperformed; performed counts exclude it.                  |
| Day grouping         | Start before midnight, finish after midnight.                             | The session remains on its captured start date.                                   |
| Week boundary        | Navigate across Saturday/Sunday and a year boundary.                      | Weeks remain Sunday-to-Saturday with no duplicated or omitted sessions.           |
| Month boundary       | Navigate February in leap and non-leap years.                             | Calendar month endpoints are correct.                                             |
| Frequency            | Complete multiple sessions on one day and inspect Day/Week/Month.         | Every completed session counts; no plan-adherence claim appears.                  |
| Repetitions          | Complete reps-only and bodyweight sets.                                   | Repetitions sum; no bodyweight load is inferred.                                  |
| Load volume          | Complete external-load and added-load sets.                               | Recorded load volume equals actual resistance × actual repetitions.               |
| Assistance           | Complete assistance sets.                                                 | Assistance displays, but it does not contribute to recorded load volume.          |
| Duration/distance    | Complete duration, distance, and combined results.                        | Applicable actual totals display in preferred units; unrelated values are absent. |
| Pagination           | Create more than 20 completed sessions and load more.                     | Order is stable with no duplicate or missing card.                                |
| Recents              | Perform an exercise, finish, then open Library and an exercise picker.    | It appears under Recently performed; Planner-only selection does not.             |
| Deleted recent       | Remove Planner references and delete a performed Catalog definition.      | It disappears from current recents while historical detail remains meaningful.    |

## Recovery, accessibility, and platforms

| Check              | Exact steps                                                              | Expected result                                                                 |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Restart            | Open history/detail, terminate, and relaunch offline.                    | Completed history restores unchanged.                                           |
| Timezone travel    | Complete near a day boundary, change timezone, and relaunch.             | The captured historical date does not change.                                   |
| Failure            | Induce a development read failure on initial load and later-page load.   | Initial retry is actionable; a later failure retains loaded cards.              |
| Large text         | Use the largest practical Dynamic Type with long workout/exercise names. | Summary, cards, detail, and period controls wrap without clipping.              |
| VoiceOver/TalkBack | Read and operate period controls, history cards, and detail.             | Names, dates, set counts, duration, units, and read-only meaning are clear.     |
| Keyboard           | Navigate period actions, cards, load-more, and back action.              | Focus order is logical and visible.                                             |
| Appearance         | Inspect light and dark modes.                                            | Text, borders, errors, and selection remain legible without color-only meaning. |
| iOS                | Run `./scripts/qa.sh sprint 15 --platform ios`.                          | Suite passes with retained artifacts.                                           |
| Android            | Run the same suite when validated native tooling is available.           | Suite passes; do not claim it when not executed.                                |

Also rerun the Sprint 13 completion/recovery checks and inspect the final diff for
any child replacement during completion.
