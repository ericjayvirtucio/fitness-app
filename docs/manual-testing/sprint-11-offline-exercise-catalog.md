# Sprint 11 manual QA: Offline exercise catalog

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Record device, OS, build, date, tester, result, and evidence for every available
target. A failure must be fixed, automatically reverified, and retested before
merge readiness.

## Startup and navigation

- [ ] **Existing app launch:** Launch normally. Expect all tabs and existing data
      to load without startup regression. This verifies migration 7 is non-destructive.
- [ ] **Open Workout:** Tap Workout. Expect an honest landing page with Exercise
      Library and no fake Planner or Session controls. This preserves future navigation.
- [ ] **Open empty library:** Open Exercise Library on a fresh catalog. Expect a
      clear create action and useful empty explanation. This verifies first-run UX.

## Create and validation

- [ ] **Weighted:** Create Barbell Bench Press with Barbell, Chest, Weight + reps.
      Expect a successful save and matching card metadata. This verifies resistance setup.
- [ ] **Bodyweight:** Create Push-up with Bodyweight, Chest, Bodyweight + reps.
      Expect successful validation. This verifies bodyweight logging semantics.
- [ ] **Timed:** Create Plank with No equipment, Core, Duration. Expect successful
      save. This verifies duration mode.
- [ ] **Cardio:** Create Treadmill with Cardio machine, Conditioning, Distance +
      duration. Expect successful save. This verifies canonical distance/time intent.
- [ ] **Invalid combination:** Choose Barbell with Bodyweight + reps and save.
      Expect a textual logging-mode error with form values retained. This verifies the
      domain boundary and recovery.
- [ ] **Field bounds:** Try blank and over-80-character names and over-500-character
      notes. Expect accessible field errors and no write. This protects stored integrity.

## Search, names, and favorites

- [ ] **Casing/whitespace:** Search `  BENCH   PRESS  `. Expect Bench Press to
      appear predictably. This verifies deterministic normalization.
- [ ] **Literal wildcards:** Use `%`, `_`, and `\` in a saved name and search for
      them. Expect literal matching, not wildcard expansion. This verifies safe search.
- [ ] **Similar names:** Save Bench Press and Incline Bench Press. Expect both with
      no merge. This preserves distinct exercises.
- [ ] **Exact duplicate:** Save another normalized Bench Press. Expect a warning;
      Review cancels, while Save another permits it. This verifies explicit duplicate policy.
- [ ] **Favorite:** Add an exercise to favorites, leave, reopen, and restart. Expect
      it in Favorites. Remove it and expect immediate persistence. This verifies metadata.
- [ ] **No fake recents:** Create and edit items. Expect no Recently used section.
      This verifies honest usage semantics.

## Edit and delete

- [ ] **Edit:** Change equipment, primary muscle, logging mode, and notes to a valid
      combination. Expect identity/favorite state retained and new metadata visible.
- [ ] **Delete confirmation:** Tap Delete. Expect confirmation naming the exercise;
      cancel and confirm it remains. This prevents accidental loss.
- [ ] **Confirm deletion:** Confirm Delete. Expect removal from all/search/favorites
      with no effect on Nutrition or Hydration. This verifies capability isolation.
- [ ] **Failure recovery:** Where practical, make storage unavailable during save or
      delete. Expect a safe message, no technical details, and retained form input.

## Persistence and offline behavior

- [ ] **Restart:** Force-close and reopen. Expect catalog and favorites unchanged.
- [ ] **Airplane mode:** Enable airplane mode and create, edit, search, favorite,
      and delete. Expect every operation to work. This verifies no network dependency.
- [ ] **Cold start offline:** Force-close in airplane mode and reopen. Expect schema
      initialization and library browsing to succeed.

## Accessibility and presentation

- [ ] **Light and dark modes:** Exercise screens remain readable with visible focus,
      borders, error, and destructive states. Meaning must not rely on color.
- [ ] **Large Dynamic Type:** Use a large accessibility text size. Expect scrollable,
      readable content without clipped controls.
- [ ] **VoiceOver:** Navigate search, selections, cards, favorite actions, errors,
      and confirmation. Expect meaningful labels, state, and order.
- [ ] **TalkBack where available:** Repeat the screen-reader flow on Android.
- [ ] **Keyboard:** Navigate and activate all fields, radio options, buttons, and
      dialogs with an external keyboard. Expect visible focus and no traps.
- [ ] **iOS and Android:** Complete the principal create/search/favorite/edit/delete
      journey on each available platform. This catches platform-specific behavior.

## Regression

- [ ] **Profile:** Load and save profile data without change.
- [ ] **Goals:** Load and save goal configuration and derived energy values.
- [ ] **Nutrition diary:** Add/edit/delete an entry and inspect daily totals.
- [ ] **Nutrition catalog:** Search, favorite, and reuse a saved item.
- [ ] **Hydration:** Add/edit/delete fluid and verify target progress.

Do not recommend merge until the repository owner confirms this checklist passes.
