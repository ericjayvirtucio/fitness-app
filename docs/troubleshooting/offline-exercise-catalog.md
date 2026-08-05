# Offline exercise catalog troubleshooting

## A referenced exercise cannot be deleted or change logging mode

This is expected once Workout Planner data uses the definition. Remove or replace
the exercise in each affected weekday named by the app, save those workouts, and
retry. Do not bypass the Planner foreign key or logging-mode trigger; see the
[Workout Planner troubleshooting guide](offline-workout-planner.md).

## Exercise does not appear in search

- **Symptoms:** A known exercise is absent from search results.
- **Likely cause:** The query does not occur in its normalized name, the row was
  deleted, or the catalog failed to reload.
- **Diagnose:** Clear the query, confirm the exercise appears under All exercises,
  then retry with different casing and collapsed whitespace.
- **Resolve:** Edit an incorrect name or return to the library to reload. Search is
  literal substring matching; synonyms and fuzzy matching are not supported.

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
