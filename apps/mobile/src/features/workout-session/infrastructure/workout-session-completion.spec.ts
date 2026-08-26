import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { SqliteTransactionRunner } from '../../../infrastructure/persistence/sqlite-transaction-runner';
import { ExerciseCatalogSqliteRepository } from '../../exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { WorkoutPlannerSqliteRepository } from '../../workout-planner/infrastructure/workout-planner-sqlite-repository';
import {
  FinishWorkoutSessionUseCase,
  StartWorkoutSessionUseCase,
  type WorkoutSessionContext,
} from '../application/workout-session-use-cases';
import { WorkoutSessionSqliteRepository } from './workout-session-sqlite-repository';

const deviceId = 'device-a';
const now = () => new Date();

type SessionRow = {
  completed_at_epoch_ms: number | null;
  display_name: string;
  id: string;
  source_planned_workout_id: string | null;
  source_weekday: number | null;
  started_at_epoch_ms: number;
  started_local_calendar_date: string;
  started_utc_offset_minutes: number;
  status: string;
};

const sessionId = '550e8400-e29b-41d4-a716-446655440010';
const exerciseId = '550e8400-e29b-41d4-a716-446655440011';
const definitionId = '550e8400-e29b-41d4-a716-446655440012';
const setId = '550e8400-e29b-41d4-a716-446655440013';
const nextSessionId = '550e8400-e29b-41d4-a716-446655440014';
const startedAt = 1_700_000_000_000;
const completedAt = startedAt + 60_000;

class CompletionPathDatabase implements DatabaseConnection {
  readonly sessions: SessionRow[];
  readonly exercises: readonly Record<string, unknown>[];
  readonly sets: readonly Record<string, unknown>[];
  childRewriteCount = 0;

  constructor(hasSet = true) {
    this.sessions = [activeRow()];
    this.exercises = hasSet ? [exerciseRow()] : [];
    this.sets = hasSet ? [setRow()] : [];
  }

  exec() {
    return Promise.resolve();
  }

  getVersion() {
    return Promise.resolve(9);
  }

  getFirst<TResult>(statement: string, parameters: DatabaseParameters = []) {
    if (!statement.includes('FROM workout_session'))
      return Promise.resolve(null);
    const row = statement.includes('status = ?')
      ? this.sessions.find(
          (candidate) => candidate.status === parameters.at(-1),
        )
      : this.sessions.find((candidate) => candidate.id === parameters[0]);
    return Promise.resolve(clone<TResult>(row));
  }

  getAll<TResult>(statement: string, parameters: DatabaseParameters = []) {
    const sessionIdParameter = parameters[0];
    const rows = statement.includes('FROM workout_set')
      ? this.sets.filter(
          (row) => row.workout_session_exercise_id === exerciseId,
        )
      : this.exercises.filter(
          (row) => row.workout_session_id === sessionIdParameter,
        );
    return Promise.resolve(rows.map((row) => cloneRequired<TResult>(row)));
  }

