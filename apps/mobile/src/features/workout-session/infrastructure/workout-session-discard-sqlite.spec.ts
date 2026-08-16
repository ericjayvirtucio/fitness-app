import type { WorkoutSession } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { SqliteTransactionRunner } from '../../../infrastructure/persistence/sqlite-transaction-runner';
import type { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { SyntheticWorkoutHistory } from '../../workout-history/infrastructure/synthetic-workout-history.spec-helper';
import type { WorkoutSessionTransactionContext } from '../application/workout-session-repository';
import { DiscardWorkoutSessionUseCase } from '../application/workout-session-use-cases';
import { WorkoutSessionSqliteRepository } from './workout-session-sqlite-repository';

/**
 * Discarding abandons recorded work, so these run against a real SQLite engine
 * with the repository's own migrations. A fake runner can only show that the
 * code asked for a rollback; only the engine can show that one happened and
 * that the sets are still there afterwards.
 */

const parentDelete = 'DELETE FROM workout_session WHERE';
const exerciseDelete = 'DELETE FROM workout_session_exercise';
const setDelete = 'DELETE FROM workout_set';

/** Fails one statement so a partially applied discard could be observed. */
class FailingDatabase implements DatabaseConnection {
  failOnStatement: string | null = null;

  constructor(private readonly inner: DatabaseConnection) {}

  exec(statement: string) {
    return this.inner.exec(statement);
  }
  getAll<TResult>(statement: string, parameters: DatabaseParameters = []) {
    return this.inner.getAll<TResult>(statement, parameters);
  }
  getFirst<TResult>(statement: string, parameters: DatabaseParameters = []) {
    return this.inner.getFirst<TResult>(statement, parameters);
  }
  getVersion() {
    return this.inner.getVersion();
  }
  run(statement: string, parameters: DatabaseParameters = []) {
    return this.failOnStatement !== null &&
      statement.includes(this.failOnStatement)
      ? Promise.reject(new Error('Storage is unavailable.'))
      : this.inner.run(statement, parameters);
  }
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return this.inner.runExclusive<TResult>(() => operation(this));
  }
}

/** Every row of every table, so a write to an unrelated one cannot hide. */
async function snapshot(
  database: DatabaseConnection,
): Promise<Record<string, readonly unknown[]>> {
  const tables = await database.getAll<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
  );
  const contents: Record<string, readonly unknown[]> = {};
  for (const table of tables) {
    contents[table.name] = await database.getAll(
      `SELECT * FROM "${table.name}"`,
    );
  }
  return contents;
}

/** The recorded work a person would lose, in the order they recorded it. */
function performedWork(session: WorkoutSession | null) {
  return session === null
    ? null
    : {
        exercises: session.exercises.map((exercise) => ({
          name: exercise.exerciseNameSnapshot,
          position: exercise.position,
          sets: exercise.sets.map((set) => ({
            position: set.position,
            result: set.result,
          })),
        })),
        name: session.name,
        startedAtEpochMilliseconds: session.startedAtEpochMilliseconds,
        status: session.status,
      };
}

