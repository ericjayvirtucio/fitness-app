import {
  DomainId,
  Duration,
  DurationResult,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  workoutSessionPolicy,
  type Result,
  type WorkoutResult,
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

function generatedId(index: number) {
  const result = DomainId.create(
    `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  );
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
    startedLocalCalendarDate: '2023-11-15',
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

/**
 * Correcting a completed workout reconstructs the aggregate through the same
 * constructors every other mutation already uses. These cases pin the rules
 * that make that safe, so the aggregate needs no mutating correction method.
 */
describe('WorkoutSession completed correction', () => {
  const startedAt = 1_700_000_000_000;
  const completedAt = startedAt + 3_600_000;

  function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
    if (!result.isSuccess) throw new Error('Invalid fixture');
    return result.value;
  }

  function set(index: number, result: WorkoutResult, position: number) {
    return unwrap(
      WorkoutSet.create({ id: generatedId(index), position, result }),
    );
  }

  function exercise(position: number, sets: readonly WorkoutSet[]) {
    return unwrap(
      WorkoutSessionExercise.create({
        exerciseNameSnapshot: 'Bench press',
        id: generatedId(100 + position),
        loggingModeSnapshot: 'repetitions',
        plannedPrescriptionSnapshot: null,
        position,
        sets,
        sourceExerciseDefinitionId: generatedId(200 + position),
        sourcePlannedExerciseId: null,
      }),
    );
  }

  function completed(exercises: readonly WorkoutSessionExercise[]) {
    return unwrap(
      WorkoutSession.create({
        completedAtEpochMilliseconds: completedAt,
        exercises,
        id: id(0),
        name: 'Push day',
        sourcePlannedWorkoutId: null,
        sourceWeekday: null,
        startedAtEpochMilliseconds: startedAt,
        startedLocalCalendarDate: '2023-11-15',
        startedUtcOffsetMinutes: 480,
        status: 'completed',
      }),
    );
  }

  function exerciseAt(session: WorkoutSession, index: number) {
    const target = session.exercises[index];
    if (!target) throw new Error('Invalid fixture');
    return target;
  }

  function setAt(
    session: WorkoutSession,
    exerciseIndex: number,
    index: number,
  ) {
    const target = exerciseAt(session, exerciseIndex).sets[index];
    if (!target) throw new Error('Invalid fixture');
    return target;
  }

  function correctSets(
    session: WorkoutSession,
    exerciseIndex: number,
    sets: readonly WorkoutSet[],
  ) {
    const rebuilt = WorkoutSessionExercise.create({
      ...exerciseAt(session, exerciseIndex),
      sets,
    });
    if (!rebuilt.isSuccess) return rebuilt;
    const exercises = [...session.exercises];
    exercises[exerciseIndex] = rebuilt.value;
    return WorkoutSession.create({ ...session, exercises });
  }

  const twoSets = () => [
    set(1, RepetitionResult.valid(8), 0),
    set(2, RepetitionResult.valid(6), 1),
  ];

  it('accepts a corrected result while preserving lifecycle and snapshots', () => {
    const session = completed([exercise(0, twoSets())]);
    const corrected = unwrap(
      correctSets(session, 0, [
        set(1, RepetitionResult.valid(5), 0),
        setAt(session, 0, 1),
      ]),
    );

    expect(corrected.status).toBe('completed');
    expect(corrected.completedAtEpochMilliseconds).toBe(completedAt);
    expect(corrected.startedAtEpochMilliseconds).toBe(startedAt);
    expect(corrected.startedLocalCalendarDate).toBe('2023-11-15');
    expect(corrected.startedUtcOffsetMinutes).toBe(480);
    expect(corrected.name).toBe('Push day');
    expect(corrected.id.value).toBe(session.id.value);

    const before = exerciseAt(session, 0);
    const after = exerciseAt(corrected, 0);
    expect(after.id.value).toBe(before.id.value);
    expect(after.position).toBe(before.position);
    expect(after.exerciseNameSnapshot).toBe(before.exerciseNameSnapshot);
    expect(after.loggingModeSnapshot).toBe(before.loggingModeSnapshot);
    expect(after.plannedPrescriptionSnapshot).toBe(
      before.plannedPrescriptionSnapshot,
    );
    expect(after.sourceExerciseDefinitionId.value).toBe(
      before.sourceExerciseDefinitionId.value,
    );
    expect(after.sourcePlannedExerciseId).toBeNull();
  });

  it('keeps the corrected set identity and position and leaves the source alone', () => {
    const session = completed([exercise(0, twoSets())]);
    const corrected = unwrap(
      correctSets(session, 0, [
        set(1, RepetitionResult.valid(5), 0),
        setAt(session, 0, 1),
      ]),
    );

    expect(
      exerciseAt(corrected, 0).sets.map((entry) => entry.id.value),
    ).toEqual(exerciseAt(session, 0).sets.map((entry) => entry.id.value));
    expect(
      exerciseAt(corrected, 0).sets.map((entry) => entry.position),
    ).toEqual([0, 1]);
    expect(setAt(corrected, 0, 0).result).toMatchObject({ repetitions: 5 });
    expect(setAt(corrected, 0, 1)).toBe(setAt(session, 0, 1));
    expect(setAt(session, 0, 0).result).toMatchObject({ repetitions: 8 });
  });

  it('appends an added set at the next contiguous position', () => {
    const session = completed([exercise(0, twoSets())]);
    const corrected = unwrap(
      correctSets(session, 0, [
        ...exerciseAt(session, 0).sets,
        set(3, RepetitionResult.valid(4), 2),
      ]),
    );

    expect(
      exerciseAt(corrected, 0).sets.map((entry) => entry.position),
    ).toEqual([0, 1, 2]);
  });

  it('rejects an added set that skips a position', () => {
    const session = completed([exercise(0, twoSets())]);
    expect(
      correctSets(session, 0, [
        ...exerciseAt(session, 0).sets,
        set(3, RepetitionResult.valid(4), 5),
      ]).isSuccess,
    ).toBe(false);
  });

  it('rejects an exercise beyond the maximum number of sets', () => {
    const full = Array.from(
      { length: workoutSessionPolicy.maximumSetsPerExercise },
      (_, position) => set(position + 1, RepetitionResult.valid(1), position),
    );
    const session = completed([exercise(0, full)]);
    expect(
      correctSets(session, 0, [
        ...full,
        set(500, RepetitionResult.valid(1), full.length),
      ]).isSuccess,
    ).toBe(false);
  });

  it('renumbers the survivors of a deleted set without changing identifiers', () => {
    const session = completed([exercise(0, twoSets())]);
    const survivor = setAt(session, 0, 1);
    const corrected = unwrap(
      correctSets(session, 0, [set(2, survivor.result, 0)]),
    );

    expect(exerciseAt(corrected, 0).sets).toHaveLength(1);
    expect(setAt(corrected, 0, 0).id.value).toBe(survivor.id.value);
    expect(setAt(corrected, 0, 0).position).toBe(0);
  });

  it('allows one exercise to keep no sets while another holds performed work', () => {
    const session = completed([
      exercise(0, twoSets()),
      exercise(1, [set(10, RepetitionResult.valid(3), 0)]),
    ]);
    const corrected = unwrap(correctSets(session, 1, []));

    expect(corrected.exercises).toHaveLength(2);
    expect(exerciseAt(corrected, 1).sets).toHaveLength(0);
    expect(exerciseAt(corrected, 0).sets).toHaveLength(2);
  });

  it('refuses to leave a completed workout with no actual sets', () => {
    const session = completed([
      exercise(0, [set(1, RepetitionResult.valid(8), 0)]),
    ]);
    expect(correctSets(session, 0, []).isSuccess).toBe(false);
  });

  it('rejects a corrected result that does not match the captured logging mode', () => {
    const session = completed([exercise(0, twoSets())]);
    const duration = set(
      1,
      DurationResult.valid(unwrap(Duration.create(30, 'second'))),
      0,
    );

    expect(
      correctSets(session, 0, [duration, setAt(session, 0, 1)]).isSuccess,
    ).toBe(false);
  });
});
