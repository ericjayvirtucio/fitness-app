import type { WorkoutSessionRenameRefusal } from '../application/rename-workout-session-use-case';

/**
 * One fixed sentence per refusal.
 *
 * Nothing here interpolates a workout name, a recorded value, a date, or an
 * identifier, so a refused rename can never echo the free text a person typed
 * or name the workout it protects.
 */
const messages: Readonly<Record<WorkoutSessionRenameRefusal, string>> = {
  changed:
    'This workout changed since this screen opened. Open it again before renaming it.',
  'invalid-name': 'Enter a workout name of 1 to 80 characters.',
  'not-found': 'This workout is no longer available.',
};

export const renameExplanation =
  'This changes what this workout is called everywhere it appears, including its personal records. No recorded set, total, or time changes.';

export const renameFailureMessage =
  'This workout could not be renamed. Nothing was changed.';

export function workoutRenameRefusalMessage(
  reason: WorkoutSessionRenameRefusal,
): string {
  return messages[reason];
}
