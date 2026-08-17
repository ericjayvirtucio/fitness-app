import type {
  ExerciseEquipment,
  ExerciseLoggingMode,
  ExerciseMuscleGroup,
} from '@fitness/domain';
import type { SelectionOption } from '../../../design-system';

export const equipmentOptions: readonly SelectionOption<ExerciseEquipment>[] = [
  ['none', 'No equipment'],
  ['bodyweight', 'Bodyweight'],
  ['barbell', 'Barbell'],
  ['dumbbell', 'Dumbbell'],
  ['kettlebell', 'Kettlebell'],
  ['machine', 'Machine'],
  ['cable', 'Cable'],
  ['resistance-band', 'Resistance band'],
  ['cardio-machine', 'Cardio machine'],
  ['other', 'Other'],
].map(
  ([value, label]) => ({ label, value }) as SelectionOption<ExerciseEquipment>,
);

export const muscleOptions: readonly SelectionOption<ExerciseMuscleGroup>[] = [
  ['chest', 'Chest'],
  ['back', 'Back'],
  ['shoulders', 'Shoulders'],
  ['biceps', 'Biceps'],
  ['triceps', 'Triceps'],
  ['quadriceps', 'Quadriceps'],
  ['hamstrings', 'Hamstrings'],
  ['glutes', 'Glutes'],
  ['calves', 'Calves'],
  ['core', 'Core'],
  ['full-body', 'Full body'],
  ['conditioning', 'Conditioning'],
  ['other', 'Other'],
].map(
  ([value, label]) =>
    ({ label, value }) as SelectionOption<ExerciseMuscleGroup>,
);

export const loggingModeOptions: readonly SelectionOption<ExerciseLoggingMode>[] =
  [
    ['repetitions', 'Reps only'],
    ['external-load-and-repetitions', 'Weight + reps'],
    ['bodyweight-and-repetitions', 'Bodyweight + reps'],
    ['bodyweight-plus-load-and-repetitions', 'Added weight + reps'],
    ['assistance-and-repetitions', 'Assistance + reps'],
    ['duration', 'Duration'],
    ['distance', 'Distance'],
    ['distance-and-duration', 'Distance + duration'],
  ].map(
    ([value, label]) =>
      ({ label, value }) as SelectionOption<ExerciseLoggingMode>,
  );

/**
 * The library narrows on one equipment value and one muscle group at a time, so
 * each filter is the same single-choice control the editor uses, with an
 * explicit "any" option standing for the unnarrowed list. A sentinel keeps the
 * control a radio group — every state, including "not filtered", is a visible
 * choice with a selected state — rather than a group that can silently hold
 * nothing.
 */
export const anyFilterValue = 'any';

export type EquipmentFilterValue = ExerciseEquipment | typeof anyFilterValue;
export type MuscleFilterValue = ExerciseMuscleGroup | typeof anyFilterValue;

export const equipmentFilterOptions: readonly SelectionOption<EquipmentFilterValue>[] =
  [{ label: 'Any equipment', value: anyFilterValue }, ...equipmentOptions];

export const muscleFilterOptions: readonly SelectionOption<MuscleFilterValue>[] =
  [{ label: 'Any muscle group', value: anyFilterValue }, ...muscleOptions];

export function labelFor<TValue extends string>(
  options: readonly SelectionOption<TValue>[],
  value: TValue,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
