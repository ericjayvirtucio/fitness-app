import {
  createWorkoutResult,
  DomainId,
  Mass,
  WorkoutSet,
} from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { SqliteTransactionRunner } from '../../../infrastructure/persistence/sqlite-transaction-runner';
import type { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { WorkoutSessionSqliteRepository } from '../../workout-session/infrastructure/workout-session-sqlite-repository';
import {
  CorrectCompletedWorkoutSetUseCase,
  fingerprintRecordedSet,
  type CompletedSetCorrectionOutcome,
  type CompletedWorkoutCorrectionContext,
} from '../application/correct-completed-workout-set-use-case';
import { WorkoutPersonalRecordsSqliteReader } from './workout-personal-records-sqlite-reader';
import {
  SyntheticWorkoutHistory,
  syntheticExerciseIds,
  unwrap,
} from './synthetic-workout-history.spec-helper';

const deviceId = 'device-a';
const now = () => new Date();

/**
 * Correcting completed history rewrites authoritative rows, so these run
 * against a real SQLite engine with the repository's own migrations rather than
 * against a fake that cannot enforce a constraint or roll a transaction back.
 */

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
  position: number;
  source_exercise_definition_id: string;
  workout_session_id: string;
}>;

type SetRow = Readonly<{
  id: string;
  position: number;
  repetitions: number | null;
  reps_in_reserve: number | null;
  resistance_grams: number | null;
  result_kind: string;
  workout_session_exercise_id: string;
}>;

/** Fails one statement so a partially applied correction can be observed. */
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

