# Goals and energy troubleshooting

## Calculations are unavailable

- **Symptom:** The screen asks for a profile or says the estimate is unavailable.
- **Likely cause:** No profile exists, age is outside 20–78, or the selected
  biological-sex value has no Mifflin-St Jeor coefficient.
- **Diagnose:** Open Profile and review every field without logging its value.
- **Resolve:** Complete or correct the profile. Do not substitute a value merely
  to obtain an estimate; unsupported formula inputs are an intentional limitation.

## Goal configuration is rejected

- **Symptom:** An adjustment error appears or no target preview is available.
- **Likely cause:** The value is not a whole 100–500 kcal/day, exceeds 25% of
  maintenance, or would produce a target below 1,000 kcal/day.
- **Diagnose:** Compare the visible maintenance estimate and safe validation copy.
- **Resolve:** Choose a smaller adjustment or Maintain weight. Do not bypass the
  domain rule in presentation.

## Goal does not persist

- **Symptom:** Saving shows a generic failure or restart restores the old goal.
- **Likely cause:** SQLite write failure or an unavailable migration.
- **Diagnose:** Confirm persistence initialization succeeded and schema version 3
  is installed. Inspect controlled development diagnostics without SQL values or
  profile/goal records.
- **Resolve:** Retry once. Fix the adapter or ship a new forward migration; never
  edit an applied migration or automatically delete user data.

## Estimates remain stale after profile editing

- **Symptom:** Returning from Profile appears to show prior calculations.
- **Likely cause:** The Goals & Energy route did not regain focus or the profile
  save did not complete.
- **Diagnose:** Confirm Profile displayed its success message, then navigate back
  through the Goals & Energy action.
- **Resolve:** Re-enter the route. If reproducible, verify the focus reload and
  `GetEnergySummaryUseCase`; do not cache derived values in SQLite.

## Birthday boundary looks wrong

- **Symptom:** Eligibility or BMR changes a day earlier or later than expected.
- **Likely cause:** Incorrect device-local date or misunderstanding of leap-day
  behavior.
- **Diagnose:** Check the device date and timezone. February 29 birthdays advance
  on March 1 in non-leap years.
- **Resolve:** Correct device time settings. Keep domain inputs as `YYYY-MM-DD` and
  do not convert them through UTC timestamps.

## Units look inconsistent

- **Symptom:** Profile uses imperial units while energy displays kcal/day.
- **Likely cause:** Calculations use canonical metric measurements regardless of
  the profile's display preference.
- **Diagnose:** Confirm Profile shows the expected stored height and weight.
- **Resolve:** Correct the profile measurement if necessary. Do not convert or
  round canonical values inside the calculation or persistence layers.