describe('Discarding an active workout on a real database', () => {
  let history: SyntheticWorkoutHistory;
  let database: NodeSqliteDatabase;
  let failing: FailingDatabase;
  let useCase: DiscardWorkoutSessionUseCase;
  let activeId: string;
  let completedId: string;

  beforeEach(async () => {
    history = await SyntheticWorkoutHistory.create();
    database = history.database;
    failing = new FailingDatabase(database);
    useCase = new DiscardWorkoutSessionUseCase(
      new SqliteTransactionRunner<WorkoutSessionTransactionContext>(
        failing,
        (transaction) => ({
          sessions: new WorkoutSessionSqliteRepository(transaction),
        }),
      ),
    );
    await history.store(
      {
        dayIndex: 0,
        exercises: [
          {
            loggingMode: 'external-load-and-repetitions',
            sets: [
              { repetitions: 5, resistanceGrams: 60_000 },
              { repetitions: 5, resistanceGrams: 62_500 },
            ],
          },
        ],
        name: 'Recorded history',
      },
      {
        dayIndex: 1,
        exercises: [
          {
            loggingMode: 'external-load-and-repetitions',
            name: 'Bench press',
            sets: [
              { repetitions: 8, resistanceGrams: 40_000 },
              { repetitions: 7, resistanceGrams: 42_500 },
              { repetitions: 6, resistanceGrams: 45_000 },
            ],
          },
          {
            loggingMode: 'bodyweight-and-repetitions',
            name: 'Push-up',
            sets: [{ repetitions: 12 }],
          },
        ],
        name: 'Abandoned workout',
        status: 'active',
      },
    );
    const active = await new WorkoutSessionSqliteRepository(
      database,
    ).getActive();
    const completed = await database.getFirst<{ id: string }>(
      `SELECT id FROM workout_session WHERE status = 'completed'`,
    );
    if (active === null || completed === null)
      throw new Error('Invalid fixture');
    activeId = active.id.value;
    completedId = completed.id;
  });

  afterEach(() => history.close());

  it('removes every row the discarded session owned', async () => {
    await expect(useCase.execute(activeId)).resolves.toBe(true);
    const sessions = await database.getAll<{ id: string }>(
      'SELECT id FROM workout_session',
    );
    expect(sessions).toEqual([{ id: completedId }]);
    const exercises = await database.getAll<{ workout_session_id: string }>(
      'SELECT workout_session_id FROM workout_session_exercise',
    );
    expect(
      exercises.every((row) => row.workout_session_id === completedId),
    ).toBe(true);
    expect(exercises).toHaveLength(1);
    const sets = await database.getFirst<{ count: number }>(
      'SELECT COUNT(*) AS count FROM workout_set',
    );
    expect(sets?.count).toBe(2);
    await expect(
      new WorkoutSessionSqliteRepository(database).getActive(),
    ).resolves.toBeNull();
  });

  it.each([
    ['the session is deleted', parentDelete],
    ['its exercises are deleted', exerciseDelete],
    ['its sets are deleted', setDelete],
  ])('restores the whole workout when %s fails', async (_label, statement) => {
    const before = await snapshot(database);
    const original = performedWork(
      await new WorkoutSessionSqliteRepository(database).getActive(),
    );
    failing.failOnStatement = statement;

    await expect(useCase.execute(activeId)).rejects.toThrow();

    failing.failOnStatement = null;
    expect(await snapshot(database)).toEqual(before);
    expect(
      performedWork(
        await new WorkoutSessionSqliteRepository(database).getActive(),
      ),
    ).toEqual(original);
  });

  it('leaves the completed workout untouched whatever happens', async () => {
    const stored = async () => ({
      exercises: await database.getAll(
        'SELECT * FROM workout_session_exercise WHERE workout_session_id = ?',
        [completedId],
      ),
      session: await database.getFirst(
        'SELECT * FROM workout_session WHERE id = ?',
        [completedId],
      ),
    });
    const before = await stored();

    for (const statement of [parentDelete, exerciseDelete, setDelete]) {
      failing.failOnStatement = statement;
      await expect(useCase.execute(activeId)).rejects.toThrow();
      failing.failOnStatement = null;
      expect(await stored()).toEqual(before);
    }

    await expect(useCase.execute(activeId)).resolves.toBe(true);
    expect(await stored()).toEqual(before);
  });

  it('cannot reach a completed workout through this path', async () => {
    const before = await snapshot(database);
    await expect(useCase.execute(completedId)).resolves.toBe(false);
    expect(await snapshot(database)).toEqual(before);
  });

  it('reports a session that is no longer stored without writing', async () => {
    await expect(useCase.execute(activeId)).resolves.toBe(true);
    const before = await snapshot(database);
    await expect(useCase.execute(activeId)).resolves.toBe(false);
    expect(await snapshot(database)).toEqual(before);
  });

  it('opens no transaction for an invalid identifier', async () => {
    const before = await snapshot(database);
    failing.failOnStatement = setDelete;
    await expect(useCase.execute('not-a-uuid')).resolves.toBe(false);
    failing.failOnStatement = null;
    expect(await snapshot(database)).toEqual(before);
  });

  it('leaves the schema version alone', async () => {
    const version = await database.getVersion();
    await expect(useCase.execute(activeId)).resolves.toBe(true);
    await expect(database.getVersion()).resolves.toBe(version);
  });
});
