import type { CompletedExerciseRemovalRefusal } from '../application/remove-completed-workout-exercise-use-case';

/**
 * One fixed sentence per refusal.
 *
 * Nothing here interpolates an exercise name, a recorded value, a date, or an
 * identifier, so a removal failure can never leak the history it protects.
 */
const messages: Readonly<Record<CompletedExerciseRemovalRefusal, string>> = {
  changed:
    'This workout changed since this screen opened. Open it again before removing an exercise.',
  'exercise-not-found':
    'This exercise is no longer part of the completed workout.',
  'not-completed': 'This workout is no longer completed history.',
  'not-found': 'This completed workout is no longer available.',
  'would-empty-workout':
    'A completed workout keeps at least one recorded set, so this exercise cannot be removed.',
};

export const emptyExerciseExplanation =
  'This exercise recorded nothing. Add a missing set, or remove the exercise from this workout.';

export const blockedRemovalExplanation =
  'This exercise holds the only recorded sets in this workout. A completed workout keeps at least one recorded set, so delete the whole workout instead.';

export const removalFailureMessage =
  'This exercise could not be removed. Nothing was changed.';

export const removalConfirmedMessage =
  'Exercise removed from this completed workout.';

/**
 * The recorded set count is the one number the confirmation states, because a
 * person cannot judge what disappears without it. No name, value, date, or
 * identifier is interpolated anywhere else.
 */
export function removalConfirmationBody(recordedSetCount: number): string {
  const kept = 'The rest of this workout is kept. This cannot be undone.';
  if (recordedSetCount === 0)
    return `This exercise recorded no sets, so no recorded result is lost. ${kept}`;
  const sets =
    recordedSetCount === 1
      ? 'Its 1 recorded set is removed'
      : `Its ${recordedSetCount} recorded sets are removed`;
  return `${sets} and cannot be recovered. Progress and personal records may change. ${kept}`;
}

export function completedExerciseRemovalRefusalMessage(
  reason: CompletedExerciseRemovalRefusal,
): string {
  return messages[reason];
}
