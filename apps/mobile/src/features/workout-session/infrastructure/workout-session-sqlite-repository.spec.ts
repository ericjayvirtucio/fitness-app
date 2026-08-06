import {
  DomainId,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { WorkoutSessionSqliteRepository } from './workout-session-sqlite-repository';

class FakeDatabase implements DatabaseConnection {
  allResults: (readonly unknown[])[] = [];
  firstResults: unknown[] = [];
  runs: { parameters: DatabaseParameters; statement: string }[] = [];
  exec() {
    return Promise.resolve();
  }
  getVersion() {
    return Promise.resolve(9);
  }
  getFirst<TResult>() {
    return Promise.resolve(
      (this.firstResults.shift() ?? null) as TResult | null,
    );
  }
  getAll<TResult>() {
    return Promise.resolve(
      (this.allResults.shift() ?? []) as readonly TResult[],
    );
  }
  run(statement: string, parameters: DatabaseParameters = []) {
    this.runs.push({ parameters, statement });
    return Promise.resolve();
  }
  runExclusive<TResult>(
    operation: (database: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

const sessionId = '550e8400-e29b-41d4-a716-446655440000';
const exerciseId = '550e8400-e29b-41d4-a716-446655440001';
const setId = '550e8400-e29b-41d4-a716-446655440002';

function id(value: string) {
  const result = DomainId.create(value);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function session() {
  const set = WorkoutSet.create({
    id: id(setId),
    position: 0,
    result: RepetitionResult.valid(8),
  });
  if (!set.isSuccess) throw new Error('Invalid fixture');
  const exercise = WorkoutSessionExercise.create({
    exerciseNameSnapshot: 'Push-up',
    id: id(exerciseId),
    loggingModeSnapshot: 'bodyweight-and-repetitions',
    plannedPrescriptionSnapshot: null,
    position: 0,
    sets: [set.value],
    sourceExerciseDefinitionId: id(exerciseId),
    sourcePlannedExerciseId: null,
  });
  if (!exercise.isSuccess) throw new Error('Invalid fixture');
  const result = WorkoutSession.create({
    completedAtEpochMilliseconds: null,
    exercises: [exercise.value],
    id: id(sessionId),
    name: 'Workout',
    sourcePlannedWorkoutId: null,
    sourceWeekday: null,
    startedAtEpochMilliseconds: 1_700_000_000_000,
    startedLocalCalendarDate: '2026-08-06',
    startedUtcOffsetMinutes: 480,
    status: 'active',
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('WorkoutSessionSqliteRepository', () => {
  it('persists canonical snapshots and individual sets with bound values', async () => {
    const database = new FakeDatabase();
    await new WorkoutSessionSqliteRepository(database).insert(session());
    expect(database.runs).toHaveLength(3);
    expect(database.runs[1]?.parameters).toContain('Push-up');
    expect(database.runs[2]?.parameters).toEqual([
      setId,
      exerciseId,
      0,
      'repetitions',
      8,
      null,
      null,
      null,
    ]);
  });

  it('hydrates an active aggregate with a fixed three-query read', async () => {
    const database = new FakeDatabase();
    database.firstResults = [
      {
        completed_at_epoch_ms: null,
        display_name: 'Workout',
        id: sessionId,
        source_planned_workout_id: null,
        source_weekday: null,
        started_at_epoch_ms: 1_700_000_000_000,
        started_local_calendar_date: '2026-08-06',
        started_utc_offset_minutes: 480,
        status: 'active',
      },
    ];
    database.allResults = [
      [
        {
          exercise_name_snapshot: 'Push-up',
          id: exerciseId,
          logging_mode_snapshot: 'bodyweight-and-repetitions',
          planned_distance_millimeters: null,
          planned_duration_seconds: null,
          planned_kind: null,
          planned_repetitions: null,
          planned_resistance_grams: null,
          planned_sets: null,
          position: 0,
          source_exercise_definition_id: exerciseId,
          source_planned_exercise_id: null,
          workout_session_id: sessionId,
        },
      ],
      [
        {
          distance_millimeters: null,
          duration_seconds: null,
          id: setId,
          position: 0,
          repetitions: 8,
          resistance_grams: null,
          result_kind: 'repetitions',
          workout_session_exercise_id: exerciseId,
        },
      ],
    ];
    const result = await new WorkoutSessionSqliteRepository(
      database,
    ).getActive();
    expect(result).toMatchObject({
      exercises: [{ sets: [{ result: { repetitions: 8 } }] }],
    });
  });

  it('discards only an active aggregate', async () => {
    const database = new FakeDatabase();
    database.firstResults = [{ id: sessionId }];
    await expect(
      new WorkoutSessionSqliteRepository(database).discard(id(sessionId)),
    ).resolves.toBe(true);
    expect(database.runs[0]?.statement).toContain(
      'DELETE FROM workout_session',
    );
  });
});
