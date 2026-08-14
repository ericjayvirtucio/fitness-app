import { DomainId, ResistanceRepetitionPrescription } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { SqliteTransactionRunner } from '../../../infrastructure/persistence/sqlite-transaction-runner';
import type { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { WorkoutSessionSqliteRepository } from '../../workout-session/infrastructure/workout-session-sqlite-repository';
import {
  RemoveCompletedWorkoutExerciseUseCase,
  type CompletedExerciseRemovalContext,
  type CompletedExerciseRemovalOutcome,
} from '../application/remove-completed-workout-exercise-use-case';
import { WorkoutHistorySqliteRepository } from './workout-history-sqlite-repository';
import { WorkoutPersonalRecordsSqliteReader } from './workout-personal-records-sqlite-reader';
import {
  SyntheticWorkoutHistory,
  syntheticExerciseIds,
  unwrap,
} from './synthetic-workout-history.spec-helper';

/**
 * Removing a completed session exercise rewrites authoritative rows and
 * renumbers the survivors, so these run against a real SQLite engine with the
 * repository's own migrations rather than against a fake that cannot enforce a
 * unique constraint or roll a transaction back.
 */

type SessionRow = Readonly<{
  completed_at_epoch_ms: number | null;
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
  planned_kind: string | null;
  planned_repetitions: number | null;
  planned_sets: number | null;
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

/**
 * Records every statement and can fail one, so the write order and a partially
 * applied removal can both be observed without a production failure switch.
 */
class ObservedDatabase implements DatabaseConnection {
  failOnStatement: string | null = null;
  readonly statements: { parameters: DatabaseParameters; sql: string }[] = [];

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
    this.statements.push({ parameters, sql: statement });
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

describe('Completed session exercise removal on a real database', () => {
  let history: SyntheticWorkoutHistory;
  let database: NodeSqliteDatabase;
  let observed: ObservedDatabase;
  let useCase: RemoveCompletedWorkoutExerciseUseCase;

  const range = {
    endLocalCalendarDate: '2026-01-31',
    startLocalCalendarDate: '2026-01-01',
  };

  beforeEach(async () => {
    history = await SyntheticWorkoutHistory.create();
    database = history.database;
    observed = new ObservedDatabase(database);
    useCase = new RemoveCompletedWorkoutExerciseUseCase(
      new SqliteTransactionRunner<CompletedExerciseRemovalContext>(
        observed,
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
            planned: ResistanceRepetitionPrescription.valid(3, 5, null),
            sets: [{ repetitions: 1, resistanceGrams: 300_000 }],
          },
          {
            definitionId: syntheticExerciseIds.run,
            loggingMode: 'duration',
            name: 'Run',
            sets: [{ durationSeconds: 600 }],
          },
          {
            loggingMode: 'external-load-and-repetitions',
            sets: [{ repetitions: 3, resistanceGrams: 50_000 }],
          },
        ],
        name: 'Mixed workout',
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
    const mixed = rows[1];
    if (!kept || !mixed) throw new Error('Invalid fixture');
    const exercises = await exerciseRows(mixed.id);
    const first = exercises[0];
    const middle = exercises[1];
    const last = exercises[2];
    if (!first || !middle || !last) throw new Error('Invalid fixture');
    return {
      expected: {
        completedAtEpochMilliseconds: mixed.completed_at_epoch_ms ?? 0,
        startedAtEpochMilliseconds: mixed.started_at_epoch_ms,
      },
      first,
      kept,
      last,
      middle,
      mixed,
    };
  }

  async function exerciseRows(
    sessionId: string,
  ): Promise<readonly ExerciseRow[]> {
    return database.getAll<ExerciseRow>(
      `SELECT * FROM workout_session_exercise
       WHERE workout_session_id = ? ORDER BY position ASC`,
      [sessionId],
    );
  }

  async function snapshot(sessionId: string) {
    return {
      exercises: await exerciseRows(sessionId),
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

  function removed(outcome: CompletedExerciseRemovalOutcome) {
    if (outcome.status !== 'removed')
      throw new Error(`Expected a removal, got ${outcome.reason}`);
  }

  it('removes the selected exercise with every set it owned', async () => {
    const { expected, middle, mixed } = await targets();

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    const after = await snapshot(mixed.id);
    expect(after.exercises.map((row) => row.id)).not.toContain(middle.id);
    expect(
      after.sets.filter((row) => row.workout_session_exercise_id === middle.id),
    ).toEqual([]);
  });

  it('leaves the survivors at contiguous positions with their identifiers', async () => {
    const { expected, first, last, middle, mixed } = await targets();

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    const after = await exerciseRows(mixed.id);
    expect(after.map((row) => row.id)).toEqual([first.id, last.id]);
    expect(after.map((row) => row.position)).toEqual([0, 1]);
  });

  it('leaves every captured snapshot of the survivors untouched', async () => {
    const { expected, first, middle, mixed } = await targets();

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    const survivor = (await exerciseRows(mixed.id))[0];
    expect(survivor).toEqual({ ...first, position: 0 });
  });

  it('leaves the parent row and its lifecycle instants untouched', async () => {
    const { expected, middle, mixed } = await targets();

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    expect(
      await database.getFirst<SessionRow>(
        'SELECT * FROM workout_session WHERE id = ?',
        [mixed.id],
      ),
    ).toEqual(mixed);
  });

  it('leaves every other workout structurally unchanged', async () => {
    const { expected, kept, middle, mixed } = await targets();
    const before = await snapshot(kept.id);

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    expect(await snapshot(kept.id)).toEqual(before);
  });

  it('leaves no orphaned child rows behind', async () => {
    const { expected, middle, mixed } = await targets();

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    expect(await orphanCount()).toBe(0);
  });

  it('deletes every set before any exercise row and inserts only afterwards', async () => {
    const { expected, middle, mixed } = await targets();
    observed.statements.length = 0;

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    const order = observed.statements.map((entry) => entry.sql);
    const setDelete = order.findIndex((sql) =>
      sql.includes('DELETE FROM workout_set'),
    );
    const exerciseDelete = order.findIndex((sql) =>
      sql.includes('DELETE FROM workout_session_exercise'),
    );
    const firstInsert = order.findIndex((sql) => sql.includes('INSERT INTO'));
    expect(setDelete).toBeGreaterThanOrEqual(0);
    expect(exerciseDelete).toBeGreaterThan(setDelete);
    expect(firstInsert).toBeGreaterThan(exerciseDelete);
    expect(
      order.some((sql) => sql.includes('DELETE FROM workout_session ')),
    ).toBe(false);
  });

  it('binds every identifier as a parameter rather than inlining it', async () => {
    const { expected, middle, mixed } = await targets();
    observed.statements.length = 0;

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    for (const entry of observed.statements) {
      expect(entry.sql).not.toContain(mixed.id);
      expect(entry.sql).not.toContain(middle.id);
    }
  });

  it('restores the whole aggregate when a child delete fails', async () => {
    const { expected, middle, mixed } = await targets();
    const before = await snapshot(mixed.id);
    observed.failOnStatement = 'DELETE FROM workout_session_exercise';

    await expect(
      useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    ).rejects.toThrow();

    expect(await snapshot(mixed.id)).toEqual(before);
    expect(await orphanCount()).toBe(0);
  });

  it('restores the whole aggregate when a survivor insert fails', async () => {
    const { expected, middle, mixed } = await targets();
    const before = await snapshot(mixed.id);
    observed.failOnStatement = 'INSERT INTO workout_set';

    await expect(
      useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    ).rejects.toThrow();

    expect(await snapshot(mixed.id)).toEqual(before);
    expect(await orphanCount()).toBe(0);
  });

  it('refuses to empty a workout of recorded sets and writes nothing', async () => {
    const { kept } = await targets();
    const only = (await exerciseRows(kept.id))[0];
    if (!only) throw new Error('Invalid fixture');
    const before = await snapshot(kept.id);

    const outcome = await useCase.execute({
      exerciseId: only.id,
      expected: {
        completedAtEpochMilliseconds: kept.completed_at_epoch_ms ?? 0,
        startedAtEpochMilliseconds: kept.started_at_epoch_ms,
      },
      sessionId: kept.id,
    });

    expect(outcome).toEqual({
      reason: 'would-empty-workout',
      status: 'refused',
    });
    expect(await snapshot(kept.id)).toEqual(before);
  });

  it('refuses a workout whose stored lifecycle no longer matches', async () => {
    const { expected, middle, mixed } = await targets();
    const before = await snapshot(mixed.id);

    const outcome = await useCase.execute({
      exerciseId: middle.id,
      expected: {
        ...expected,
        completedAtEpochMilliseconds: expected.completedAtEpochMilliseconds + 1,
      },
      sessionId: mixed.id,
    });

    expect(outcome).toEqual({ reason: 'changed', status: 'refused' });
    expect(await snapshot(mixed.id)).toEqual(before);
  });

  it('recomputes progress from the remaining facts without changing the workout count', async () => {
    const repository = new WorkoutHistorySqliteRepository(database);
    const { expected, middle, mixed } = await targets();
    const before = await repository.summarizeCompletedRange(range);
    expect(before.completedWorkoutCount).toBe(2);
    expect(before.performedExerciseCount).toBe(4);
    expect(before.durationSeconds).toBe(600);

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    const after = await repository.summarizeCompletedRange(range);
    expect(after.completedWorkoutCount).toBe(2);
    expect(after.elapsedWorkoutSeconds).toBe(before.elapsedWorkoutSeconds);
    expect(after.actualSetCount).toBe(4);
    expect(after.performedExerciseCount).toBe(3);
    expect(after.repetitions).toBe(14);
    expect(after.durationSeconds).toBeNull();
  });

  it('moves a personal record to the next eligible remaining result', async () => {
    const reader = new WorkoutPersonalRecordsSqliteReader(database);
    const pushUp = unwrap(DomainId.create(syntheticExerciseIds.pushUp));
    const { expected, first, mixed } = await targets();
    const before = await reader.readExercisePersonalRecords(pushUp);
    expect(
      before?.records.find((record) => record.category === 'heaviest-load')
        ?.canonicalValue,
    ).toBe(300_000);

    removed(
      await useCase.execute({
        exerciseId: first.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    const heaviest = (
      await reader.readExercisePersonalRecords(pushUp)
    )?.records.find((record) => record.category === 'heaviest-load');
    expect(heaviest?.canonicalValue).toBe(62_000);
  });

  it('drops the occurrence and the performed exercise when the removed work held the only evidence', async () => {
    const repository = new WorkoutHistorySqliteRepository(database);
    const reader = new WorkoutPersonalRecordsSqliteReader(database);
    const run = unwrap(DomainId.create(syntheticExerciseIds.run));
    const { expected, middle, mixed } = await targets();
    expect(
      (await reader.readExercisePersonalRecords(run))?.records,
    ).not.toEqual([]);

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    expect(
      (await reader.readExercisePersonalRecords(run))?.records ?? [],
    ).toEqual([]);
    const occurrences = await repository.listExercisePerformancePage(run, {
      limit: 20,
    });
    expect(occurrences.items).toEqual([]);
    const performed = await repository.listPerformedExercises(20);
    expect(
      performed.map((item) => item.sourceExerciseDefinitionId.value),
    ).not.toContain(syntheticExerciseIds.run);
  });

  it('leaves the schema version untouched', async () => {
    const { expected, middle, mixed } = await targets();
    const before = await database.getVersion();

    removed(
      await useCase.execute({
        exerciseId: middle.id,
        expected,
        sessionId: mixed.id,
      }),
    );

    expect(await database.getVersion()).toBe(before);
  });
});