  run(statement: string, parameters: DatabaseParameters = []) {
    if (statement.includes('DELETE FROM workout_session_exercise')) {
      this.childRewriteCount += 1;
      return Promise.reject(
        new Error('Historical children must not be rewritten.'),
      );
    }
    if (statement.includes('UPDATE workout_session SET status')) {
      // Parameters are [status, completedAtEpochMs, updatedAtEpochMs, id,
      // expectedStatus] — the synchronization metadata columns add
      // `updatedAtEpochMs` ahead of the lifecycle guard's own bound values.
      const row = this.sessions.find(
        (candidate) =>
          candidate.id === parameters[3] && candidate.status === parameters[4],
      );
      if (row) {
        row.status = requiredString(parameters[0]);
        row.completed_at_epoch_ms = requiredNumber(parameters[1]);
      }
      return Promise.resolve();
    }
    if (statement.includes('INSERT INTO workout_session')) {
      const status = requiredString(parameters[2]);
      if (
        status === 'active' &&
        this.sessions.some((candidate) => candidate.status === 'active')
      )
        return Promise.reject(new Error('single active session'));
      this.sessions.push({
        completed_at_epoch_ms: nullableNumber(parameters[6]),
        display_name: requiredString(parameters[1]),
        id: requiredString(parameters[0]),
        source_planned_workout_id: nullableString(parameters[7]),
        source_weekday: nullableNumber(parameters[8]),
        started_at_epoch_ms: requiredNumber(parameters[3]),
        started_local_calendar_date: requiredString(parameters[4]),
        started_utc_offset_minutes: requiredNumber(parameters[5]),
        status,
      });
    }
    return Promise.resolve();
  }

  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

describe('Workout session completion through SQLite transaction repositories', () => {
  it('completes a reloaded session without rewriting historical children', async () => {
    const database = new CompletionPathDatabase();
    const beforeRestart = new WorkoutSessionSqliteRepository(
      database,
      deviceId,
      now,
    );
    const reloaded = await beforeRestart.getActive();
    expect(reloaded).toMatchObject({
      exercises: [
        {
          exerciseNameSnapshot: 'Barbell Bench Press',
          sets: [
            {
              id: { value: setId },
              result: { repetitions: 8, resistance: { grams: 60_000 } },
            },
          ],
        },
      ],
      status: 'active',
    });

    const runner = transactionRunner(database);
    const finish = new FinishWorkoutSessionUseCase(runner, () => completedAt);
    await expect(finish.execute(sessionId)).resolves.toMatchObject({
      isSuccess: true,
      value: { status: 'completed' },
    });

    const afterRestart = new WorkoutSessionSqliteRepository(
      database,
      deviceId,
      now,
    );
    await expect(afterRestart.getActive()).resolves.toBeNull();
    await expect(afterRestart.getById(reloaded!.id)).resolves.toMatchObject({
      completedAtEpochMilliseconds: completedAt,
      exercises: [
        {
          exerciseNameSnapshot: 'Barbell Bench Press',
          sets: [{ id: { value: setId }, result: { repetitions: 8 } }],
        },
      ],
      status: 'completed',
    });
    expect(database.childRewriteCount).toBe(0);

    const start = new StartWorkoutSessionUseCase(
      runner,
      () => nextSessionId,
      () => completedAt + 60_000,
    );
    await expect(start.executeEmpty()).resolves.toMatchObject({
      session: { id: { value: nextSessionId }, status: 'active' },
      status: 'started',
    });
  });

  it('continues to reject empty completion without touching persistence', async () => {
    const database = new CompletionPathDatabase(false);
    const finish = new FinishWorkoutSessionUseCase(
      transactionRunner(database),
      () => completedAt,
    );
    await expect(finish.execute(sessionId)).resolves.toMatchObject({
      isSuccess: false,
    });
    await expect(
      new WorkoutSessionSqliteRepository(database, deviceId, now).getActive(),
    ).resolves.toMatchObject({ status: 'active' });
    expect(database.childRewriteCount).toBe(0);
  });
});

function transactionRunner(database: DatabaseConnection) {
  return new SqliteTransactionRunner<WorkoutSessionContext>(
    database,
    (transaction) => ({
      catalog: new ExerciseCatalogSqliteRepository(transaction, deviceId, now),
      planner: new WorkoutPlannerSqliteRepository(transaction, deviceId, now),
      sessions: new WorkoutSessionSqliteRepository(transaction, deviceId, now),
    }),
  );
}

function activeRow(): SessionRow {
  return {
    completed_at_epoch_ms: null,
    display_name: 'Workout',
    id: sessionId,
    source_planned_workout_id: null,
    source_weekday: null,
    started_at_epoch_ms: startedAt,
    started_local_calendar_date: '2023-11-15',
    started_utc_offset_minutes: 480,
    status: 'active',
  };
}

function exerciseRow() {
  return {
    exercise_name_snapshot: 'Barbell Bench Press',
    id: exerciseId,
    logging_mode_snapshot: 'external-load-and-repetitions',
    planned_distance_millimeters: null,
    planned_duration_seconds: null,
    planned_kind: null,
    planned_repetitions: null,
    planned_resistance_grams: null,
    planned_sets: null,
    position: 0,
    source_exercise_definition_id: definitionId,
    source_planned_exercise_id: null,
    workout_session_id: sessionId,
  };
}

function setRow() {
  return {
    distance_millimeters: null,
    duration_seconds: null,
    id: setId,
    position: 0,
    repetitions: 8,
    reps_in_reserve: null,
    resistance_grams: 60_000,
    result_kind: 'resistance-and-repetitions',
    workout_session_exercise_id: exerciseId,
  };
}

function clone<TResult>(value: unknown): TResult | null {
  return value === undefined ? null : cloneRequired<TResult>(value);
}

function cloneRequired<TResult>(value: unknown): TResult {
  return JSON.parse(JSON.stringify(value)) as TResult;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected string parameter.');
  return value;
}

function requiredNumber(value: unknown): number {
  if (typeof value !== 'number') throw new Error('Expected number parameter.');
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null ? null : requiredString(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null ? null : requiredNumber(value);
}
