# Offline exercise catalog troubleshooting

Definitions added from the starter set behave exactly like ones typed by hand, so
every guide below applies to them unchanged. Problems specific to the import
itself are in the
[starter exercise library guide](starter-exercise-library.md).

## A referenced exercise cannot be deleted or change logging mode

This is expected once Workout Planner data uses the definition. Remove or replace
the exercise in each affected weekday named by the app, save those workouts, and
retry. Do not bypass the Planner foreign key or logging-mode trigger; see the
[Workout Planner troubleshooting guide](offline-workout-planner.md).

## Exercise does not appear in search

- **Symptoms:** A known exercise is absent from search results.
- **Likely cause:** The query does not occur in its normalized name, a filter
  excludes it, the row was deleted, or the catalog failed to reload.
- **Diagnose:** Clear the query and press Clear filters, confirm the exercise
  appears under All exercises, then retry with different casing and collapsed
  whitespace.
- **Resolve:** Edit an incorrect name or return to the library to reload. Search is
  literal substring matching; synonyms and fuzzy matching are not supported.

## The library looks empty after filtering

- **Symptoms:** No exercises are listed while a filter is applied.
- **Likely cause:** No definition carries both the chosen equipment and the chosen
  primary muscle group. The starter set, for example, contains no dumbbell chest
  exercise.
- **Diagnose:** Read the line above the list. It states what is filtered and
  whether the search is also narrowing the result. "No exercises yet" is the only
  message that means the library itself is empty, and it never appears while
  anything is narrowed.
- **Resolve:** Press Clear filters, or choose a different value. Filters are held
  by the screen only and are cleared by relaunching the app; nothing about them
  is stored.

## The filters cannot be found

- **Symptoms:** The equipment and muscle-group options are not on screen.
- **Likely cause:** They are put away. The library and every exercise picker show
  one "Filters" button in their place, directly above the lists it narrows, and
  the options open when it is pressed.
- **Diagnose:** On the library, look between the starter-exercise section and the
  first list; in a picker, look directly under the search field. The button is
  absent only when there is nothing to narrow, which means the catalog is empty.
- **Resolve:** Press it. Nothing about whether the options are open or away is
  stored, so every screen opens with them away.

## A picker lists nothing while a filter is applied

- **Symptoms:** Choosing an exercise for a plan, an active workout, or a completed
  workout shows no cards.
- **Likely cause:** No definition carries both chosen values. The picker also
  stops showing recently performed exercises while anything is narrowing the
  catalog, exactly as the library stops showing Favorites and Recently performed.
- **Diagnose:** Read the line under the Filters button. It states what is narrowed
  and how many matched. "No exercises found" means the catalog itself is empty and
  never appears while a filter is applied.
- **Resolve:** Press Clear filters or choose different values. A filter belongs to
  the picker: dismissing it and choosing again starts unnarrowed, exactly as a
  typed search already does.

## The library says it is showing the first 100 exercises

- **Symptoms:** A sentence above the list reports that only the first 100
  exercises, or the first 50 matches, are shown.
- **Likely cause:** The catalog holds more definitions than a single list is read
  under. Lists are deliberately bounded.
- **Diagnose:** The bound is per list: 100 while browsing, 50 while searching.
  The message appears only when a list came back at exactly that bound.
- **Resolve:** Narrow with a filter or a search. Do not raise the bound as a
  workaround; paging is deferred, and the message exists so a truncated list is
  never shown silently.

## Favorite does not persist

- **Symptoms:** Favorite state reverts after leaving the screen or restarting.
- **Likely cause:** The SQLite update failed or migration 7 did not complete.
- **Diagnose:** Toggle once, return to Workout and reopen the library, then restart
  the app. Note only the safe persistence error category.
- **Resolve:** Retry after local storage is available. Do not add an in-memory
  favorite workaround or delete the database as automatic recovery.

## Logging mode is rejected

- **Symptoms:** Save reports that equipment and logging mode are incompatible.
- **Likely cause:** Bodyweight, assistance, or distance mode uses equipment that
  violates the documented domain combination.
- **Diagnose:** Review both controlled fields. For example, bodyweight modes need
  Bodyweight; distance modes need No equipment, Cardio machine, or Other.
- **Resolve:** Choose a coherent combination. Do not bypass domain validation or
  store a free-text mode.

## Duplicate-name warning is unexpected

- **Symptoms:** Saving asks whether to create another exercise with this name.
- **Likely cause:** Another item has the same name after trimming, whitespace
  collapse, and lowercase normalization.
- **Diagnose:** Search the exact name and inspect the matching definitions.
- **Resolve:** Review the existing item, rename the new one, or explicitly choose
  Save another. Similar names are permitted and no records are merged.

## Edit looks stale or delete fails

- **Symptoms:** A changed value is not visible, or delete reports failure.
- **Likely cause:** The row no longer exists, a write failed, or the focused route
  has not reloaded.
- **Diagnose:** Return to Exercise Library, navigate away and back, and retry once.
- **Resolve:** Preserve form input after failure and address local persistence.
  Successful focus reloads the current SQLite state.

## Catalog is missing after restart

- **Symptoms:** Previously saved exercises are absent after cold start.
- **Likely cause:** A different app installation/database is open, initialization
  failed, or records were deleted.
- **Diagnose:** Confirm the same build and device profile, then classify the safe
  startup error without logging names or notes.
- **Resolve:** Restore the correct installation context or repair device storage.
  Backup and restore are not yet available.

## Migration or offline startup fails

- **Symptoms:** Product routes do not render, including in airplane mode.
- **Likely cause:** Migration 7 failed, storage is unavailable, or the installed
  database is newer than the application.
- **Diagnose:** Retry once, verify the build supports schema version 7, and confirm
  device storage is available. Network state is unrelated.
- **Resolve:** Install a compatible build or repair local storage. Preserve the
  database; do not automatically downgrade or reset it.
