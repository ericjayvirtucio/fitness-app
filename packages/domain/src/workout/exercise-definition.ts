import { DomainError } from '../shared/domain-error';
import { DomainId } from '../shared/domain-id';
import { err, ok, type Result } from '../shared/result';

export const exerciseEquipment = Object.freeze([
  'none',
  'bodyweight',
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'resistance-band',
  'cardio-machine',
  'other',
] as const);

export const exerciseMuscleGroups = Object.freeze([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'full-body',
  'conditioning',
  'other',
] as const);

export const exerciseLoggingModes = Object.freeze([
  'repetitions',
  'external-load-and-repetitions',
  'bodyweight-and-repetitions',
  'bodyweight-plus-load-and-repetitions',
  'assistance-and-repetitions',
  'duration',
  'distance',
  'distance-and-duration',
] as const);

export type ExerciseEquipment = (typeof exerciseEquipment)[number];
export type ExerciseMuscleGroup = (typeof exerciseMuscleGroups)[number];
export type ExerciseLoggingMode = (typeof exerciseLoggingModes)[number];

export const exerciseDefinitionPolicy = Object.freeze({
  maximumNameLength: 80,
  maximumNotesLength: 500,
});

export type ExerciseDefinitionInput = Readonly<{
  equipment: unknown;
  id: unknown;
  loggingMode: unknown;
  name: unknown;
  notes?: unknown;
  primaryMuscleGroup: unknown;
}>;

export class ExerciseDefinition {
  private constructor(
    readonly id: DomainId,
    readonly name: string,
    readonly equipment: ExerciseEquipment,
    readonly primaryMuscleGroup: ExerciseMuscleGroup,
    readonly loggingMode: ExerciseLoggingMode,
    readonly notes: string | null,
  ) {
    Object.freeze(this);
  }

  static create(
    input: ExerciseDefinitionInput,
  ): Result<ExerciseDefinition, DomainError> {
    if (!(input.id instanceof DomainId)) {
      return invalid(
        'invalid-identifier',
        'Exercise identifier is invalid.',
        'id',
      );
    }
    const name = normalizedOptionalText(input.name);
    if (name === null) {
      return invalid('required-field', 'Exercise name is required.', 'name');
    }
    if (name.length > exerciseDefinitionPolicy.maximumNameLength) {
      return invalid('out-of-range', 'Exercise name is too long.', 'name');
    }
    if (!includes(exerciseEquipment, input.equipment)) {
      return invalid(
        'unsupported-option',
        'Choose valid equipment.',
        'equipment',
      );
    }
    if (!includes(exerciseMuscleGroups, input.primaryMuscleGroup)) {
      return invalid(
        'unsupported-option',
        'Choose a valid primary muscle group.',
        'primaryMuscleGroup',
      );
    }
    if (!includes(exerciseLoggingModes, input.loggingMode)) {
      return invalid(
        'unsupported-option',
        'Choose a valid logging mode.',
        'loggingMode',
      );
    }
    const notes = normalizedOptionalText(input.notes);
    if (
      notes !== null &&
      notes.length > exerciseDefinitionPolicy.maximumNotesLength
    ) {
      return invalid('out-of-range', 'Exercise notes are too long.', 'notes');
    }
    if (!isCompatible(input.equipment, input.loggingMode)) {
      return invalid(
        'unsupported-option',
        'Equipment and logging mode are not compatible.',
        'loggingMode',
      );
    }

    return ok(
      new ExerciseDefinition(
        input.id,
        name,
        input.equipment,
        input.primaryMuscleGroup,
        input.loggingMode,
        notes,
      ),
    );
  }
}

function normalizedOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function includes<TValue extends string>(
  values: readonly TValue[],
  candidate: unknown,
): candidate is TValue {
  return (
    typeof candidate === 'string' && values.some((value) => value === candidate)
  );
}

function isCompatible(
  equipment: ExerciseEquipment,
  loggingMode: ExerciseLoggingMode,
): boolean {
  if (
    loggingMode === 'bodyweight-and-repetitions' ||
    loggingMode === 'bodyweight-plus-load-and-repetitions'
  ) {
    return equipment === 'bodyweight';
  }
  if (loggingMode === 'assistance-and-repetitions') {
    return (
      equipment === 'machine' ||
      equipment === 'resistance-band' ||
      equipment === 'other'
    );
  }
  if (loggingMode === 'distance' || loggingMode === 'distance-and-duration') {
    return (
      equipment === 'none' ||
      equipment === 'cardio-machine' ||
      equipment === 'other'
    );
  }
  return true;
}

function invalid(
  code: Parameters<typeof DomainError.create>[0],
  message: string,
  field: string,
): Result<never, DomainError> {
  return err(DomainError.create(code, message, field));
}
