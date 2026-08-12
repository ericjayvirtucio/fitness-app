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

/**
 * Answers the same question for a whole installation, stopping at the first
 * capability that holds something. It lives beside the port because more than
 * one capability needs it: restoring refuses when this is true, and erasing
 * fails verification when it is still true afterwards.
 */
export async function holdsStoredData(
  probes: readonly StoredDataProbe[],
): Promise<boolean> {
  for (const probe of probes) {
    if (await probe.hasStoredRecords()) return true;
  }
  return false;
}
