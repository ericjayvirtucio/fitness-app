# Starter exercise library troubleshooting

## Restore refuses on an installation that imported starter exercises

- **Symptoms:** The restore screen reports that this installation already holds
  information, on a device where the only thing the person did was add starter
  exercises.
- **Likely cause:** None. This is correct behavior.
- **Diagnose:** Confirm the Exercise Library holds definitions.
- **Resolve:** Imported definitions are ordinary records, so an installation
  holding them is not empty, exactly as one holding definitions the person typed
  is not. Erase all local data first, or restore onto an installation that has
  not imported. Do not weaken the emptiness check to exclude the catalog: it
  cannot tell an imported row from an authored one, and nothing in the product
  records the difference. See
  [ADR 0014](../decisions/0014-empty-installation-data-restore.md).

## Starter exercises are offered again after erasing all local data

- **Symptoms:** After erasure the Exercise Library is empty and still offers to
  add starter exercises.
- **Likely cause:** None. This is correct behavior.
- **Diagnose:** Confirm the library shows "No exercises yet".
- **Resolve:** The offer is code that ships in the application, not data in the
  database, so erasure cannot and should not remove it. Nothing is written until
  the person presses the control again.

## A deleted starter exercise comes back after importing again

- **Symptoms:** A definition the person deleted reappears after a later import.
- **Likely cause:** The import adds every starter definition the catalog does
  not currently hold, and a deleted one is not held.
- **Diagnose:** Confirm the definition is absent before the import and present
  after it.
- **Resolve:** Expected. Remembering a deletion would mean storing state about
  rows that no longer exist, which is the marker this design deliberately does
  not add. Delete it again, or do not import again.

## Fewer exercises were added than expected

- **Symptoms:** The result says fewer were added than the library offers, and
  names some as already held.
- **Likely cause:** The catalog already holds those names, or already holds
  those identifiers under different names after a restore.
- **Diagnose:** Search the library for a name the result did not add.
- **Resolve:** Expected. A definition the person already holds is never
  overwritten and never duplicated. To take the starter version instead, delete
  the existing definition first and import again.

## The import failed and nothing changed

- **Symptoms:** "Starter exercises could not be added. Nothing was changed."
- **Likely cause:** The write transaction failed, or a content entry could not
  be validated.
- **Diagnose:** Reopen the library and confirm the catalog is exactly as it was.
  Note only the safe error category; the sentence deliberately carries no
  identifier, table, or statement.
- **Resolve:** Retry once local storage is available. The import is atomic, so a
  failure leaves no partial set behind and no cleanup is required. Do not add a
  retry that writes definitions one at a time.

## A planned workout blocks deleting an imported exercise

- **Symptoms:** Deleting an imported definition reports the weekday plans using
  it.
- **Likely cause:** The Workout Planner references it, exactly as it would
  reference one the person authored.
- **Diagnose:** Open the named weekday plans.
- **Resolve:** Remove or replace the exercise in each plan and retry. See the
  [Exercise Catalog troubleshooting guide](offline-exercise-catalog.md).
