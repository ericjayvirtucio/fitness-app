# Sprint 9 reusable Nutrition catalog manual testing

Record platform, OS, app revision, appearance, text size, assistive technology,
result, and evidence for each check. Do not recommend merge until the repository
owner confirms all required checks pass. If a check fails, preserve user data,
fix the defect, rerun relevant automated checks, and repeat affected manual tests.

## Core persistence and regression

### Existing Nutrition diary

1. Upgrade an installation containing Sprint 8 entries.
2. Open each captured calendar date and edit one entry without saving.

Expected: entries and totals load unchanged; cancellation changes nothing.
Why: migration 5 must preserve existing snapshots.

### Profile and Goals regressions

1. Load and edit Profile, then cancel and save separate attempts.
2. Open Goals & Energy and verify derived results and goal saving.

Expected: existing workflows remain operational with no warnings.
Why: catalog composition and migration must not disturb other capabilities.

### Restart, airplane mode, and cold start offline

1. Create, favorite, and log saved items.
2. Terminate and restart the app; repeat with airplane mode enabled.
3. Cold-start offline and search, edit, favorite, log, and delete a catalog item.

Expected: catalog, favorites, recents, and diary persist; no action requires network.
Why: complete offline behavior is the sprint's availability contract.

## Catalog creation and search

### Empty catalog

1. Open Nutrition and choose Add on a fresh catalog.

Expected: a clear empty state offers “Create first saved item,” and one-time entry
remains available. Why: the first-use path must not dead-end.

### Create Food

1. Create Chicken adobo, Food, per 100 g, with valid facts.
2. Leave fiber blank and enter sodium 0.

Expected: it saves, reopens with a 100 g reference, fiber unknown, and sodium zero.
Why: food dimension and unknown/zero semantics must survive persistence.

### Create Beverage

1. Create Orange juice, Beverage, per 100 mL.

Expected: it saves with milliliters and never requests grams or hydration data.
Why: beverage nutrition remains volume-based and separate from hydration.

### Search casing and whitespace

1. Search `  CHICKEN   adobo  ` and a distinctive partial substring.

Expected: Chicken adobo appears; its stored display name is unchanged.
Why: normalization must improve lookup without rewriting user presentation.

### Similar and duplicate names

1. Create Chicken breast adobo beside Chicken adobo.
2. Attempt another name differing only by case/whitespace.
3. Review the warning, then choose Keep both.

Expected: similar names coexist without warning; the exact normalized duplicate
requires confirmation and can coexist. Why: no destructive automatic merge occurs.

### Save existing diary entry as reusable

1. Open an entry logged from a 100 g reference at a consumed amount other than
   100 g and choose Save as reusable item.
2. Confirm or edit its name and save.

Expected: the new profile retains the original 100 g reference facts, not scaled
consumed facts. Why: reverse-scaling would be lossy and incorrect.

## Favorites, recents, and re-entry

### Favorite and remove favorite

1. Add Chicken adobo to favorites, restart, and reopen Add.
2. Remove it, leave Add, and reopen.

Expected: both states persist and Favorites updates correctly.
Why: favorite state is durable catalog metadata.

### Recent item

1. Note current Recents, then successfully log a saved item twice.
2. Reopen Add.

Expected: the item moves according to last use; creation/edit alone does not.
Why: recency represents actual usage.

### Log saved Food

1. Select Chicken adobo per 100 g at 200 kcal.
2. Enter 175 g and choose Log to today.

Expected: today's diary immediately contains 350 kcal with nutrients scaled 1.75×.
Why: fast re-entry must reuse deterministic scaling.

### Log saved Beverage

1. Select juice per 100 mL and enter 350 mL.

Expected: a beverage snapshot scaled 3.5× appears in today's diary.
Why: volume remains dimensionally separate from mass.

### Invalid consumed quantity

1. Attempt blank, zero, negative, and nonnumeric amounts.

Expected: textual errors remain on the quantity form; no diary or recent update
occurs. Why: validation and atomicity prevent partial writes.

## Historical independence

### Unknown and known zero

1. Log an item containing an unknown nutrient and a known-zero nutrient.
2. Inspect its entry and daily totals.

Expected: unknown remains incomplete and zero remains numeric zero.
Why: missing information must never become a false measurement.

### Edit future reuse only

1. Log a saved item and record the historical nutrition.
2. Edit the catalog energy and nutrients.
3. Reinspect the old entry, then log the item again.

Expected: the old entry is unchanged; the new entry uses updated facts.
Why: diary entries are immutable catalog-independent snapshots.

### Delete without deleting history

1. Delete a used catalog item and confirm the destructive dialog.
2. Search for it, then inspect its historical diary date and totals.

Expected: the catalog item disappears; history and totals remain intact.
Why: no catalog-to-diary dependency or cascade is permitted.

## Accessibility and platforms

### Light, dark, and large Dynamic Type

1. Repeat browse, create, edit, log, and confirmation flows in both appearances.
2. Repeat at the largest practical text setting.

Expected: contrast, wrapping, scrolling, focus visibility, and touch targets remain
usable without clipped meaning. Why: appearance and text size cannot block logging.

### VoiceOver and TalkBack

1. Navigate search results, favorite controls, forms, errors, busy states, and
   delete confirmation using each available screen reader.

Expected: result summaries include name/type/reference; favorite actions say add
or remove plus name; units and errors are announced; focus order is logical.
Why: meaning must not depend on icons, color, or visual layout.

### Keyboard interaction

1. Navigate all new screens with a hardware keyboard where supported.
2. Enter search and quantities and activate every action.

Expected: all controls are reachable, focus is visible, and dialogs can be safely
cancelled or confirmed. Why: keyboard access is part of the interaction contract.

### iOS and Android

1. Run the complete critical flow on iOS.
2. Repeat on Android where available, including restart and delete dialogs.

Expected: migration, SQLite persistence, navigation, keyboard avoidance, and
accessibility behavior are equivalent. Why: native behavior requires device-level
verification beyond deterministic Jest fakes.
