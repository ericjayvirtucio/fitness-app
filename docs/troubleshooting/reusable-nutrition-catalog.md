# Reusable nutrition catalog troubleshooting

## Saved item does not appear in search

- **Symptoms:** a known item is absent.
- **Likely causes:** extra literal terms, a failed save, or stale display.
- **Diagnostics:** clear the query, reopen Add, and search a distinctive substring.
- **Resolution:** retry the save or reload Add. Search handles case and whitespace,
  but not synonyms, spelling differences, or fuzzy matching.

## Favorite does not persist

- **Symptoms:** the item leaves Favorites after restart.
- **Likely causes:** a failed local write or deletion.
- **Diagnostics:** toggle it and confirm no storage error appears.
- **Resolution:** retry once. Preserve the database and inspect privacy-safe driver
  diagnostics if local storage repeatedly fails.

## Recent ordering looks incorrect

- **Symptoms:** creation or editing did not move an item to the top.
- **Likely causes:** only successful diary logging changes recency.
- **Diagnostics:** log the item, return to Nutrition, and reopen Add.
- **Resolution:** do not recreate it; recency is usage-based by design.

## Catalog item fails validation

- **Symptoms:** fields show errors or saving is refused.
- **Likely causes:** blank name, invalid reference, negative facts, or a changed
  food/beverage dimension without a new reference amount.
- **Diagnostics:** review every textual error and displayed unit.
- **Resolution:** enter a positive reference and nonnegative facts; blank optional
  nutrients mean unknown and zero means known zero.

## Log-from-catalog or usage update fails

- **Symptoms:** no diary entry appears or the item does not become recent.
- **Likely causes:** invalid consumed amount, deleted item, stale screen, or a
  transaction failure.
- **Diagnostics:** confirm a positive amount in the shown unit, return to the
  diary, and reopen Add.
- **Resolution:** retry once. Diary insertion and usage update are atomic, so a
  failed transaction must not leave a partial result.

## Catalog deletion appears to remove history

- **Symptoms:** an expected old diary entry is not visible.
- **Likely causes:** the diary is showing a different captured calendar date.
- **Diagnostics:** navigate to the entry's original local date. Catalog deletion
  never queries or modifies diary rows.
- **Resolution:** select the correct day. Preserve the database if history is
  actually missing and treat it as a defect.

## Migration failure

- **Symptoms:** startup reports local storage could not be updated.
- **Likely causes:** migration or database failure, or a newer schema.
- **Diagnostics:** confirm the binary version and inspect privacy-safe development
  diagnostics without deleting the database.
- **Resolution:** install a compatible fixed build. Never edit an applied migration
  or clear real user data as routine recovery.

## Stale display or case/whitespace surprise

- **Symptoms:** edited facts look old or an exact-looking search misses.
- **Likely causes:** mounted presentation state, punctuation, accents, or spelling;
  normalization covers only case and whitespace.
- **Diagnostics:** reopen Add and search a smaller literal substring.
- **Resolution:** reload or use the stored spelling. Do not alter diary snapshots
  to compensate for catalog presentation state.
