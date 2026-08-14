import type { CompletedWorkoutDeletionRefusal } from '../application/delete-completed-workout-use-case';

/**
 * One fixed sentence per refusal.
 *
 * Nothing here interpolates a workout name, a recorded value, a date, or an
 * identifier, so a deletion failure can never leak the history it protects.
 */
const messages: Readonly<Record<CompletedWorkoutDeletionRefusal, string>> = {
  changed:
    'This workout changed since this screen opened. Open it again before deleting it.',
  'not-completed': 'This workout is no longer completed history.',
  'not-found': 'This completed workout is no longer available.',
};

export const deletionExplanation =
  'This removes the completed workout and all of its recorded sets. Progress and personal records may change. Nothing else will be deleted. This cannot be undone.';

export const deletionConfirmationBody =
  'Every recorded set in this workout is removed and cannot be recovered. Progress and personal records may change. Nothing else will be deleted.';

export const deletionFailureMessage =
  'This workout could not be deleted. Nothing was changed.';

export const deletionConfirmedMessage = 'Completed workout deleted.';

export function completedWorkoutDeletionRefusalMessage(
  reason: CompletedWorkoutDeletionRefusal,
): string {
  return messages[reason];
}
