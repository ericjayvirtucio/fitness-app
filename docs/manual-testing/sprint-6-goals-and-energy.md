# Sprint 6 manual QA: Goals and energy

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record platform, OS version, app build, date, tester, and pass/fail evidence. Do
not include sensitive profile values in shared screenshots or logs.

- [ ] **Existing profile loads correctly**
  - Do: Open Profile, confirm the saved fields, then open Goals & Energy.
  - Expect: The saved profile appears unchanged and the energy screen loads.
  - Why: Protects the Sprint 5 workflow and repository mapping.
- [ ] **BMI displays correctly**
  - Do: Independently calculate `kg / m²` for the test profile.
  - Expect: The screen matches to one decimal while retaining the expected category.
  - Why: Verifies canonical-unit calculation and display rounding.
- [ ] **BMI categories at representative values**
  - Do: Test profiles producing values below 18.5, from 18.5–24.9, 25–29.9, and 30+.
  - Expect: Underweight, Healthy weight, Overweight, and Obesity respectively.
  - Why: Verifies unrounded boundary classification.
- [ ] **BMR displays**
  - Do: Open Goals & Energy for an eligible female profile and an eligible male profile.
  - Expect: A positive whole-kcal estimated BMR appears with estimate wording.
  - Why: Exercises both published Mifflin-St Jeor coefficients.
- [ ] **Maintenance calories display**
  - Do: Change each Profile activity level and return to Goals & Energy.
  - Expect: Maintenance updates and remains labeled as estimated.
  - Why: Verifies all activity multipliers and focus refresh.
- [ ] **Lose-weight goal can be configured**
  - Do: Select Lose weight, enter 250, preview, and save.
  - Expect: Target is maintenance minus 250 and success is announced.
  - Why: Verifies deficit direction and persistence.
- [ ] **Maintain-weight goal can be configured**
  - Do: Select Maintain weight and save.
  - Expect: No adjustment field appears and target equals maintenance.
  - Why: Verifies the zero-adjustment invariant.
- [ ] **Gain-weight goal can be configured**
  - Do: Select Gain weight, enter 250, preview, and save.
  - Expect: Target is maintenance plus 250 and success is announced.
  - Why: Verifies surplus direction and persistence.
- [ ] **Calorie adjustment validation works**
  - Do: Try blank, fractional, 99, 501, over-25%, and below-1,000-target cases.
  - Expect: Safe textual validation appears and invalid goals are not saved.
  - Why: Confirms authoritative safety constraints and no UI-only validation.
- [ ] **Resulting calorie target updates correctly**
  - Do: Change goal type and several valid adjustments without saving each time.
  - Expect: Preview updates immediately using raw maintenance then whole-kcal formatting.
  - Why: Verifies transparent calculation and centralized rounding.
- [ ] **Restart the app**
  - Do: Save a goal, terminate the app, and relaunch it.
  - Expect: Saved goal remains correct and derived values reload.
  - Why: Verifies migration 3 and durable local persistence.
- [ ] **Missing/incomplete profile behaves safely**
  - Do: On disposable test data with no profile, open the deep Goals & Energy route.
  - Expect: No crash or defaults; the screen explains requirements and routes to Profile.
  - Why: Verifies explicit dependency handling.
- [ ] **Edit profile, then return to Goals**
  - Do: Change weight or activity, save, and return to Goals & Energy.
  - Expect: BMI and energy estimates use the latest profile.
  - Why: Verifies focus reload and non-persisted derived values.
- [ ] **Unsupported calculation profiles**
  - Do: Test age under 20, age over 78, Intersex, and Prefer not to say.
  - Expect: The app explains formula limits, never guesses, and shows BMI only when appropriate.
  - Why: Verifies inclusive storage without invented coefficients.
- [ ] **Light mode**
  - Do: Review all states in system light appearance.
  - Expect: Text, cards, controls, focus, and errors remain legible with sufficient contrast.
  - Why: Verifies semantic theme usage.
- [ ] **Dark mode**
  - Do: Repeat in system dark appearance.
  - Expect: All content remains legible without hard-coded colors.
  - Why: Verifies dark semantic tokens.
- [ ] **Large Dynamic Type**
  - Do: Set a large accessibility text size and traverse the full screen.
  - Expect: Text scales, content scrolls, and controls do not overlap or truncate meaning.
  - Why: Verifies responsive accessibility layout.
- [ ] **VoiceOver**
  - Do: Navigate every estimate, radio, field, error, and action on iOS.
  - Expect: Labels include metric meaning and units; selection and status are announced.
  - Why: Verifies nonvisual operability.
- [ ] **Keyboard interaction**
  - Do: Enter adjustments with the software/hardware keyboard and dismiss it.
  - Expect: Fields and Save remain reachable and focus order is logical.
  - Why: Verifies keyboard-aware layout and input semantics.
- [ ] **Cold start**
  - Do: Launch after full termination with an existing version-2 database.
  - Expect: Migration 3 applies once and routes appear only after initialization.
  - Why: Verifies real native migration behavior.
- [ ] **Background/foreground**
  - Do: Background on Goals & Energy, edit relevant test conditions if possible, then resume.
  - Expect: No crash, duplicate save, or sensitive data exposure; focus reload is coherent.
  - Why: Verifies mobile lifecycle behavior.
- [ ] **iOS verification**
  - Do: Complete this checklist on an iOS simulator or device.
  - Expect: Navigation, SQLite, keyboard, appearance, and accessibility behave correctly.
  - Why: Jest does not execute the native iOS database or assistive technology.
- [ ] **Android verification where available**
  - Do: Repeat critical flows on an Android emulator or device.
  - Expect: Back behavior, SQLite, keyboard, TalkBack semantics, and layout work correctly.
  - Why: Platform behavior differs from iOS.
- [ ] **Previous profile workflow still works**
  - Do: Create, edit, validate, save, restart, and reload a profile.
  - Expect: All Sprint 5 behavior remains correct; the new action opens Goals & Energy.
  - Why: Guards the prior vertical slice against regression.

If an item fails, record reproduction steps without sensitive values, return it for
repair, rerun relevant automated checks, and repeat the affected checklist section.
