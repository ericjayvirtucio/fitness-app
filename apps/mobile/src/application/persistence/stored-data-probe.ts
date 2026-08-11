/**
 * Asks one capability whether it holds anything the user created.
 *
 * Restoring a saved export is only supported into an installation with nothing
 * to lose, and "nothing" is not "no profile": nutrition, hydration, exercise,
 * planner, session, and measurement records can all exist on their own. Each
 * capability answers for its own tables so the coordinator never has to know
 * them, and the answer is deliberately a boolean: a count would invite showing
 * the user what they are about to keep.
 */
export interface StoredDataProbe {
  hasStoredRecords(): Promise<boolean>;
}
