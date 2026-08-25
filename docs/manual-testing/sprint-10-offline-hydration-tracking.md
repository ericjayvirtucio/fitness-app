# Sprint 10 manual testing: Offline hydration tracking

> Current process: perform these checks manually on a physical device and record
> results with [the manual testing guide](README.md). Any Maestro, `scripts/qa.sh`,
> sprint-suite, or automated-regression instruction below is retired historical
> context, not a command or release gate.

Run on an iOS simulator/device and Android target where available. Record target,
OS version, result, and evidence for every item. If any item fails, stop, report
the exact step, fix it, rerun relevant automated checks, and repeat the affected
manual checks.

## Persistence and core workflow

| Check                      | Steps                                                                                                            | Expected result                                                                                     | Reason                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Existing app launch        | Install/update the build, launch normally, and wait for Today.                                                   | Startup completes with no storage or route regression.                                              | Proves migration 6 and the persistence gate do not block existing installs. |
| Open Hydration             | Select the Today tab after visiting another tab.                                                                 | Hydration loads with date navigation, totals, target state, and add action.                         | Verifies the new primary entry point and focus reload.                      |
| No-target state            | On a database without a target, open Today.                                                                      | Totals remain usable and a clear “Set daily target” action appears without a recommendation.        | Confirms target absence is supported and no value is invented.              |
| Set target                 | Choose Set daily target, select liters, enter `3.0`, and save.                                                   | Today displays a 3 L target.                                                                        | Verifies deterministic L-to-mL conversion and target ownership.             |
| Restart target persistence | Force-close and relaunch after setting 3 L.                                                                      | The 3 L target remains available.                                                                   | Confirms durable singleton persistence and cold reconstruction.             |
| Add water                  | Add fluid, keep Water, choose `500 mL`, and save.                                                                | Today total and plain-water subtotal become 500 mL.                                                 | Verifies the fast preset path and canonical volume storage.                 |
| Add second entry           | Add Water with `750 mL` and save.                                                                                | Total and water subtotal become 1.25 L with two entries.                                            | Verifies deterministic addition and multiple-row ordering.                  |
| Progress                   | With a 3 L target and 1.25 L total, inspect the target card.                                                     | It shows about 42% complete and 1.75 L remaining.                                                   | Verifies percentage and remaining calculations.                             |
| Exceed target              | Add enough explicit fluid to raise the total above 3 L.                                                          | Actual total remains visible, percentage exceeds 100%, and remaining is zero.                       | Confirms intake is never silently capped.                                   |
| Other fluid                | Add Other fluid, enter `350 mL`, optionally name it Tea, and save.                                               | Total rises by 350 mL, other-fluid subtotal rises, and Nutrition is unchanged.                      | Verifies explicit other-fluid policy and capability separation.             |
| Custom amount              | Add a custom `625 mL` entry instead of a preset.                                                                 | Exactly 625 mL is persisted and included.                                                           | Confirms the workflow is not limited to presets.                            |
| Edit entry                 | Open an entry, change volume, type where appropriate, and date/time, then save.                                  | Identity remains represented by the same entry, values update, and affected day totals recalculate. | Verifies complete replacement and correction behavior.                      |
| Delete entry               | Open an entry, choose Delete fluid, and confirm Delete.                                                          | Confirmation appears first; after confirmation the row disappears and totals update.                | Verifies destructive confirmation and hard-delete semantics.                |
| Cancel deletion            | Open another entry, choose Delete fluid, then Cancel.                                                            | The entry and totals remain unchanged.                                                              | Confirms cancellation is safe.                                              |
| Day navigation             | Create entries on today and a previous date; use Previous, Next, and Today.                                      | Each entry appears only on its captured local date; historical dates omit target-progress claims.   | Verifies focused daily queries and honest current-target semantics.         |
| Timezone behavior          | If practical, record an entry near day boundary, change device timezone, relaunch, and revisit its captured day. | The historical entry remains on the originally captured day.                                        | Verifies travel does not regroup history.                                   |

## Offline and regression

| Check              | Steps                                                                                  | Expected result                                           | Reason                                                       |
| ------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| Offline mode       | Enable airplane mode and create, read, edit, delete, navigate days, and change target. | Every operation succeeds without a network request.       | Proves the core capability is offline-first.                 |
| Cold start offline | Force-close in airplane mode and relaunch.                                             | Persistence initializes and Hydration state loads.        | Verifies no startup network dependency.                      |
| Nutrition diary    | Open Nutrition and inspect, create, and edit an existing diary entry.                  | Existing entries and totals remain intact.                | Detects migration, route, or domain regressions.             |
| Nutrition catalog  | Search, favorite, and reuse a saved catalog item.                                      | Catalog content and atomic reuse behavior remain intact.  | Confirms Hydration did not couple to catalog persistence.    |
| Profile            | Open and save Personal Profile.                                                        | Existing profile data and validation behave normally.     | Confirms singleton and migration independence.               |
| Goals & Energy     | Open Goals & Energy and inspect/save a goal.                                           | Existing calculations and goal persistence remain normal. | Confirms Hydration target did not leak into Goals ownership. |

## Appearance and accessibility

| Check              | Steps                                                                               | Expected result                                                                                    | Reason                                            |
| ------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Light mode         | Exercise daily, entry, target, and confirmation screens in light appearance.        | Text, controls, focus, errors, and progress meaning are clear.                                     | Verifies semantic light-theme use.                |
| Dark mode          | Repeat the same screens in dark appearance.                                         | Content remains readable with no color-only meaning.                                               | Verifies semantic dark-theme use.                 |
| Large Dynamic Type | Set a large accessibility text size and repeat the main flows.                      | Content reflows and scrolls; labels and actions are not clipped.                                   | Verifies scalable text and scroll-safe layouts.   |
| VoiceOver          | On iOS, navigate totals, progress, presets, fields, cards, and delete confirmation. | Names, roles, checked/busy states, units, and actual progress are understandable in logical order. | Verifies nonvisual use and semantic progress.     |
| TalkBack           | On Android where available, repeat the VoiceOver flow.                              | The same information and operations are accessible.                                                | Verifies Android assistive-technology behavior.   |
| Keyboard           | Navigate and activate all controls using a hardware keyboard where supported.       | Focus is visible/logical and every operation is reachable.                                         | Verifies non-touch interaction.                   |
| iOS                | Complete the core workflow, restart, and offline checks on iOS.                     | Native SQLite, routing, alerts, and keyboard behavior work.                                        | Jest fakes do not prove native iOS integration.   |
| Android            | Complete the core workflow, restart, and offline checks on Android where available. | Native SQLite, routing, alerts, and keyboard behavior work.                                        | Detects Android-specific integration differences. |

## Completion record

Manual QA is complete only after every applicable row is marked passed and any
failure has been fixed and retested. Record unavailable targets explicitly; do
not silently mark them passed. Do not push, open a pull request, or recommend a
merge until the repository owner confirms this checklist.
