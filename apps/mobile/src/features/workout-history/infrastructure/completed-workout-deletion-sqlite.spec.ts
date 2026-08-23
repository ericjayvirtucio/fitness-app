import { DomainId } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { SqliteTransactionRunner } from '../../../infrastructure/persistence/sqlite-transaction-runner';
import type { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { WorkoutSessionSqliteRepository } from '../../workout-session/infrastructure/workout-session-sqlite-repository';
import {
  DeleteCompletedWorkoutUseCase,
  type CompletedWorkoutDeletionContext,
  type CompletedWorkoutDeletionOutcome,
} from '../application/delete-completed-workout-use-case';
import { WorkoutHistorySqliteRepository } from './workout-history-sqlite-repository';
import { WorkoutPersonalRecordsSqliteReader } from './workout-personal-records-sqlite-reader';
import {
  SyntheticWorkoutHistory,
  syntheticExerciseIds,
  unwrap,
} from './synthetic-workout-history.spec-helper';

const deviceId = 'device-a';
const now = () => new Date();

/**
 * Deleting completed history removes authoritative rows, so these run against a
 * real SQLite engine with the repository's own migrations rather than against a
 * fake that cannot enforce a constraint or roll a transaction back.
 */

type SessionRow = Readonly<{
  completed_at_epoch_ms: number | null;
  deleted_at_epoch_ms: number | null;
  display_name: string;
  id: string;
  source_planned_workout_id: string | null;
  source_weekday: number | null;
  started_at_epoch_ms: number;
  started_local_calendar_date: string;
  started_utc_offset_minutes: number;
  status: string;
}>;

type ExerciseRow = Readonly<{
  exercise_name_snapshot: string;
  id: string;
  logging_mode_snapshot: string;
  position: number;
  source_exercise_definition_id: string;
  workout_session_id: string;
}>;

type SetRow = Readonly<{
  id: string;
  position: number;
  repetitions: number | null;
  resistance_grams: number | null;
  result_kind: string;
  workout_session_exercise_id: string;
}>;

/** Fails one statement so a partially applied deletion can be observed. */
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

describe('Completed workout deletion on a real database', () => {
  let history: SyntheticWorkoutHistory;
  let database: NodeSqliteDatabase;
  let failing: FailingDatabase;
  let useCase: DeleteCompletedWorkoutUseCase;

  const range = {
    endLocalCalendarDate: '2026-01-31',
    startLocalCalendarDate: '2026-01-01',
  };

  beforeEach(async () => {
    history = await SyntheticWorkoutHistory.create();
    database = history.database;
    failing = new FailingDatabase(database);
    useCase = new DeleteCompletedWorkoutUseCase(
      new SqliteTransactionRunner<CompletedWorkoutDeletionContext>(
        failing,
        (transaction) => ({
          sessions: new WorkoutSessionSqliteRepository(
            transaction,
            deviceId,
            now,
          ),
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
              { repetitions: 5, resistanceGrams: 62_000 },
            ],
          },
        ],
        name: 'Kept workout',
      },
      {
        dayIndex: 1,
        exercises: [
          {
            loggingMode: 'external-load-and-repetitions',
            sets: [{ repetitions: 1, resistanceGrams: 300_000 }],
          },
          {
            definitionId: syntheticExerciseIds.run,
            loggingMode: 'duration',
            name: 'Run',
            sets: [{ durationSeconds: 600 }],
          },
        ],
        name: 'False workout',
      },
    );
  });

  afterEach(() => {
    history.close();
  });

  async function sessions(): Promise<readonly SessionRow[]> {
    return database.getAll<SessionRow>(
      'SELECT * FROM workout_session ORDER BY started_at_epoch_ms ASC',
    );
  }

  async function targets() {
    const rows = await sessions();
    const kept = rows[0];
    const doomed = rows[1];
    if (!kept || !doomed) throw new Error('Invalid fixture');
    return {
      doomed,
      expected: {
        completedAtEpochMilliseconds: doomed.completed_at_epoch_ms ?? 0,
        startedAtEpochMilliseconds: doomed.started_at_epoch_ms,
      },
      kept,
    };
  }

  async function snapshot(sessionId: string) {
    return {
      exercises: await database.getAll<ExerciseRow>(
        `SELECT * FROM workout_session_exercise
         WHERE workout_session_id = ? ORDER BY position ASC`,
        [sessionId],
      ),
      session: await database.getFirst<SessionRow>(
        'SELECT * FROM workout_session WHERE id = ?',
        [sessionId],
      ),
      sets: await database.getAll<SetRow>(
        `SELECT actual.* FROM workout_set actual
         JOIN workout_session_exercise exercise
           ON exercise.id = actual.workout_session_exercise_id
         WHERE exercise.workout_session_id = ?
         ORDER BY exercise.position ASC, actual.position ASC`,
        [sessionId],
      ),
    };
  }

  async function orphanCount(): Promise<number> {
    const orphanedSets = await database.getFirst<{ count: number }>(
      `SELECT COUNT(*) AS count FROM workout_set actual
       WHERE NOT EXISTS (
         SELECT 1 FROM workout_session_exercise exercise
         WHERE exercise.id = actual.workout_session_exercise_id
       )`,
    );
    const orphanedExercises = await database.getFirst<{ count: number }>(
      `SELECT COUNT(*) AS count FROM workout_session_exercise exercise
       WHERE NOT EXISTS (
         SELECT 1 FROM workout_session session
         WHERE session.id = exercise.workout_session_id
       )`,
    );
    return (orphanedSets?.count ?? -1) + (orphanedExercises?.count ?? -1);
  }

  function deleted(outcome: CompletedWorkoutDeletionOutcome) {
    if (outcome.status !== 'deleted')
      throw new Error(`Expected a deletion, got ${outcome.reason}`);
  }

  it('tombstones the selected workout and hard-deletes every row it owns', async () => {
    const { doomed, expected } = await targets();

    deleted(await useCase.execute({ expected, sessionId: doomed.id }));

    const gone = await snapshot(doomed.id);
    expect(gone.session?.deleted_at_epoch_ms).not.toBeNull();
    expect(gone.exercises).toEqual([]);
    expect(gone.sets).toEqual([]);
  });

  it('leaves every other workout structurally unchanged', async () => {
    const { doomed, expected, kept } = await targets();
    const before = await snapshot(kept.id);

    deleted(await useCase.execute({ expected, sessionId: doomed.id }));

    expect(await snapshot(kept.id)).toEqual(before);
  });

  it('leaves no orphaned child rows behind', async () => {
    const { doomed, expected } = await targets();

    deleted(await useCase.execute({ expected, sessionId: doomed.id }));

    expect(await orphanCount()).toBe(0);
  });

  it('restores the whole aggregate when a child delete fails', async () => {
    const { doomed, expected } = await targets();
    const before = await snapshot(doomed.id);
    failing.failOnStatement = 'DELETE FROM workout_session_exercise';

    await expect(
      useCase.execute({ expected, sessionId: doomed.id }),
    ).rejects.toThrow();

    expect(await snapshot(doomed.id)).toEqual(before);
    expect(await orphanCount()).toBe(0);
  });

  it('restores the whole aggregate when the parent tombstone write fails', async () => {
    const { doomed, expected } = await targets();
    const before = await snapshot(doomed.id);
    failing.failOnStatement = 'UPDATE workout_session SET deleted_at_epoch_ms';

    await expect(
      useCase.execute({ expected, sessionId: doomed.id }),
    ).rejects.toThrow();

    expect(await snapshot(doomed.id)).toEqual(before);
    expect(await orphanCount()).toBe(0);
  });

  it('refuses an active session and writes nothing', async () => {
    await history.store({
      dayIndex: 2,
      exercises: [{ loggingMode: 'repetitions', sets: [{ repetitions: 3 }] }],
      status: 'active',
    });
    const rows = await sessions();
    const active = rows.find((row) => row.status === 'active');
    if (!active) throw new Error('Invalid fixture');
    const before = await snapshot(active.id);

    const outcome = await useCase.execute({
      expected: {
        completedAtEpochMilliseconds: 0,
        startedAtEpochMilliseconds: active.started_at_epoch_ms,
      },
      sessionId: active.id,
    });

    expect(outcome).toEqual({ reason: 'not-completed', status: 'refused' });
    expect(await snapshot(active.id)).toEqual(before);
  });

  it('refuses a workout whose stored lifecycle no longer matches', async () => {
    const { doomed, expected } = await targets();
    const before = await snapshot(doomed.id);

    const outcome = await useCase.execute({
      expected: {
        ...expected,
        completedAtEpochMilliseconds: expected.completedAtEpochMilliseconds + 1,
      },
      sessionId: doomed.id,
    });

    expect(outcome).toEqual({ reason: 'changed', status: 'refused' });
    expect(await snapshot(doomed.id)).toEqual(before);
  });

  it('drops the workout from history and recomputes progress totals', async () => {
    const repository = new WorkoutHistorySqliteRepository(database);
    const { doomed, expected } = await targets();
    const before = await repository.summarizeCompletedRange(range);
    expect(before.completedWorkoutCount).toBe(2);

    deleted(await useCase.execute({ expected, sessionId: doomed.id }));

    const after = await repository.summarizeCompletedRange(range);
    expect(after.completedWorkoutCount).toBe(1);
    expect(after.actualSetCount).toBe(2);
    expect(after.performedExerciseCount).toBe(1);
    expect(after.repetitions).toBe(10);
    expect(after.durationSeconds).toBeNull();
    const page = await repository.listCompletedPage({ limit: 20 });
    expect(page.items.map((item) => item.sessionId.value)).not.toContain(
      doomed.id,
    );
    expect(
      await repository.getCompletedById(unwrap(DomainId.create(doomed.id))),
    ).toBeNull();
  });

  it('moves a personal record to the next eligible remaining result', async () => {
    const reader = new WorkoutPersonalRecordsSqliteReader(database);
    const pushUp = unwrap(DomainId.create(syntheticExerciseIds.pushUp));
    const { doomed, expected } = await targets();
    const before = await reader.readExercisePersonalRecords(pushUp);
    expect(
      before?.records.find((record) => record.category === 'heaviest-load')
        ?.canonicalValue,
    ).toBe(300_000);

    deleted(await useCase.execute({ expected, sessionId: doomed.id }));

    const after = await reader.readExercisePersonalRecords(pushUp);
    const heaviest = after?.records.find(
      (record) => record.category === 'heaviest-load',
    );
    expect(heaviest?.canonicalValue).toBe(62_000);
    expect(heaviest?.occurrence.sessionId.value).not.toBe(doomed.id);
  });

  it('claims no record when the deleted workout held the only evidence', async () => {
    const reader = new WorkoutPersonalRecordsSqliteReader(database);
    const run = unwrap(DomainId.create(syntheticExerciseIds.run));
    const { doomed, expected } = await targets();
    expect(
      (await reader.readExercisePersonalRecords(run))?.records,
    ).not.toEqual([]);

    deleted(await useCase.execute({ expected, sessionId: doomed.id }));

    const after = await reader.readExercisePersonalRecords(run);
    expect(after?.records ?? []).toEqual([]);
    const performed = await new WorkoutHistorySqliteRepository(
      database,
    ).listPerformedExercises(20);
    expect(
      performed.map((item) => item.sourceExerciseDefinitionId.value),
    ).not.toContain(syntheticExerciseIds.run);
  });

  it('leaves the schema version untouched', async () => {
    const { doomed, expected } = await targets();
    const before = await database.getVersion();

    deleted(await useCase.execute({ expected, sessionId: doomed.id }));

    expect(await database.getVersion()).toBe(before);
  });
});
