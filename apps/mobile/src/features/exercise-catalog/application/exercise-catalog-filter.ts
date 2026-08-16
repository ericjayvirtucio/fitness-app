import {
  exerciseEquipment,
  exerciseMuscleGroups,
  type ExerciseEquipment,
  type ExerciseMuscleGroup,
} from '@fitness/domain';

/**
 * A read intent, not a domain rule. The vocabularies it narrows on belong to
 * `@fitness/domain`; one valid arrangement of them carries no invariant of its
 * own, so the criteria live in the capability that owns the catalog reads.
 *
 * `null` means "not narrowed on this field" rather than "no value", which is why
 * an unrecognised candidate becomes `null` instead of an error: a value outside
 * the vocabulary can only come from a programming mistake, and refusing to
 * narrow is the outcome that cannot show a person the wrong catalog.
 */
export type ExerciseCatalogFilter = Readonly<{
  equipment: ExerciseEquipment | null;
  primaryMuscleGroup: ExerciseMuscleGroup | null;
}>;

export const noExerciseCatalogFilter: ExerciseCatalogFilter = Object.freeze({
  equipment: null,
  primaryMuscleGroup: null,
});

export function isExerciseCatalogFilterActive(
  filter: ExerciseCatalogFilter,
): boolean {
  return filter.equipment !== null || filter.primaryMuscleGroup !== null;
}

export function toEquipmentFilter(value: unknown): ExerciseEquipment | null {
  return member(exerciseEquipment, value);
}

export function toMuscleGroupFilter(
  value: unknown,
): ExerciseMuscleGroup | null {
  return member(exerciseMuscleGroups, value);
}

export function createExerciseCatalogFilter(
  input: Readonly<{ equipment: unknown; primaryMuscleGroup: unknown }>,
): ExerciseCatalogFilter {
  return Object.freeze({
    equipment: toEquipmentFilter(input.equipment),
    primaryMuscleGroup: toMuscleGroupFilter(input.primaryMuscleGroup),
  });
}

function member<TValue extends string>(
  values: readonly TValue[],
  candidate: unknown,
): TValue | null {
  return typeof candidate === 'string' &&
    values.some((value) => value === candidate)
    ? (candidate as TValue)
    : null;
}
