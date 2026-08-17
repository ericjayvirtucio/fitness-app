# Sprint 30 manual QA: compact, reusable exercise filtering

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the library
narrowing, the empty filtered result, clearing, or relaunch behavior that the
Sprint 29 suite already automates, nor the closed control, the three narrowed
pickers, the filtered picker miss, or the reopened picker that the Sprint 30
Maestro suite automates.

The behavior this sprint refines is unchanged in substance: every check in the
[Sprint 29 checklist](sprint-29-exercise-library-filtering.md) still applies,
with the options opened first.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture           | How to produce it                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Empty library     | Delete the app and reinstall it, so the installation has never held a record.                                           |
| One-item library  | The empty library plus exactly one hand-authored definition.                                                            |
| Starter library   | A library holding exactly the twenty-six starter definitions.                                                           |
| Every equipment   | The starter library plus one hand-authored definition using `Other` equipment, so all ten equipment values are present. |
| Every muscle      | The same library plus one hand-authored definition whose primary muscle group is `Other`.                               |
| Recorded history  | One completed workout, so a picker has recently performed exercises to show.                                            |
| Planned reference | A weekday plan referencing a definition a filter can exclude.                                                           |

## The closed control

| Check                | Steps                                                                        | Expected result                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Empty library        | Open the Exercise Library on the empty-library fixture.                      | No "Filters" button and no options. The screen is exactly as tall as before, offering "Create first exercise" and the starter set.      |
| One definition       | Create one exercise and return to the library.                               | One "Filters" button appears between the starter section and the list. The first exercise card is on screen without scrolling.          |
| Starter library      | Add the starter exercises without scrolling afterwards.                      | The import control and its result stay exactly where you pressed them. The "Filters" button appears; twenty-five chips do not.          |
| Opening              | Press "Filters".                                                             | Both radio groups appear in place, below the starter section and above the list, each showing "Any equipment" or "Any muscle group".    |
| Closing              | Press it again.                                                              | The options disappear. Nothing else on the screen moves except the list rising to meet the control.                                     |
| Closed with a filter | Choose `Dumbbell`, then close the control.                                   | The button reads "Filters: Dumbbell", the summary still reads "Filtered by Dumbbell. 3 exercises.", and "Clear filters" is still there. |
| Clear while closed   | Press "Clear filters" without reopening.                                     | Both criteria clear, the summary disappears, and "All exercises" returns.                                                               |
| Reopening            | Apply a filter, close the control, then reopen it.                           | The chosen values are still selected. Closing hides the choosing, never the choice.                                                     |
| Every equipment      | On the every-equipment fixture, open the control and choose each of the ten. | Each is selectable, the list changes to match, and the summary names the value chosen.                                                  |
| Every muscle         | Choose each of the thirteen muscle-group values in turn.                     | Each is selectable, the list changes to match, and the summary names the value chosen.                                                  |
| Filter and search    | With `Barbell` chosen and the control closed, type `Press` into the search.  | Both apply. The section reads "Search results" and the summary still names the filter and the count.                                    |
| Nothing matches      | Choose `Dumbbell` and `Chest` on the starter library.                        | "Filtered by Dumbbell and Chest. No exercises match these filters." Nothing anywhere says the library is empty.                         |

## The three pickers

Run each row in all three: the Workout Planner, the active Workout Session, and
adding an exercise to a completed workout.

| Check              | Steps                                                         | Expected result                                                                                                                 |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Same control       | Open the picker.                                              | One "Filters" button sits directly under the search field, closed, worded exactly as the library's.                             |
| Narrowing          | Choose `Barbell` and `Chest` on the starter library.          | Exactly one card is listed and the summary reads "Filtered by Barbell and Chest. 1 exercise."                                   |
| Recents suppressed | On the recorded-history fixture, apply any filter.            | "Recently performed" disappears while narrowed and the list is the narrowed catalog.                                            |
| Recents restored   | Press "Clear filters".                                        | "Recently performed" returns with the same exercises it showed before.                                                          |
| Filter and search  | Apply a filter, then type part of a matching name.            | Both apply, and the summary reports what came back.                                                                             |
| Nothing matches    | Choose `Dumbbell` and `Chest`.                                | The summary states the miss. "No exercises found" and the advice to create exercises in the Exercise Library do **not** appear. |
| Empty catalog      | Open a picker on the empty-library fixture.                   | No "Filters" button. "No exercises found" and the advice to create some appear exactly as before.                               |
| Dismiss and reopen | Apply a filter, cancel out of the picker, then open it again. | Nothing is narrowed and the options are away. A filter belongs to the picker, exactly as a typed search already does.           |
| Selection works    | With a filter applied, choose a card.                         | The exercise is added exactly as an unfiltered choice would add it, with the same target or set entry following.                |
| Planner reference  | Add a filtered choice to a weekday plan and save it.          | Saved identically. A filter changes what was offered, never what was written.                                                   |

