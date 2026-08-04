import { describe, expect, it } from 'vitest';
import { DomainId } from '../shared/domain-id';
import {
  ExerciseDefinition,
  exerciseEquipment,
  exerciseLoggingModes,
  exerciseMuscleGroups,
} from './exercise-definition';

const id = DomainId.create('123e4567-e89b-42d3-a456-426614174000');

function validInput() {
  if (!id.isSuccess) throw new Error('Invalid fixture');
  return {
    equipment: 'barbell',
    id: id.value,
    loggingMode: 'external-load-and-repetitions',
    name: '  Barbell Bench Press  ',
    notes: '  Keep feet planted.  ',
    primaryMuscleGroup: 'chest',
  } as const;
}

describe('ExerciseDefinition', () => {
  it('creates an immutable, normalized definition', () => {
    const result = ExerciseDefinition.create(validInput());
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.name).toBe('Barbell Bench Press');
    expect(result.value.notes).toBe('Keep feet planted.');
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('accepts every controlled vocabulary value in a valid context', () => {
    expect(exerciseEquipment).toHaveLength(10);
    expect(exerciseMuscleGroups).toHaveLength(13);
    expect(exerciseLoggingModes).toHaveLength(8);
  });

  it.each([
    [{ ...validInput(), id: 'bad' }, 'id'],
    [{ ...validInput(), name: '   ' }, 'name'],
    [{ ...validInput(), name: 'x'.repeat(81) }, 'name'],
    [{ ...validInput(), equipment: 'rack' }, 'equipment'],
    [{ ...validInput(), primaryMuscleGroup: 'forearms' }, 'primaryMuscleGroup'],
    [{ ...validInput(), loggingMode: 'weight' }, 'loggingMode'],
    [{ ...validInput(), notes: 'x'.repeat(501) }, 'notes'],
  ])('rejects invalid definition state', (input, field) => {
    const result = ExerciseDefinition.create(input);
    expect(result.isSuccess).toBe(false);
    if (!result.isSuccess) expect(result.error.field).toBe(field);
  });

  it.each([
    ['barbell', 'bodyweight-and-repetitions'],
    ['bodyweight', 'assistance-and-repetitions'],
    ['dumbbell', 'distance-and-duration'],
  ])('rejects incompatible %s and %s', (equipment, loggingMode) => {
    const result = ExerciseDefinition.create({
      ...validInput(),
      equipment,
      loggingMode,
    });
    expect(result.isSuccess).toBe(false);
    if (!result.isSuccess) expect(result.error.field).toBe('loggingMode');
  });

  it('normalizes blank optional notes to null', () => {
    const result = ExerciseDefinition.create({ ...validInput(), notes: '  ' });
    expect(result.isSuccess && result.value.notes).toBeNull();
  });
});
