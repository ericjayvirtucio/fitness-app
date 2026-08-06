import {
  DomainId,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '..';
import { describe, expect, it } from 'vitest';

const ids = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
];

function id(index: number) {
  const result = DomainId.create(ids[index]);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function sessionExercise() {
  const set = WorkoutSet.create({
    id: id(2),
    position: 0,
    result: RepetitionResult.valid(8),
  });
  if (!set.isSuccess) throw new Error('Invalid fixture');
  const exercise = WorkoutSessionExercise.create({
    exerciseNameSnapshot: 'Push-up',
    id: id(1),
    loggingModeSnapshot: 'bodyweight-and-repetitions',
    plannedPrescriptionSnapshot: null,
    position: 0,
    sets: [set.value],
    sourceExerciseDefinitionId: id(1),
    sourcePlannedExerciseId: null,
  });
  if (!exercise.isSuccess) throw new Error('Invalid fixture');
  return exercise.value;
}

describe('WorkoutSession', () => {
  const base = {
    completedAtEpochMilliseconds: null,
    exercises: [sessionExercise()],
    id: id(0),
    name: 'Workout',
    sourcePlannedWorkoutId: null,
    sourceWeekday: null,
    startedAtEpochMilliseconds: 1_700_000_000_000,
    startedLocalCalendarDate: '2026-08-06',
    startedUtcOffsetMinutes: 480,
    status: 'active',
  } as const;

  it('creates a frozen active session with stable snapshots', () => {
    const result = WorkoutSession.create(base);
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.exercises[0]?.exerciseNameSnapshot).toBe('Push-up');
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.exercises)).toBe(true);
    }
  });

  it('requires actual work before completion', () => {
    const result = WorkoutSession.create({
      ...base,
      completedAtEpochMilliseconds: 1_700_000_001_000,
      exercises: [],
      status: 'completed',
    });
    expect(result.isSuccess).toBe(false);
  });

  it('rejects a completion before the start', () => {
    expect(
      WorkoutSession.create({
        ...base,
        completedAtEpochMilliseconds: base.startedAtEpochMilliseconds - 1,
        status: 'completed',
      }).isSuccess,
    ).toBe(false);
  });

  it('rejects a result incompatible with the snapshotted mode', () => {
    const set = WorkoutSet.create({
      id: id(2),
      position: 0,
      result: RepetitionResult.valid(8),
    });
    if (!set.isSuccess) throw new Error('Invalid fixture');
    expect(
      WorkoutSessionExercise.create({
        exerciseNameSnapshot: 'Plank',
        id: id(1),
        loggingModeSnapshot: 'duration',
        plannedPrescriptionSnapshot: null,
        position: 0,
        sets: [set.value],
        sourceExerciseDefinitionId: id(1),
        sourcePlannedExerciseId: null,
      }).isSuccess,
    ).toBe(false);
  });
});
