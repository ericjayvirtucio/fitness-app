# Offline hydration troubleshooting

## Target does not persist

- **Symptoms:** The target is absent or reverts after returning or restarting.
- **Likely cause:** Validation rejected the amount, the save failed, or migration
  6 did not complete.
- **Diagnose:** Confirm the UI reported success, retry a positive target no greater
  than 20,000 mL, restart, and inspect only privacy-safe initialization errors.
- **Resolve:** Correct the input. If storage fails, retry initialization and fix
  the underlying migration/device-storage problem; never delete the database as
  automatic recovery.

## Entry is missing from a day

- **Symptoms:** A saved entry does not appear on the expected date.
- **Likely cause:** It was saved with another local date/time or edited onto
  another captured day.
- **Diagnose:** Navigate adjacent days and inspect the entry's displayed time.
- **Resolve:** Edit the entry to the intended local date and time. Do not rewrite
  captured dates from the device's current timezone.

## Totals or progress look incorrect

- **Symptoms:** Water, other-fluid, remaining, or percentage differs from expected.
- **Likely cause:** An entry category/amount is wrong, the current target changed,
  or the user is viewing a historical day where progress is intentionally absent.
- **Diagnose:** Add visible entry volumes, compare category subtotals, and verify
  today's configured target. Above target, remaining should be zero while actual
  total and percentage remain uncapped.
- **Resolve:** Correct the responsible entry or target. Never edit persisted
  summaries because summaries are derived.

## Migration or cold-start failure

- **Symptoms:** Product routes do not render, including offline cold start.
- **Likely cause:** Migration 6 or database initialization failed, storage is
  unavailable, or the installed database is newer than the application.
- **Diagnose:** Retry once and classify the safe persistence error. Verify the
  installed binary understands schema version 6 and device storage is available.
- **Resolve:** Install a compatible build or repair the environmental storage
  issue. Preserve the database; do not downgrade or reset it automatically.

## Edit or delete fails, or the screen looks stale

- **Symptoms:** A change reports failure, an entry no longer exists, or totals do
  not refresh immediately after returning.
- **Likely cause:** The row was removed, a write failed, or route focus did not
  reload the selected day.
- **Diagnose:** Return to Today, navigate away and back, and retry once. Confirm
  the entry still exists before editing.
- **Resolve:** Preserve form input after a failed write. Address the underlying
  persistence failure; successful route focus should reload totals.

## Timezone or offline behavior is surprising

- **Symptoms:** Historical days differ from the current timezone expectation or an
  offline operation appears unavailable.
- **Likely cause:** Historical membership intentionally uses the offset captured at
  occurrence, or database initialization failed independently of network state.
- **Diagnose:** Compare the entry's captured date/time rather than recalculating in
  the current timezone. Enable airplane mode and confirm local storage initializes.
- **Resolve:** Edit incorrect captured input explicitly. No Hydration action should
  require network access; investigate local initialization if it does not load.
