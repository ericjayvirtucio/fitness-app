# Sprint 43 manual QA: A usable exercise library can be added to

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, timezone, appearance, text size, network state, and
result. Use synthetic data on a disposable QA target. Do not repeat the
offered empty state, the stated result, renaming/favoriting/deleting an
imported definition, a second import, a preserved hand-authored name,
cross-pack coexistence, and relaunch behavior that the Sprint 43 Maestro suite
already automates.

Never enter a real person's measurements or training history.

## Preparing the fixtures

| Fixture             | How to produce it                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| Fresh install       | Delete the app and reinstall it, so the installation has never held a record.                        |
| Some names held     | A library holding a hand-authored definition named exactly one expanded-pack name, e.g. `Chest Dip`. |
| Every name held     | A library where the expanded pack has already been imported.                                         |
| Both packs imported | A library where the starter set and the expanded pack have both been imported.                       |
| Export file         | An export created after importing both packs, kept for the restore and replacement checks.           |

## Import behavior

| Check                 | Steps                                                                                                                                                                         | Expected result                                                                                                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh install         | Open the Exercise Library on the fresh-install fixture, before pressing anything.                                                                                             | The library is empty. It offers "Create first exercise", "Add starter exercises", and "Add expanded exercise library". Nothing is written.                                                                                                                                                                                    |
| Explanation first     | Read the expanded section before pressing.                                                                                                                                    | It states the count (189), that the definitions behave like ones you create, and that anything already held is untouched.                                                                                                                                                                                                     |
| Import                | Add the expanded pack from an empty library.                                                                                                                                  | 189 definitions are added, and the result names the count.                                                                                                                                                                                                                                                                    |
| Representative spread | Search for one entry of each equipment type (e.g. `Barbell Curl`, `Kettlebell Windmill`, `Cable Curl`, `Band Squat`, `Assisted Sit-up`, `Cycle Cross Trainer`, `Bear Crawl`). | Each is found, classified correctly, and none is favorited.                                                                                                                                                                                                                                                                   |
| Some names held       | Import onto the some-names-held fixture.                                                                                                                                      | The person's own definition is untouched, the matching expanded entry is skipped, and the result names the skipped count (188 added, 1 skipped).                                                                                                                                                                              |
| Every name held       | Import onto the every-name-held fixture.                                                                                                                                      | Nothing is added, and the result says so rather than claiming an addition.                                                                                                                                                                                                                                                    |
| Both packs            | Import the starter set, then the expanded pack (either order).                                                                                                                | Both complete in full — 26 and 189 — with neither reporting the other's content as already held.                                                                                                                                                                                                                              |
| Import twice          | Import the expanded pack, then import it again immediately.                                                                                                                   | The second import adds nothing and says so.                                                                                                                                                                                                                                                                                   |
| Duplicate request     | Press the expanded control twice in quick succession.                                                                                                                         | Exactly one import runs. The control is unavailable while the write is in flight.                                                                                                                                                                                                                                             |
| Delete then import    | Rename, re-equip, or favorite an expanded-pack definition, delete it, then import the expanded pack again.                                                                    | The definition comes back with the edited name/equipment/favorite state intact, not reset to the bundled defaults. The result names it as added (188 others already held, this one plus any never-imported entries counted as added). See the note below — resolved in Sprint 44, and applies identically to the starter set. |
| Relaunch              | Import, then stop and relaunch the app.                                                                                                                                       | Every definition is still there. The earlier result sentence is gone.                                                                                                                                                                                                                                                         |

> **Note on "Delete then import."** Sprint 27's manual QA doc says deleting an
> imported starter exercise and importing again adds it back. Sprint 42
> changed deletion for this table from a hard delete to a tombstone
> (`deleted_at_epoch_ms`), which broke that: a re-import tried to `INSERT` a
> row whose identifier still physically existed and collided with the
> primary key, refusing the whole import. Sprint 43 recorded that regression
> without fixing it. Sprint 44 (Specification 0044) resolves it: the import
> now tries `ExerciseCatalogRepository.restore` before `insert`, which clears the
> tombstone on a matching identifier and revives the row exactly as it was
> last stored — a rename, re-equip, note, or favorite made before the
> deletion survives — rather than resetting it to the bundled content or
> refusing the whole import. `originating_device_id` stays the device that
> first created the row; `revision` and `updated_at_epoch_ms` advance as they
> would for any other change. Applies identically to the starter set.

## Ownership of what was imported

