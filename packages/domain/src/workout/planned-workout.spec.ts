import { describe, expect, it } from 'vitest';

import { DomainId } from '../shared/domain-id';
import { createPlannedPrescription } from './planned-prescription';
import {
  PlannedExercise,
  PlannedWorkout,
  WeeklyWorkoutPlan,
} from './planned-workout';
import { Weekday } from './weekday';

const ids = [
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
];

function value<T>(result: { isSuccess: boolean; value?: T }): T {
  if (!result.isSuccess || result.value === undefined)
    throw new Error('Invalid fixture');
  return result.value;
}

function workout(day = 1, name = 'Push Day') {
  const prescription = value(
    createPlannedPrescription({
      loggingMode: 'repetitions',
      repetitions: 8,
      sets: 3,
    }),
  );
  const exercise = value(
    PlannedExercise.create({
      exerciseDefinitionId: value(DomainId.create(ids[2])),
      id: value(DomainId.create(ids[1])),
      position: 0,
      prescription,
    }),
  );
  return PlannedWorkout.create({
    exercises: [exercise],
    id: value(DomainId.create(ids[0])),
    name,
    weekday: value(Weekday.create(day)),
  });
}

describe('planned workout', () => {
  it('creates an immutable ordered aggregate', () => {
    const result = workout();
    expect(result).toMatchObject({
      isSuccess: true,
      value: { name: 'Push Day', weekday: { value: 1 } },
    });
    if (result.isSuccess) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.exercises)).toBe(true);
    }
  });

  it('rejects blank names and noncontiguous positions', () => {
    expect(workout(1, '   ')).toMatchObject({ isSuccess: false });
    const valid = value(workout());
    const original = valid.exercises[0];
    if (!original) throw new Error('Invalid fixture');
    const misplaced = value(
      PlannedExercise.create({
        exerciseDefinitionId: original.exerciseDefinitionId,
        id: original.id,
        position: 2,
        prescription: original.prescription,
      }),
    );
    expect(
      PlannedWorkout.create({ ...valid, exercises: [misplaced] }),
    ).toMatchObject({ isSuccess: false, error: { field: 'exercises' } });
  });

  it('materializes all seven days and represents missing workouts as Rest', () => {
    const plan = WeeklyWorkoutPlan.create([value(workout())]);
    expect(plan).toMatchObject({ isSuccess: true });
    if (!plan.isSuccess) return;
    expect(plan.value.days).toHaveLength(7);
    expect(plan.value.days[0]).toMatchObject({
      kind: 'rest',
      weekday: { value: 0 },
    });
    expect(plan.value.days[1]).toMatchObject({
      kind: 'workout',
      workout: { name: 'Push Day' },
    });
  });

  it('rejects more than one workout for a weekday', () => {
    expect(
      WeeklyWorkoutPlan.create([value(workout()), value(workout())]),
    ).toMatchObject({
      error: { field: 'weekday' },
      isSuccess: false,
    });
  });
});