## Beside everything else

| Check             | Steps                                                              | Expected result                                                                                          |
| ----------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| After an import   | Apply a filter, close the control, then add the starter exercises. | The result sentence stays on screen and the narrowed list updates under the filter.                      |
| Create and return | Apply a filter, create an exercise, then return to the library.    | The filter is still applied and the control is still closed. The new definition is listed if it matches. |
| Leave and return  | Apply a filter, go to another tab, and come back.                  | The filter is still applied and the list is re-read from storage.                                        |
| Background        | Apply a filter, background the app, and return.                    | The filter is still applied.                                                                             |
| Relaunch          | Apply a filter, stop and relaunch the app.                         | Nothing is narrowed and the options are away.                                                            |
| Unit systems      | Repeat one narrowing check in metric and in imperial.              | Identical. Filtering reads no measurement and shows no unit.                                             |
| History untouched | Filter, then open Workout History, Progress, and Personal Records. | Every derived value is exactly what it was. A filter writes nothing.                                     |
| Export unchanged  | Export after filtering in both the library and a picker.           | The export holds the whole catalog. A filter is a view, not a selection.                                 |
| Erasure unchanged | Erase all local data, then reopen the library and a picker.        | The empty states return and neither offers a "Filters" button.                                           |

## Accessibility

| Check               | Steps                                                                      | Expected result                                                                                                              |
| ------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver, closed   | Reach the closed control with VoiceOver.                                   | It announces as a button named "Show filters. No filters applied.", or with the active filter and count when one is applied. |
| VoiceOver, open     | Press it.                                                                  | It announces as expanded and reads "Hide filters." Both groups announce as radio groups with their names.                    |
| VoiceOver, options  | Traverse the options.                                                      | Each announces its label and whether it is selected.                                                                         |
| VoiceOver, result   | Change a filter with VoiceOver running.                                    | The summary is announced politely, including how many matched or that none did. Nothing is announced twice.                  |
| Focus on open       | Note the focused element, open the control, then close it.                 | Focus stays on the control both times. It never jumps to the top of the screen or into the list.                             |
| TalkBack            | Repeat every row above on Android.                                         | Equivalent announcements, including the expanded state.                                                                      |
| Keyboard            | Navigate with a hardware keyboard, opening and closing the control.        | Search, the control, the options while open, summary, clear, and the list are reachable in that order, and each activates.   |
| Dynamic Type        | Set the largest accessible text size and open the control on both screens. | Every label is fully readable, the button's label wraps rather than truncates, options wrap rather than truncate.            |
| Touch targets       | On a physical device, tap the control and options near their edges.        | The control, every option, and "Clear filters" meet the minimum touch target.                                                |
| Colour independence | Inspect the closed and open states in light and dark appearance.           | The state is conveyed by the announced state and the label, never by colour alone.                                           |

## Privacy, storage, and failure

| Check           | Steps                                                                            | Expected result                                                                              |
| --------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| No network      | Run every check above in airplane mode.                                          | Identical behavior. Filtering makes no request of any kind.                                  |
| No logging      | Watch the device log while filtering in the library and in a picker.             | No exercise name, note, filter value, SQL, or table name is logged.                          |
| Storage failure | Filter a picker while local storage is unavailable.                              | "Exercises could not be loaded." appears. No SQL, table, identifier, or path is shown.       |
| Failure clears  | Restore storage and change the filter again.                                     | The message disappears as soon as a newer read succeeds; it does not persist over good data. |
| Rapid input     | Open a picker, tap several filter values quickly, then type in the search.       | The list settles on what was asked for last. An older result never replaces a newer one.     |
| Catalog changes | Filter a picker, then delete a listed definition from another screen and return. | The picker re-reads under the active criteria. The row is simply absent; nothing errors.     |
