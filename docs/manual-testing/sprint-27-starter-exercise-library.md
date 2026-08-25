# Sprint 27 manual QA: Starter exercise library

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the offered
empty state, the stated result, renaming and deleting an imported definition, a
second import, a preserved hand-authored name, planning and completing against
imported definitions, and relaunch behavior that the Sprint 27 Maestro suite
already automates.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture           | How to produce it                                                                     |
| ----------------- | ------------------------------------------------------------------------------------- |
| Fresh install     | Delete the app and reinstall it, so the installation has never held a record.         |
| Some names held   | A library holding two hand-authored definitions, one of them named exactly `Push-up`. |
| Every name held   | A library where the starter set has already been imported.                            |
| Referenced import | A weekday plan referencing an imported definition.                                    |
| Recorded import   | A completed workout holding an imported definition.                                   |
| Export file       | An export created after an import, kept for the restore and replacement checks.       |
| Empty-export file | An export created on an installation that has never imported.                         |

## Import behavior

| Check              | Steps                                                                             | Expected result                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Fresh install      | Open the Exercise Library on the fresh-install fixture, before pressing anything. | The library is empty. It offers both "Create first exercise" and "Add starter exercises", and has written nothing.            |
| Explanation first  | Read the starter section before pressing.                                         | It states the count, that the definitions behave like ones you create, and that exercises you already have are left alone.    |
| No alert           | Press the control.                                                                | No destructive confirmation appears. The act is the press, and the explanation preceded it.                                   |
| Import             | Add the starter exercises from an empty library.                                  | The stated count is added, listed alphabetically, and the result names how many were added.                                   |
| Nothing favorited  | Review every added definition.                                                    | None is favorited. Each offers to add a favorite rather than to remove one.                                                   |
| Some names held    | Import onto the some-names-held fixture.                                          | The person's own definitions are untouched, the matching starter entries are skipped, and the result names the skipped count. |
| No duplicate names | After the previous check, search for `Push-up`.                                   | Exactly one definition carries that name, and it is the one the person wrote.                                                 |
| Every name held    | Import onto the every-name-held fixture.                                          | Nothing is added, and the result says so rather than claiming an addition.                                                    |
| Import twice       | Import, then import again immediately.                                            | The second import adds nothing and says so.                                                                                   |
| Duplicate request  | Press the control twice in quick succession.                                      | Exactly one import runs. The control is unavailable while the write is in flight.                                             |
| Delete then import | Delete one imported definition, then import again.                                | It is added back, and the result counts it. This is expected: the press is a fresh request.                                   |
| Relaunch           | Import, then stop and relaunch the app.                                           | Every definition is still there. The earlier result sentence is gone.                                                         |

## Ownership of what was imported

| Check              | Steps                                                                      | Expected result                                                                                      |
| ------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Rename             | Rename an imported definition.                                             | It saves like any other, and the library shows the new name.                                         |
| Re-classify        | Change an imported definition's equipment, muscle group, and logging mode. | Each saves, subject to the same compatibility rules an authored definition obeys.                    |
| Favorite           | Favorite and unfavorite an imported definition.                            | It moves in and out of Favorites and survives a relaunch.                                            |
| Delete             | Delete an imported definition.                                             | It is gone. The confirmation reads "Delete this exercise", distinct from the control that opened it. |
| Referenced         | Delete an imported definition a weekday plan references.                   | It is refused, naming the plans, exactly as for an authored definition.                              |
| Snapshot survives  | Delete an imported definition that a completed workout recorded.           | The completed workout keeps the exercise name and sets it captured.                                  |
| Logging-mode guard | Change the logging mode of an imported definition a plan references.       | It is refused with the same message an authored definition produces.                                 |

## Using them without authoring anything

| Check              | Steps                                                                                    | Expected result                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Plan               | Plan a weekday workout using only imported definitions.                                  | It saves and reopens with them.                                                                                          |
| Log                | Start a workout and record sets against imported definitions.                            | Each set is recorded and the workout completes.                                                                          |
| Every logging mode | Record one set in each of the eight logging modes, using imported definitions only.      | Every mode is reachable without authoring anything, and each form asks for its own fields.                               |
| Both unit systems  | Repeat one weight-based and one distance-based set with metric and imperial preferences. | Entry and display follow the preference; the stored canonical value matches for equivalent input.                        |
| Records            | Complete two workouts so a personal record is set and then beaten.                       | Records and Progress recompute from history, with no special case for imported definitions.                              |
| Picker             | Open the exercise picker in a plan and in an active workout with a populated catalog.    | Recents come first once a workout is completed; otherwise the whole catalog is listed and search reaches any definition. |

## Data lifecycle

| Check              | Steps                                                                                              | Expected result                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Not imported       | On a fresh install that has not imported, open the restore screen.                                 | Restore is available. The installation holds no information.                                                           |
| Imported           | Import, then open the restore screen.                                                              | Restore is refused because the installation holds records, exactly as it would after authoring definitions by hand.    |
| Restore an export  | Restore the export file onto a fresh installation that has not imported.                           | Every definition it contains is restored with its own identifier, and the starter offer is still available afterwards. |
| Replacement        | Use the export file to replace the data on a populated installation.                               | The replacement completes atomically and imported definitions are replaced like any other row.                         |
| Erasure            | Erase all local data after importing.                                                              | The library is empty, the installation reads as holding nothing, and the offer is available again.                     |
| Export contents    | Export after importing and inspect the file.                                                       | Imported definitions appear as ordinary catalog rows in format version 1. No origin or provenance field exists.        |
| Nothing else wrote | After each import, review Profile, Goals, Nutrition, Hydration, body weight, Planner, and History. | Every one is unchanged.                                                                                                |

## Accessibility, privacy, and failure

| Check                | Steps                                                              | Expected result                                                                                          |
| -------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| VoiceOver            | Import with VoiceOver on.                                          | The section header, explanation, and control are announced, and the result is announced when it appears. |
| TalkBack             | Repeat on Android.                                                 | The same.                                                                                                |
| Dynamic Type         | Set the largest text size and open the library.                    | The explanation and result wrap fully. No control is clipped or unreachable.                             |
| Keyboard             | Navigate the library with an external keyboard.                    | The control is reachable and shows a visible focus state.                                                |
| No colour-only cue   | Review the section.                                                | Nothing is conveyed by icon or colour alone.                                                             |
| Offline              | Import with the device in airplane mode.                           | It succeeds. Nothing is fetched.                                                                         |
| Failure              | Force a storage failure during the import if the device allows it. | A fixed sentence says nothing was changed, the catalog is exactly as it was, and no partial set exists.  |
| No sensitive logging | Watch the device log during an import.                             | No identifier, statement, table name, or path is logged.                                                 |
