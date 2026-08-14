import type { CompletedSetCorrectionRefusal } from '../application/correct-completed-workout-set-use-case';

/**
 * One fixed sentence per refusal.
 *
 * Nothing here interpolates an exercise name, a recorded value, a date, or an
 * identifier, so a correction failure can never leak the history it protects.
 */
const messages: Readonly<Record<CompletedSetCorrectionRefusal, string>> = {
  changed:
    'This recorded set changed since this screen opened. Open it again to correct the current value.',
  'exercise-full':
    'This exercise already holds the most recorded sets a workout can keep.',
  'exercise-not-found':
    'This exercise is no longer part of the completed workout.',
  'invalid-result': 'Enter values that match how this exercise was recorded.',
  'not-completed': 'This workout is no longer completed history.',
  'not-found': 'This completed workout is no longer available.',
  'set-not-found':
    'This recorded set is no longer part of the completed workout.',
  'would-empty-workout':
    'A completed workout keeps at least one recorded set, so this one cannot be deleted.',
};

export const correctionSaveFailureMessage =
  'The correction could not be saved. Your values are still here.';

export const correctionDeleteFailureMessage =
  'The recorded set could not be deleted. Nothing was changed.';

export const blockedDeletionExplanation =
  'This is the only recorded set in this workout. A completed workout keeps at least one recorded set, so delete the whole workout instead.';

export function correctionRefusalMessage(
  reason: CompletedSetCorrectionRefusal,
): string {
  return messages[reason];
}
