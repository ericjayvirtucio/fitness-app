import {
  DomainId,
  PlannedExercise,
  PlannedWorkout,
  Weekday,
  createPlannedPrescription,
} from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { WorkoutPlannerSqliteRepository } from './workout-planner-sqlite-repository';

class FakeDatabase implements DatabaseConnection {
  rows: readonly unknown[] = [];
  first: unknown = null;
  error?: Error;
  runs: { parameters: DatabaseParameters; statement: string }[] = [];
  reads: { parameters: DatabaseParameters; statement: string }[] = [];
  exec() {
    return Promise.resolve();
  }
  getVersion() {
    return Promise.resolve(8);
  }
  getFirst<TResult>(statement: string, parameters: DatabaseParameters = []) {
    this.reads.push({ parameters, statement });
    return this.error
      ? Promise.reject(this.error)
      : Promise.resolve(this.first as TResult | null);
  }
  getAll<TResult>(statement: string, parameters: DatabaseParameters = []) {
    this.reads.push({ parameters, statement });
    return this.error
      ? Promise.reject(this.error)
      : Promise.resolve(this.rows as readonly TResult[]);
  }
  run(statement: string, parameters: DatabaseParameters = []) {
    if (this.error) return Promise.reject(this.error);
    this.runs.push({ parameters, statement });
    return Promise.resolve();
  }
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

const workoutId = '550e8400-e29b-41d4-a716-446655440000';
const plannedId = '550e8400-e29b-41d4-a716-446655440001';
const exerciseId = '550e8400-e29b-41d4-a716-446655440002';
const row = {
  exercise_definition_id: exerciseId,
  exercise_display_name: 'Bench Press',
  exercise_equipment: 'barbell',
  exercise_logging_mode: 'external-load-and-repetitions',
  exercise_notes: null,
  exercise_primary_muscle_group: 'chest',
  planned_distance_millimeters: null,
  planned_duration_seconds: null,
  planned_exercise_id: plannedId,
  planned_repetitions: 8,
  planned_resistance_grams: 60_000,
  planned_sets: 4,
  position: 0,
  prescription_kind: 'resistance-and-repetitions',
  weekday: 1,
  workout_id: workoutId,
  workout_name: 'Push Day',
} as const;

function value<T>(result: { isSuccess: boolean; value?: T }): T {
  if (!result.isSuccess || result.value === undefined)
    throw new Error('Invalid fixture');
  return result.value;
}

function workout() {
  const exercise = value(
    PlannedExercise.create({
      exerciseDefinitionId: value(DomainId.create(exerciseId)),
      id: value(DomainId.create(plannedId)),
      position: 0,
      prescription: value(
        createPlannedPrescription({
          loggingMode: 'external-load-and-repetitions',
          repetitions: 8,
          sets: 4,
        }),
      ),
    }),
  );
  return value(
    PlannedWorkout.create({
      exercises: [exercise],
      id: value(DomainId.create(workoutId)),
      name: 'Push Day',
      weekday: value(Weekday.create(1)),
    }),
  );
}

describe('WorkoutPlannerSqliteRepository', () => {
  it('hydrates the full aggregate with one ordered joined read', async () => {
    const database = new FakeDatabase();
    database.rows = [row];
    const result = await new WorkoutPlannerSqliteRepository(
      database,
    ).getWeeklyWorkouts();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      exercises: [
        {
          definition: { name: 'Bench Press' },
          plannedExercise: {
            prescription: { kind: 'resistance-and-repetitions' },
          },
        },
      ],
      workout: { name: 'Push Day', weekday: { value: 1 } },
    });
    expect(database.reads).toHaveLength(1);
    expect(database.reads[0]?.statement).toContain('ORDER BY workout.weekday');
  });

  it('replaces a workout and ordered children with bound canonical values', async () => {
    const database = new FakeDatabase();
    await new WorkoutPlannerSqliteRepository(database).replace(workout());
    expect(database.runs).toHaveLength(4);
    expect(database.runs[3]?.parameters).toEqual([
      plannedId,
      workoutId,
      exerciseId,
      0,
      'resistance-and-repetitions',
      4,
      8,
      null,
      null,
      null,
    ]);
  });

  it('replaces planned exercises before the workout that owns them', async () => {
    const database = new FakeDatabase();
    await new WorkoutPlannerSqliteRepository(database).replace(workout());
    expect(database.runs[0]?.statement).toContain(
      'DELETE FROM planned_exercise',
    );
    expect(database.runs[0]?.parameters).toEqual([1]);
    expect(database.runs[1]?.statement).toContain(
      'DELETE FROM planned_workout',
    );
    expect(database.runs[1]?.parameters).toEqual([1]);
  });

  it('deletes planned exercises before the workout that owns them', async () => {
    const database = new FakeDatabase();
    database.first = { id: workoutId };
    await expect(
      new WorkoutPlannerSqliteRepository(database).deleteByWeekday(
        value(Weekday.create(1)),
      ),
    ).resolves.toBe(true);
    expect(database.runs).toHaveLength(2);
    expect(database.runs[0]?.statement).toContain(
      'DELETE FROM planned_exercise',
    );
    expect(database.runs[0]?.parameters).toEqual([1]);
    expect(database.runs[1]?.statement).toContain(
      'DELETE FROM planned_workout',
    );
  });

  it('deletes nothing when the weekday holds no workout', async () => {
    const database = new FakeDatabase();
    database.first = null;
    await expect(
      new WorkoutPlannerSqliteRepository(database).deleteByWeekday(
        value(Weekday.create(1)),
      ),
    ).resolves.toBe(false);
    expect(database.runs).toHaveLength(0);
  });

  it('returns focused references and validates their weekday', async () => {
    const database = new FakeDatabase();
    database.rows = [{ display_name: 'Push Day', weekday: 1 }];
    const id = value(DomainId.create(exerciseId));
    await expect(
      new WorkoutPlannerSqliteRepository(database).listUsages(id),
    ).resolves.toMatchObject([
      { weekday: { value: 1 }, workoutName: 'Push Day' },
    ]);
    expect(database.reads[0]?.parameters).toEqual([exerciseId]);
  });

  it.each([
    { ...row, planned_sets: 0 },
    { ...row, exercise_definition_id: null },
    { ...row, prescription_kind: 'duration' },
    { ...row, weekday: 8 },
  ])('rejects corrupt stored rows', async (invalidRow) => {
    const database = new FakeDatabase();
    database.rows = [invalidRow];
    await expect(
      new WorkoutPlannerSqliteRepository(database).getWeeklyWorkouts(),
    ).rejects.toMatchObject({ code: 'operation-failed' });
  });

  it('translates failures without exposing fitness data', async () => {
    const database = new FakeDatabase();
    database.error = new Error('Push Day sensitive SQL');
    await expect(
      new WorkoutPlannerSqliteRepository(database).getWeeklyWorkouts(),
    ).rejects.toMatchObject({
      code: 'operation-failed',
      message: 'The local storage operation failed.',
    });
  });
});
