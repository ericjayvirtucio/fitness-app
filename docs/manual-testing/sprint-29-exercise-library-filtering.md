# Sprint 29 manual QA: Exercise Library filtering

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the narrowing
by equipment, by muscle group, by both together, by a filter with a search, the
empty filtered result, clearing, and relaunch behavior that the Sprint 29 Maestro
suite already automates.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture           | How to produce it                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Empty library     | Delete the app and reinstall it, so the installation has never held a record.                                           |
| Starter library   | A library holding exactly the twenty-six starter definitions.                                                           |
| Every equipment   | The starter library plus one hand-authored definition using `Other` equipment, so all ten equipment values are present. |
| Every muscle      | The same library plus one hand-authored definition whose primary muscle group is `Other`.                               |
| Planned reference | A weekday plan referencing a definition that a filter can exclude.                                                      |
| Recorded history  | A completed workout holding a definition that a filter can exclude.                                                     |

## Narrowing

| Check             | Steps                                                                            | Expected result                                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty library     | Open the Exercise Library on the empty-library fixture.                          | No filter controls are shown. The screen is exactly as tall as before, offering "Create first exercise" and the starter set.                                                          |
| Controls appear   | Add the starter exercises without scrolling afterwards.                          | The import control and its result stay exactly where you pressed them. Both filters appear below that section and above the list, each showing "Any equipment" or "Any muscle group". |
| Every equipment   | On the every-equipment fixture, choose each of the ten equipment values in turn. | Each is selectable, the list changes to match, and the summary names the value you chose.                                                                                             |
| Every muscle      | Choose each of the thirteen muscle-group values in turn.                         | Each is selectable, the list changes to match, and the summary names the value you chose.                                                                                             |
| Both together     | Choose `Barbell` and `Chest` on the starter library.                             | Exactly one definition is listed and the summary reads "Filtered by Barbell and Chest. 1 exercise."                                                                                   |
| Singular count    | Any combination matching exactly one definition.                                 | The summary says "1 exercise.", not "1 exercises."                                                                                                                                    |
| Order unchanged   | Compare a narrowed list with the same definitions in the unnarrowed list.        | Alphabetical order is identical. Narrowing never reorders, renames, or unfavorites anything.                                                                                          |
| Filter and search | With `Barbell` chosen, type `Press` into the search field.                       | Both apply. The section reads "Search results" and the summary still names the filter.                                                                                                |
| Nothing matches   | Choose `Dumbbell` and `Chest` on the starter library.                            | "Filtered by Dumbbell and Chest. No exercises match these filters." No list section is shown, and nothing says the library is empty.                                                  |
| Empty search too  | With a filter applied, type a word no matching definition contains.              | "No exercises match this search and these filters."                                                                                                                                   |
| Clear             | Press "Clear filters".                                                           | Both filters return to "Any", the summary disappears, and "All exercises" returns with the whole catalog.                                                                             |
| Favorites hidden  | Favorite a definition, then apply any filter.                                    | Favorites and Recently performed are not shown while narrowing, and both return when the filters are cleared.                                                                         |
| Truncation notice | On a library holding more than 100 definitions, browse unfiltered.               | "Showing the first 100 exercises. Narrow the list to see the rest." appears above the list. It disappears once a filter brings the list under the bound.                              |

## Filtering beside everything else

| Check                | Steps                                                                    | Expected result                                                                                    |
| -------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| After an import      | Apply a filter, then add the starter exercises.                          | The result sentence appears and the narrowed list updates under the filter still applied.          |
| Create and return    | Apply a filter, create an exercise, then return to the library.          | The filter is still applied. The new definition is listed if it matches and absent if it does not. |
| Delete a shown one   | Apply a filter, then delete a definition it lists.                       | It disappears from the narrowed list, the summary count drops, and the filter stays applied.       |
| Favorite a shown one | Apply a filter, then favorite a definition it lists.                     | The favorite is saved and survives a relaunch. The narrowed list stays narrowed.                   |
| Referenced           | Apply a filter, then delete a definition a weekday plan references.      | Refused exactly as before, naming the plans. Filtering changes nothing about the refusal.          |
| Leave and return     | Apply a filter, go to another tab, and come back.                        | The filter is still applied and the list is re-read from storage.                                  |
| Background           | Apply a filter, background the app, and return.                          | The filter is still applied.                                                                       |
| Relaunch             | Apply a filter, stop and relaunch the app.                               | Nothing is narrowed. Filters are held by the screen and are never stored.                          |
| Pickers unchanged    | Add an exercise to a plan, to an active workout, and to a completed one. | None of the three pickers offers a filter. All three still browse and search identically.          |
| Unit systems         | Repeat one narrowing check in metric and in imperial.                    | Identical. Filtering reads no measurement and shows no unit.                                       |

## Accessibility

| Check               | Steps                                                   | Expected result                                                                                                       |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| VoiceOver           | Traverse the library with VoiceOver.                    | Each filter is announced as a radio group with its name; each option announces its label and whether it is selected.  |
| VoiceOver result    | Change a filter with VoiceOver running.                 | The summary is announced politely, including how many exercises matched or that none did.                             |
| TalkBack            | Repeat both checks on Android.                          | Equivalent announcements.                                                                                             |
| Keyboard            | Navigate with a hardware keyboard.                      | Search, equipment, muscle group, summary, clear, and the list are reachable in that order and every option activates. |
| Dynamic Type        | Set the largest accessible text size.                   | Every label is fully readable, options wrap rather than truncate, and nothing overlaps.                               |
| Touch targets       | On a physical device, tap options near their edges.     | Every option and the clear control meet the minimum touch target.                                                     |
| Colour independence | Inspect a selected option in light and dark appearance. | Selection is conveyed by the announced state and the label, never by colour alone.                                    |

## Privacy, storage, and failure

| Check             | Steps                                                             | Expected result                                                                                |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| No network        | Run every narrowing check in airplane mode.                       | Identical behavior. Filtering makes no request of any kind.                                    |
| No logging        | Watch the device log while filtering and searching.               | No exercise name, note, filter value, SQL, or table name is logged.                            |
| Storage failure   | Filter while local storage is unavailable.                        | The library's existing error state appears, stating that nothing was changed. No SQL is shown. |
| Rapid input       | Tap several filter values quickly, then type in the search field. | The list settles on what was asked for last. An older result never replaces a newer one.       |
| Export unchanged  | Export after filtering.                                           | The export holds the whole catalog. A filter is a view, not a selection.                       |
| Erasure unchanged | Erase all local data, then reopen the library.                    | The empty state returns and the filter controls are absent again.                              |
