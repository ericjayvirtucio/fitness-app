import type { CompletedExerciseAdditionRefusal } from '../application/add-completed-workout-exercise-use-case';

/**
 * One fixed sentence per refusal.
 *
 * Nothing here interpolates an exercise name, a recorded value, a date, or an
 * identifier, so an addition failure can never leak the history it protects.
 */
/**
 * Stated on the completed detail in words rather than by a control that looks
 * available and does nothing, and reused as the refusal a stale screen receives.
 */
export const workoutFullExplanation =
  'This workout already holds the most exercises a workout can keep, so no exercise can be added to it.';

const messages: Readonly<Record<CompletedExerciseAdditionRefusal, string>> = {
  changed:
    'This workout changed since this screen opened. Open it again before adding an exercise.',
  'definition-not-found':
    'This exercise is no longer in your exercise library.',
  'invalid-result': 'Enter values that match how this exercise is recorded.',
  'not-completed': 'This workout is no longer completed history.',
  'not-found': 'This completed workout is no longer available.',
  'workout-full': workoutFullExplanation,
};

export const additionExplanation =
  'Add work you performed in this workout but never recorded. It is added at the end, and the exercises already in this workout are unchanged.';

/**
 * Deliberately says what the person is doing rather than what the application
 * knows. The application has no evidence the work happened; this is the
 * person's claim about their own workout.
 */
export const additionSaveExplanation =
  'This workout will hold the exercise and the set you are entering now. Personal records and progress may change. The workout stays completed, and the exercises already in it keep their recorded sets and captured details.';

export const additionFirstSetExplanation =
  'Record what you performed. An exercise is added to a completed workout with its first set, so the workout never gains an exercise that recorded nothing.';

export const additionFailureMessage =
  'This exercise could not be added. Nothing was changed.';

export const additionConfirmedMessage =
  'Exercise added to this completed workout.';

export function completedExerciseAdditionRefusalMessage(
  reason: CompletedExerciseAdditionRefusal,
): string {
  return messages[reason];
}