| Check       | Steps                                                                           | Expected result                                                                           |
| ----------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Rename      | Rename an expanded-pack definition.                                             | It saves like any other, and the library shows the new name.                              |
| Re-classify | Change an expanded-pack definition's equipment, muscle group, and logging mode. | Each saves, subject to the same compatibility rules an authored definition obeys.         |
| Favorite    | Favorite and unfavorite an expanded-pack definition.                            | It moves in and out of Favorites and survives a relaunch.                                 |
| Delete      | Delete an expanded-pack definition.                                             | It is gone. The confirmation reads "Delete this exercise".                                |
| Plan/log    | Plan and complete a workout using only expanded-pack definitions.               | It saves, reopens, and completes with no special case for where the definition came from. |

## Search, filter, and scale

| Check                   | Steps                                                                        | Expected result                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Search after both packs | With both packs imported (215 definitions), search by name.                  | Results return promptly and match only the typed text.                                                          |
| Equipment filter        | Filter by an equipment value present in the expanded pack (e.g. Kettlebell). | Only matching definitions are listed, across both packs.                                                        |
| Muscle filter           | Filter by a muscle group present in the expanded pack.                       | Only matching definitions are listed, across both packs.                                                        |
| Empty search            | Search for text that matches nothing.                                        | A plain "no results" statement appears — never "No exercises yet", which is reserved for a truly empty library. |
| Truncation              | With both packs imported, browse the unfiltered list.                        | The list states plainly if it is showing the first page rather than silently cutting off.                       |
| Exercise Picker         | Open the picker in a plan and in an active workout with both packs imported. | Search reaches any definition from either pack; the whole-catalog fallback is not the only way to find one.     |

## Data lifecycle

| Check              | Steps                                                                                                                                                                                              | Expected result                                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restore            | Restore the export file (both packs) onto a fresh installation that has not imported.                                                                                                              | Every definition from both packs is restored with its own identifier, and both offers are still available afterward.                                                                                                                                     |
| Replacement        | Use the export file to replace the data on a populated installation.                                                                                                                               | The replacement completes atomically; expanded-pack definitions are replaced like any other row.                                                                                                                                                         |
| Erasure            | Erase all local data after importing both packs.                                                                                                                                                   | The library is empty, the installation reads as holding nothing, and both offers are available again.                                                                                                                                                    |
| Export contents    | Export after importing both packs and inspect the file.                                                                                                                                            | Definitions from both packs appear as ordinary catalog rows in format version 1. No pack or origin field exists.                                                                                                                                         |
| Sync metadata      | After importing, inspect (or have engineering inspect) `updated_at_epoch_ms`, `revision`, and `originating_device_id` on a few expanded-pack rows, including one that was deleted and re-imported. | Each is populated exactly as for a hand-authored row — no special case for imported content. The resurrected row's `revision` is higher than it was before deletion (not reset to 1), and `originating_device_id` is unchanged from before the deletion. |
| Nothing else wrote | After each import, review Profile, Goals, Nutrition, Hydration, body weight, Planner, and History.                                                                                                 | Every one is unchanged.                                                                                                                                                                                                                                  |

## Accessibility, privacy, and failure

| Check                | Steps                                                                       | Expected result                                                                                                              |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| VoiceOver            | Import the expanded pack with VoiceOver on.                                 | The section header, explanation, and control are announced, and the result is announced when it appears.                     |
| TalkBack             | Repeat on Android.                                                          | The same.                                                                                                                    |
| Dynamic Type         | Set the largest text size and open the library with both packs imported.    | The explanation and result wrap fully. No control is clipped or unreachable. Scrolling to either import section still works. |
| Keyboard             | Navigate the library with an external keyboard.                             | The expanded control is reachable and shows a visible focus state.                                                           |
| No colour-only cue   | Review the section.                                                         | Nothing is conveyed by icon or colour alone.                                                                                 |
| Offline              | Import the expanded pack with the device in airplane mode.                  | It succeeds. Nothing is fetched — the pack is bundled, not downloaded.                                                       |
| Failure              | Force a storage failure during the expanded import if the device allows it. | A fixed sentence says nothing was changed, the catalog is exactly as it was, and no partial set exists.                      |
| No sensitive logging | Watch the device log during an import.                                      | No identifier, statement, table name, or path is logged.                                                                     |

## iOS and Android regression

Run the full regression suite (`./scripts/qa.sh regression`) on both platforms
after the expanded pack has been imported at least once during the run, so
regression scenarios that touch the Exercise Library or the Exercise Picker
exercise a populated, not just a starter-sized, catalog.
