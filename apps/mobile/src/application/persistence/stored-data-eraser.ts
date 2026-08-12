/**
 * Removes everything one capability stores.
 *
 * The counterpart to {@link StoredDataProbe}: the probe answers whether a
 * capability holds anything, and this removes it. Keeping them side by side per
 * capability means a new table is learned about once, by its owner, in the two
 * places that both have to know — rather than by a central list that has to be
 * remembered.
 *
 * The port returns nothing. A capability either erased its records or threw,
 * and the coordinator's verification, not a return value, decides whether the
 * installation is actually empty.
 */
export interface StoredDataEraser {
  eraseStoredRecords(): Promise<void>;
}
