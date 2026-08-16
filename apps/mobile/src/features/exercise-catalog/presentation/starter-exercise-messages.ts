import type { StarterExerciseImportRefusal } from '../application/add-starter-exercises-use-case';
import { starterExerciseCount } from '../application/starter-exercises';

/**
 * One fixed sentence per refusal.
 *
 * Nothing here interpolates a name, an identifier, a table, a statement, or a
 * path, so a failed import cannot leak the catalog it protects.
 */
const refusals: Readonly<Record<StarterExerciseImportRefusal, string>> = {
  'content-invalid':
    'Starter exercises could not be added. Nothing was changed.',
  'write-failed': 'Starter exercises could not be added. Nothing was changed.',
};

export function starterExerciseRefusalMessage(
  reason: StarterExerciseImportRefusal,
): string {
  return refusals[reason];
}

export const starterExerciseSectionTitle = 'Starter exercises';

/**
 * Says what the act does and who owns the result, before the person presses
 * anything. It deliberately avoids "default", "built-in", "system", "official",
 * and "recommended": the application is offering content, not endorsing these
 * movements or ranking them above a definition the person writes.
 */
export const starterExerciseExplanation =
  `Add ${starterExerciseCount} common exercises to your library in one step. ` +
  'They work exactly like exercises you create, so you can rename, change, ' +
  'favorite, or delete any of them. Exercises you already have are left alone.';

export const starterExerciseActionLabel = 'Add starter exercises';

export function starterExerciseImportedMessage(
  addedCount: number,
  skippedCount: number,
): string {
  const added = `Added ${addedCount} ${plural(addedCount)} to your library.`;
  return skippedCount === 0
    ? added
    : `${added} ${skippedCount} ${skippedCount === 1 ? 'was' : 'were'} already in your library and ${skippedCount === 1 ? 'was' : 'were'} left unchanged.`;
}

export const starterExerciseUnchangedMessage = `Your library already has all ${starterExerciseCount} starter exercises. Nothing was added.`;

function plural(count: number): string {
  return count === 1 ? 'exercise' : 'exercises';
}
