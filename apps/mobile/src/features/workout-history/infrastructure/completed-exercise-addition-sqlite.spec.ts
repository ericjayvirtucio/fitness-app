import {
  DomainId,
  ExerciseDefinition,
  RepetitionResult,
  ResistanceRepetitionResult,
  Mass,
  type ExerciseLoggingMode,
  type WorkoutResult,
} from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { SqliteTransactionRunner } from '../../../infrastructure/persistence/sqlite-transaction-runner';
import type { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import { ExerciseCatalogSqliteRepository } from '../../exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { WorkoutSessionSqliteRepository } from '../../workout-session/infrastructure/workout-session-sqlite-repository';
import {
  AddCompletedWorkoutExerciseUseCase,
  type CompletedExerciseAdditionContext,
  type CompletedExerciseAdditionOutcome,
} from '../application/add-completed-workout-exercise-use-case';
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
 * Adding a session exercise to a completed workout appends authoritative rows
 * and captures a snapshot from the live catalog, so these run against a real
 * SQLite engine with the repository's own migrations rather than against a fake
 * that cannot enforce a unique constraint or roll a transaction back.
 *
 * The catalog is seeded here rather than in `SyntheticWorkoutHistory`, which
 * deliberately never touches it: history stays the only authority a derived
 * claim may read, and the catalog enters this file only because capturing a new
 * snapshot is the one thing an addition needs it for.
 */

const chinUpDefinitionId = '33333333-3333-4333-8333-333333333333';

type SessionRow = Readonly<{
  completed_at_epoch_ms: number | null;
  deleted_at_epoch_ms: number | null;
  display_name: string;
  id: string;
  originating_device_id: string;
  revision: number;
  source_planned_workout_id: string | null;
  source_weekday: number | null;
  started_at_epoch_ms: number;
  started_local_calendar_date: string;
  started_utc_offset_minutes: number;
  status: string;
  updated_at_epoch_ms: number;
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
 * applied addition can both be observed without a production failure switch.
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

describe('Completed session exercise addition on a real database', () => {
  let history: SyntheticWorkoutHistory;
  let database: NodeSqliteDatabase;
  let observed: ObservedDatabase;
  let catalog: ExerciseCatalogSqliteRepository;
  let useCase: AddCompletedWorkoutExerciseUseCase;
  let generated: number;

  const range = {
    endLocalCalendarDate: '2026-01-31',
    startLocalCalendarDate: '2026-01-01',
  };

  function definition(
    value: string,
    name: string,
    loggingMode: ExerciseLoggingMode,
  ) {
    return unwrap(
      ExerciseCatalogItem.create({
        definition: unwrap(
          ExerciseDefinition.create({
            equipment: 'none',
            id: unwrap(DomainId.create(value)),
            loggingMode,
            name,
            primaryMuscleGroup: 'chest',
          }),
        ),
        isFavorite: false,
      }),
    );
  }

  beforeEach(async () => {
    history = await SyntheticWorkoutHistory.create();
    database = history.database;
    observed = new ObservedDatabase(database);
    catalog = new ExerciseCatalogSqliteRepository(database, deviceId, now);
    generated = 0;
    useCase = new AddCompletedWorkoutExerciseUseCase(
      new SqliteTransactionRunner<CompletedExerciseAdditionContext>(
        observed,
        (transaction) => ({
          catalog: new ExerciseCatalogSqliteRepository(
            transaction,
            deviceId,
            now,
          ),
          sessions: new WorkoutSessionSqliteRepository(
            transaction,
            deviceId,
            now,
          ),
        }),
      ),
      () => {
        generated += 1;
        return `11111111-2222-4333-8444-${String(generated).padStart(12, '0')}`;
      },
    );
    await catalog.insert(
      definition(
        syntheticExerciseIds.pushUp,
        'Push-up',
        'external-load-and-repetitions',
      ),
    );
    await catalog.insert(
      definition(chinUpDefinitionId, 'Chin-up', 'repetitions'),
    );
    await history.store(
      {
        dayIndex: 0,
        exercises: [
          {
            loggingMode: 'external-load-and-repetitions',
            sets: [{ repetitions: 5, resistanceGrams: 60_000 }],
          },
        ],
        name: 'Kept workout',
      },
      {
        dayIndex: 1,
        exercises: [
          {
            loggingMode: 'external-load-and-repetitions',
            sets: [{ repetitions: 5, resistanceGrams: 62_000 }],
          },
          {
            definitionId: syntheticExerciseIds.run,
            loggingMode: 'duration',
            name: 'Run',
            sets: [{ durationSeconds: 600 }],
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
    const second = exercises[1];
    if (!first || !second) throw new Error('Invalid fixture');
    return {
      expected: {
        completedAtEpochMilliseconds: mixed.completed_at_epoch_ms ?? 0,
        startedAtEpochMilliseconds: mixed.started_at_epoch_ms,
      },
      first,
      kept,
      mixed,
      second,
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

  function added(outcome: CompletedExerciseAdditionOutcome) {
    if (outcome.status !== 'added')
      throw new Error(`Expected an addition, got ${outcome.reason}`);
  }

  function chinUps(repetitions: number): WorkoutResult {
    return RepetitionResult.valid(repetitions);
  }

  async function addChinUp(repetitions = 10) {
    const { expected, mixed } = await targets();
    return {
      mixed,
      outcome: await useCase.execute({
        definitionId: chinUpDefinitionId,
        expected,
        result: chinUps(repetitions),
        sessionId: mixed.id,
      }),
    };
  }

  it('appends the exercise with its first recorded set at the last position', async () => {
    const { mixed, outcome } = await addChinUp();
    added(outcome);

    const after = await exerciseRows(mixed.id);
    expect(after).toHaveLength(3);
    expect(after.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(after[2]?.exercise_name_snapshot).toBe('Chin-up');
    const sets = (await snapshot(mixed.id)).sets.filter(
      (row) => row.workout_session_exercise_id === after[2]?.id,
    );
    expect(sets).toHaveLength(1);
    expect(sets[0]?.position).toBe(0);
    expect(sets[0]?.repetitions).toBe(10);
  });

  it('leaves every existing exercise row exactly as it was', async () => {
    const { first, second } = await targets();

    added((await addChinUp()).outcome);

    const after = await exerciseRows(second.workout_session_id);
    expect(after[0]).toEqual(first);
    expect(after[1]).toEqual(second);
  });

  it('captures the snapshot from the definition as it stands at that moment', async () => {
    await catalog.update(
      definition(chinUpDefinitionId, 'Pull-up', 'repetitions'),
    );

    const { mixed, outcome } = await addChinUp();
    added(outcome);

    const appended = (await exerciseRows(mixed.id))[2];
    expect(appended?.exercise_name_snapshot).toBe('Pull-up');
    expect(appended?.source_exercise_definition_id).toBe(chinUpDefinitionId);
    expect(appended?.planned_kind).toBeNull();
    expect(appended?.planned_sets).toBeNull();
  });

  it('leaves the parent row and its lifecycle instants untouched', async () => {
    const { mixed } = await targets();

    added((await addChinUp()).outcome);

    const after = await database.getFirst<SessionRow>(
      'SELECT * FROM workout_session WHERE id = ?',
      [mixed.id],
    );
    // Adding an exercise leaves every lifecycle instant and recorded fact
    // alone, but it is still a real change to the aggregate, so the parent
    // row's revision and update time advance.
    expect(after).toEqual({
      ...mixed,
      revision: mixed.revision + 1,
      updated_at_epoch_ms: after?.updated_at_epoch_ms,
    });
  });

  it('leaves every other workout structurally unchanged', async () => {
    const { kept } = await targets();
    const before = await snapshot(kept.id);

    added((await addChinUp()).outcome);

    expect(await snapshot(kept.id)).toEqual(before);
  });

  it('leaves no orphaned child rows behind', async () => {
    added((await addChinUp()).outcome);

    expect(await orphanCount()).toBe(0);
  });

  it('deletes every set before any exercise row and inserts only afterwards', async () => {
    observed.statements.length = 0;

    added((await addChinUp()).outcome);

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
    // The parent row's own revision still advances after its children are
    // rewritten, since adding an exercise is a real change to the aggregate,
    // but the parent row is updated in place — never deleted or recreated.
    const parentUpdate = order.findIndex((sql) =>
      sql.includes('UPDATE workout_session SET'),
    );
    expect(parentUpdate).toBeGreaterThan(firstInsert);
    expect(
      order.some((sql) => sql.includes('DELETE FROM workout_session ')),
    ).toBe(false);
  });

  it('binds every identifier as a parameter rather than inlining it', async () => {
    const { mixed } = await targets();
    observed.statements.length = 0;

    added((await addChinUp()).outcome);

    for (const entry of observed.statements) {
      expect(entry.sql).not.toContain(mixed.id);
      expect(entry.sql).not.toContain(chinUpDefinitionId);
    }
  });

  it('restores the whole aggregate when a child delete fails', async () => {
    const { mixed } = await targets();
    const before = await snapshot(mixed.id);
    observed.failOnStatement = 'DELETE FROM workout_session_exercise';

    await expect(addChinUp()).rejects.toThrow();

    expect(await snapshot(mixed.id)).toEqual(before);
    expect(await orphanCount()).toBe(0);
  });

  it('leaves neither the exercise nor its set when the insert fails', async () => {
    const { mixed } = await targets();
    const before = await snapshot(mixed.id);
    observed.failOnStatement = 'INSERT INTO workout_set';

    await expect(addChinUp()).rejects.toThrow();

    expect(await snapshot(mixed.id)).toEqual(before);
    expect(await orphanCount()).toBe(0);
  });

  it('refuses a workout already holding the most exercises and writes nothing', async () => {
    await history.store({
      dayIndex: 2,
      exercises: Array.from({ length: 100 }, (_, position) => ({
        loggingMode: 'repetitions' as const,
        sets: position === 0 ? [{ repetitions: 5 }] : [],
      })),
      name: 'Full workout',
    });
    const full = (await sessions())[2];
    if (!full) throw new Error('Invalid fixture');
    const before = await snapshot(full.id);

    const outcome = await useCase.execute({
      definitionId: chinUpDefinitionId,
      expected: {
        completedAtEpochMilliseconds: full.completed_at_epoch_ms ?? 0,
        startedAtEpochMilliseconds: full.started_at_epoch_ms,
      },
      result: chinUps(10),
      sessionId: full.id,
    });

    expect(outcome).toEqual({ reason: 'workout-full', status: 'refused' });
    expect(await snapshot(full.id)).toEqual(before);
  });

  it('refuses a definition deleted while the screen was open', async () => {
    const { mixed } = await targets();
    const before = await snapshot(mixed.id);
    await catalog.delete(unwrap(DomainId.create(chinUpDefinitionId)));

    const { outcome } = await addChinUp();

    expect(outcome).toEqual({
      reason: 'definition-not-found',
      status: 'refused',
    });
    expect(await snapshot(mixed.id)).toEqual(before);
  });

  it('refuses a workout whose stored lifecycle no longer matches', async () => {
    const { expected, mixed } = await targets();
    const before = await snapshot(mixed.id);

    const outcome = await useCase.execute({
      definitionId: chinUpDefinitionId,
      expected: {
        ...expected,
        completedAtEpochMilliseconds: expected.completedAtEpochMilliseconds + 1,
      },
      result: chinUps(10),
      sessionId: mixed.id,
    });

    expect(outcome).toEqual({ reason: 'changed', status: 'refused' });
    expect(await snapshot(mixed.id)).toEqual(before);
  });

  it('recomputes progress without changing the workout count or elapsed time', async () => {
    const repository = new WorkoutHistorySqliteRepository(database);
    const before = await repository.summarizeCompletedRange(range);
    expect(before.completedWorkoutCount).toBe(2);
    expect(before.performedExerciseCount).toBe(3);

    added((await addChinUp(12)).outcome);

    const after = await repository.summarizeCompletedRange(range);
    expect(after.completedWorkoutCount).toBe(2);
    expect(after.elapsedWorkoutSeconds).toBe(before.elapsedWorkoutSeconds);
    expect(after.actualSetCount).toBe(before.actualSetCount + 1);
    expect(after.performedExerciseCount).toBe(4);
    expect(after.repetitions).toBe((before.repetitions ?? 0) + 12);
  });

  it('claims a personal record from the added evidence', async () => {
    const reader = new WorkoutPersonalRecordsSqliteReader(database);
    const chinUp = unwrap(DomainId.create(chinUpDefinitionId));
    expect((await reader.readExercisePersonalRecords(chinUp))?.records).toEqual(
      [],
    );

    added((await addChinUp(12)).outcome);

    const records = await reader.readExercisePersonalRecords(chinUp);
    expect(
      records?.records.find((record) => record.category === 'most-repetitions')
        ?.canonicalValue,
    ).toBe(12);
  });

  it('adds the occurrence at the captured date and joins the performed list', async () => {
    const repository = new WorkoutHistorySqliteRepository(database);
    const chinUp = unwrap(DomainId.create(chinUpDefinitionId));
    const { mixed } = await targets();

    added((await addChinUp()).outcome);

    const page = await repository.listExercisePerformancePage(chinUp, {});
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.startedLocalCalendarDate).toBe(
      mixed.started_local_calendar_date,
    );
    const performed = await repository.listPerformedExercises(20);
    expect(
      performed.map((entry) => entry.sourceExerciseDefinitionId.value),
    ).toContain(chinUpDefinitionId);
  });

  it('leaves the schema version untouched', async () => {
    const before = await database.getVersion();

    added((await addChinUp()).outcome);

    expect(await database.getVersion()).toBe(before);
  });

  it('records a heavier logging mode without disturbing the captured ones', async () => {
    const { expected, mixed } = await targets();

    added(
      await useCase.execute({
        definitionId: syntheticExerciseIds.pushUp,
        expected,
        result: ResistanceRepetitionResult.valid(
          unwrap(Mass.create(80_000, 'gram')),
          3,
        ),
        sessionId: mixed.id,
      }),
    );

    const appended = (await exerciseRows(mixed.id))[2];
    expect(appended?.logging_mode_snapshot).toBe(
      'external-load-and-repetitions',
    );
    expect(appended?.source_exercise_definition_id).toBe(
      syntheticExerciseIds.pushUp,
    );
  });
});