describe('Completed workout set correction on a real database', () => {
  let history: SyntheticWorkoutHistory;
  let database: NodeSqliteDatabase;
  let failing: FailingDatabase;
  let useCase: CorrectCompletedWorkoutSetUseCase;
  let generated = 0;

  const addedSetId = '33333333-3333-4333-8333-333333333333';

  beforeEach(async () => {
    history = await SyntheticWorkoutHistory.create();
    database = history.database;
    failing = new FailingDatabase(database);
    generated = 0;
    useCase = new CorrectCompletedWorkoutSetUseCase(
      new SqliteTransactionRunner<CompletedWorkoutCorrectionContext>(
        failing,
        (transaction) => ({
          sessions: new WorkoutSessionSqliteRepository(
            transaction,
            deviceId,
            now,
          ),
        }),
      ),
      () => {
        generated += 1;
        return generated === 1
          ? addedSetId
          : `33333333-3333-4333-8333-${String(generated).padStart(12, '0')}`;
      },
    );
    await history.store({
      dayIndex: 0,
      exercises: [
        {
          loggingMode: 'external-load-and-repetitions',
          sets: [
            { repetitions: 8, resistanceGrams: 600_000 },
            { repetitions: 6, resistanceGrams: 60_000 },
          ],
        },
      ],
    });
  });

  afterEach(() => history.close());

  function sessionRows() {
    return database.getAll<SessionRow>('SELECT * FROM workout_session');
  }

  function exerciseRows() {
    return database.getAll<ExerciseRow>(
      'SELECT * FROM workout_session_exercise ORDER BY position ASC',
    );
  }

  function setRows() {
    return database.getAll<SetRow>(
      `SELECT * FROM workout_set
       ORDER BY workout_session_exercise_id ASC, position ASC`,
    );
  }

  async function orphanCount() {
    const rows = await database.getAll<{ count: number }>(
      `SELECT COUNT(*) AS count FROM workout_set
       WHERE workout_session_exercise_id NOT IN (
         SELECT id FROM workout_session_exercise
       )`,
    );
    return rows[0]?.count ?? -1;
  }

  async function identifiers() {
    const rows = await sessionRows();
    const exercises = await exerciseRows();
    const sets = await setRows();
    const session = rows[0];
    const exercise = exercises[0];
    if (!session || !exercise) throw new Error('Invalid fixture');
    return { exercise, session, sets };
  }

  function resistanceResult(kilograms: number, repetitions: number) {
    return unwrap(
      createWorkoutResult({
        loggingMode: 'external-load-and-repetitions',
        repetitions,
        resistance: unwrap(Mass.create(kilograms, 'kilogram')),
      }),
    );
  }

  function overstatedFingerprint() {
    return fingerprintRecordedSet(
      unwrap(
        WorkoutSet.create({
          id: unwrap(DomainId.create('99999999-9999-4999-8999-999999999999')),
          position: 0,
          repsInReserve: null,
          result: resistanceResult(600, 8),
        }),
      ),
    );
  }

  function assertCorrected(outcome: CompletedSetCorrectionOutcome) {
    if (outcome.status !== 'corrected')
      throw new Error(`Expected a correction, got ${outcome.reason}`);
    return outcome.session;
  }

  it('corrects one recorded set and leaves every other stored fact alone', async () => {
    const before = await identifiers();

    const outcome = await useCase.editSet({
      exerciseId: before.exercise.id,
      expected: overstatedFingerprint(),
      repsInReserve: 2,
      result: resistanceResult(60, 8),
      sessionId: before.session.id,
      setId: before.sets[0]?.id,
    });
    assertCorrected(outcome);

    const after = await identifiers();
    // A completed workout's own facts do not move, but correcting it is a
    // real change to the aggregate: the parent row's revision and update
    // time advance even though every recorded fact besides the corrected set
    // stays exactly as it was.
    expect(after.session).toEqual({
      ...before.session,
      revision: before.session.revision + 1,
      updated_at_epoch_ms: after.session.updated_at_epoch_ms,
    });
    expect(after.session.updated_at_epoch_ms).toBeGreaterThanOrEqual(
      before.session.updated_at_epoch_ms,
    );
    expect(after.exercise).toEqual(before.exercise);
    expect(after.sets.map((row) => row.id)).toEqual(
      before.sets.map((row) => row.id),
    );
    expect(after.sets.map((row) => row.position)).toEqual([0, 1]);
    expect(after.sets[0]?.resistance_grams).toBe(60_000);
    expect(after.sets[0]?.repetitions).toBe(8);
    expect(after.sets[0]?.reps_in_reserve).toBe(2);
    expect(after.sets[1]).toEqual(before.sets[1]);
    expect(await orphanCount()).toBe(0);
    expect(await database.getVersion()).toBe(13);
  });

  it('reconstructs the corrected aggregate from stored rows', async () => {
    const before = await identifiers();
    await useCase.editSet({
      exerciseId: before.exercise.id,
      expected: overstatedFingerprint(),
      repsInReserve: null,
      result: resistanceResult(60, 8),
      sessionId: before.session.id,
      setId: before.sets[0]?.id,
    });

    const reloaded = await new WorkoutSessionSqliteRepository(
      database,
      deviceId,
      now,
    ).getById(unwrap(DomainId.create(before.session.id)));

    expect(reloaded?.status).toBe('completed');
    expect(reloaded?.completedAtEpochMilliseconds).toBe(
      before.session.completed_at_epoch_ms,
    );
    expect(reloaded?.exercises[0]?.sets[0]?.result).toMatchObject({
      repetitions: 8,
    });
    expect(reloaded?.exercises[0]?.sets).toHaveLength(2);
  });

  it('lets the corrected history decide the personal record', async () => {
    const reader = new WorkoutPersonalRecordsSqliteReader(database);
    const definitionId = unwrap(DomainId.create(syntheticExerciseIds.pushUp));
    const before = await identifiers();
    expect(
      (await reader.readExercisePersonalRecords(definitionId)).records[0],
    ).toMatchObject({ canonicalValue: 600_000, category: 'heaviest-load' });

    await useCase.editSet({
      exerciseId: before.exercise.id,
      expected: overstatedFingerprint(),
      repsInReserve: null,
      result: resistanceResult(60, 8),
      sessionId: before.session.id,
      setId: before.sets[0]?.id,
    });

    expect(
      (await reader.readExercisePersonalRecords(definitionId)).records[0],
    ).toMatchObject({ canonicalValue: 60_000, category: 'heaviest-load' });
  });

  it('adds a missing set at the next stored position', async () => {
    const before = await identifiers();

    assertCorrected(
      await useCase.addSet({
        exerciseId: before.exercise.id,
        repsInReserve: null,
        result: resistanceResult(50, 10),
        sessionId: before.session.id,
      }),
    );

    const after = await identifiers();
    expect(after.sets.map((row) => row.id)).toEqual([
      before.sets[0]?.id,
      before.sets[1]?.id,
      addedSetId,
    ]);
    expect(after.sets.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(after.sets[2]?.resistance_grams).toBe(50_000);
    expect(after.session).toEqual({
      ...before.session,
      revision: before.session.revision + 1,
      updated_at_epoch_ms: after.session.updated_at_epoch_ms,
    });
    expect(await orphanCount()).toBe(0);
  });

  it('deletes a recorded set and renumbers the survivors in storage', async () => {
    const before = await identifiers();

    assertCorrected(
      await useCase.deleteSet({
        exerciseId: before.exercise.id,
        expected: overstatedFingerprint(),
        sessionId: before.session.id,
        setId: before.sets[0]?.id,
      }),
    );

    const after = await identifiers();
    expect(after.sets).toHaveLength(1);
    expect(after.sets[0]?.id).toBe(before.sets[1]?.id);
    expect(after.sets[0]?.position).toBe(0);
    expect(after.session).toEqual({
      ...before.session,
      revision: before.session.revision + 1,
      updated_at_epoch_ms: after.session.updated_at_epoch_ms,
    });
    expect(await orphanCount()).toBe(0);
  });

  it('refuses to delete the only remaining recorded set', async () => {
    const before = await identifiers();
    await useCase.deleteSet({
      exerciseId: before.exercise.id,
      expected: overstatedFingerprint(),
      sessionId: before.session.id,
      setId: before.sets[0]?.id,
    });

    const remaining = await identifiers();
    const outcome = await useCase.deleteSet({
      exerciseId: remaining.exercise.id,
      expected: fingerprintRecordedSet(
        unwrap(
          WorkoutSet.create({
            id: unwrap(DomainId.create('99999999-9999-4999-8999-999999999998')),
            position: 0,
            repsInReserve: null,
            result: resistanceResult(60, 6),
          }),
        ),
      ),
      sessionId: remaining.session.id,
      setId: remaining.sets[0]?.id,
    });

    expect(outcome).toMatchObject({
      reason: 'would-empty-workout',
      status: 'refused',
    });
    expect((await identifiers()).sets).toHaveLength(1);
  });

  it('preserves the previous completed history when the write fails', async () => {
    const before = await identifiers();
    failing.failOnStatement = 'INSERT INTO workout_set';

    await expect(
      useCase.editSet({
        exerciseId: before.exercise.id,
        expected: overstatedFingerprint(),
        repsInReserve: null,
        result: resistanceResult(60, 8),
        sessionId: before.session.id,
        setId: before.sets[0]?.id,
      }),
    ).rejects.toThrow();

    failing.failOnStatement = null;
    const after = await identifiers();
    expect(after.session).toEqual(before.session);
    expect(after.exercise).toEqual(before.exercise);
    expect(after.sets).toEqual(before.sets);
    expect(await orphanCount()).toBe(0);
    expect(await database.getVersion()).toBe(13);
  });
});
