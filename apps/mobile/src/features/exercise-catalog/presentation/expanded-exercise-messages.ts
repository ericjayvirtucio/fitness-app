import type { StarterExerciseImportRefusal } from '../application/add-starter-exercises-use-case';
import { expandedExerciseCount } from '../application/expanded-exercises';

/**
 * One fixed sentence per refusal, for the same reason the starter set's
 * messages are fixed: nothing here interpolates a name, an identifier, a
 * table, a statement, or a path, so a failed import cannot leak the catalog it
 * protects.
 */
const refusals: Readonly<Record<StarterExerciseImportRefusal, string>> = {
  'content-invalid':
    'The expanded library could not be added. Nothing was changed.',
  'write-failed':
    'The expanded library could not be added. Nothing was changed.',
};

export function expandedExerciseRefusalMessage(
  reason: StarterExerciseImportRefusal,
): string {
  return refusals[reason];
}

export const expandedExerciseSectionTitle = 'Expanded exercise library';

/**
 * Says what the act does and who owns the result, before the person presses
 * anything, for the same reason and in the same register as the starter
 * set's explanation. It avoids "default", "built-in", "system", "official",
 * and "recommended" for the same reason: the application is offering
 * content, not endorsing these movements or ranking them above a definition
 * the person writes. It is offered alongside the starter set, not in place
 * of it, so it names what it adds rather than implying it replaces anything.
 */
export const expandedExerciseExplanation =
  `Add ${expandedExerciseCount} more exercises across every equipment type ` +
  'in one step. They work exactly like exercises you create, so you can ' +
  'edit, favorite, or remove any of them individually afterward. Anything ' +
  'your library already holds stays untouched.';

export const expandedExerciseActionLabel = 'Add expanded exercise library';

export function expandedExerciseImportedMessage(
  addedCount: number,
  skippedCount: number,
): string {
  const added = `Added ${addedCount} ${plural(addedCount)} to your library.`;
  return skippedCount === 0
    ? added
    : `${added} ${skippedCount} ${skippedCount === 1 ? 'was' : 'were'} already in your library and ${skippedCount === 1 ? 'was' : 'were'} left unchanged.`;
}

export const expandedExerciseUnchangedMessage = `Your library already has all ${expandedExerciseCount} of these exercises. Nothing was added.`;

function plural(count: number): string {
  return count === 1 ? 'exercise' : 'exercises';
}
