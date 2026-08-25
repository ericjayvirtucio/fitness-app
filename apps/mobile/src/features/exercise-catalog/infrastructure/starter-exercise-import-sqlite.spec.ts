import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { initializeDatabase } from '../../../infrastructure/persistence/database-initializer';
import { migrations } from '../../../infrastructure/persistence/migrations';
import { SqliteTransactionRunner } from '../../../infrastructure/persistence/sqlite-transaction-runner';
import { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { SyntheticWorkoutHistory } from '../../workout-history/infrastructure/synthetic-workout-history.spec-helper';
import { AddStarterExercisesUseCase } from '../application/add-starter-exercises-use-case';
import { buildExerciseCatalogItem } from '../application/build-exercise-catalog-item';
import {
  DeleteExerciseUseCase,
  UpdateExerciseUseCase,
} from '../application/exercise-catalog-use-cases';
import type { StarterExerciseImportContext } from '../application/starter-exercise-import-context';
import { starterExercises } from '../application/starter-exercises';
import { ExerciseCatalogDataEraser } from './exercise-catalog-data-eraser';
import { ExerciseCatalogExportSqliteReader } from './exercise-catalog-export-sqlite-reader';
import { ExerciseCatalogSqliteRepository } from './exercise-catalog-sqlite-repository';
import { ExerciseCatalogStoredDataProbe } from './exercise-catalog-stored-data-probe';

const deviceId = 'device-a';
const now = () => new Date();

/**
 * The import's promises are engine properties, not orchestration properties.
 * Only a real engine can show that a forced failure leaves the catalog exactly
 * as it was, that a hand-authored row survives untouched, and that nothing else
 * in the schema was written, so these run against the repository's own
 * migrations rather than against a fake.
 *
 * Failures are injected through a decorator this file owns. The application has
 * no failure switch and no hidden route, exactly as the correction, removal,
 * deletion, and addition integration specs require.
 */

type CatalogRow = Readonly<{
  deleted_at_epoch_ms: number | null;
  display_name: string;
  equipment: string;
  id: string;
  is_favorite: number;
  logging_mode: string;
  normalized_name: string;
  notes: string | null;
  originating_device_id: string;
  primary_muscle_group: string;
  revision: number;
  updated_at_epoch_ms: number;
}>;

const writableTables = [
  'personal_profile',
  'goal_configuration',
  'nutrition_consumption_entry',
  'nutrition_catalog_item',
  'hydration_entry',
  'hydration_target',
  'exercise_catalog_item',
  'planned_workout',
  'planned_exercise',
  'workout_session',
  'workout_session_exercise',
  'workout_set',
  'body_weight_entry',
] as const;

class ObservedDatabase implements DatabaseConnection {
  failOnInsertIndex: number | null = null;
  failOnRestoreIndex: number | null = null;
  private insertCount = 0;
  private restoreCount = 0;

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
    if (statement.startsWith('INSERT INTO exercise_catalog_item')) {
      this.insertCount += 1;
      if (this.insertCount === this.failOnInsertIndex)
        return Promise.reject(new Error('Storage is unavailable.'));
    }
    if (
      statement.startsWith(
        'UPDATE exercise_catalog_item SET deleted_at_epoch_ms = NULL',
      )
    ) {
      this.restoreCount += 1;
      if (this.restoreCount === this.failOnRestoreIndex)
        return Promise.reject(new Error('Storage is unavailable.'));
    }
    return this.inner.run(statement, parameters);
  }
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return this.inner.runExclusive<TResult>(() => operation(this));
  }
}

function unwrap<TValue>(result: {
  isSuccess: boolean;
  value?: TValue;
}): TValue {
  if (!result.isSuccess || result.value === undefined)
    throw new Error('Invalid fixture');
  return result.value;
}

describe('Starter exercise import on a real database', () => {
  let database: NodeSqliteDatabase;
  let observed: ObservedDatabase;
  let catalog: ExerciseCatalogSqliteRepository;
  let runner: SqliteTransactionRunner<StarterExerciseImportContext>;
  let useCase: AddStarterExercisesUseCase;

  beforeEach(async () => {
    database = new NodeSqliteDatabase();
    await initializeDatabase(database, migrations);
    observed = new ObservedDatabase(database);
    catalog = new ExerciseCatalogSqliteRepository(database, deviceId, now);
    runner = new SqliteTransactionRunner<StarterExerciseImportContext>(
      observed,
      (transaction) => ({
        catalog: new ExerciseCatalogSqliteRepository(
          transaction,
          deviceId,
          now,
        ),
      }),
    );
    useCase = new AddStarterExercisesUseCase(runner);
  });

  afterEach(() => {
    database.close();
  });

  async function rows(): Promise<readonly CatalogRow[]> {
    return database.getAll<CatalogRow>(
      'SELECT * FROM exercise_catalog_item ORDER BY normalized_name ASC, id ASC',
    );
  }

  async function rowCounts(): Promise<Readonly<Record<string, number>>> {
    const counts: Record<string, number> = {};
    for (const table of writableTables) {
      const row = await database.getFirst<{ total: number }>(
        `SELECT COUNT(*) AS total FROM ${table}`,
      );
      counts[table] = row?.total ?? 0;
    }
    return counts;
  }

  function authored(id: string, name: string) {
    const entry = starterExercises[0];
    if (entry === undefined) throw new Error('Invalid fixture');
    return unwrap(
      buildExerciseCatalogItem(id, {
        equipment: entry.equipment,
        isFavorite: false,
        loggingMode: entry.loggingMode,
        name,
        primaryMuscleGroup: entry.primaryMuscleGroup,
      }),
    );
  }

  it('writes every definition into an empty catalog', async () => {
    const outcome = await useCase.execute();

    expect(outcome).toEqual({
      addedCount: starterExercises.length,
      skippedCount: 0,
      status: 'imported',
    });
    expect(await rows()).toHaveLength(starterExercises.length);
  });

  it('stores each definition exactly as the content describes it', async () => {
    await useCase.execute();
    const stored = new Map(
      (await rows()).map((row: CatalogRow) => [row.id, row]),
    );

    for (const entry of starterExercises) {
      expect(stored.get(entry.id)).toMatchObject({
        display_name: entry.name,
        equipment: entry.equipment,
        id: entry.id,
        is_favorite: 0,
        logging_mode: entry.loggingMode,
        normalized_name: entry.name.toLowerCase(),
        notes: null,
        primary_muscle_group: entry.primaryMuscleGroup,
      });
    }
  });

  it('favorites nothing', async () => {
    await useCase.execute();

    expect((await rows()).every((row) => row.is_favorite === 0)).toBe(true);
  });

  it('leaves a hand-authored definition sharing a name untouched', async () => {
    const entry = starterExercises[0];
    if (entry === undefined) throw new Error('Invalid fixture');
    const id = '11111111-1111-4111-8111-111111111111';
    await catalog.insert(authored(id, entry.name));

    const outcome = await useCase.execute();
    const stored = await rows();

    expect(outcome).toEqual({
      addedCount: starterExercises.length - 1,
      skippedCount: 1,
      status: 'imported',
    });
    expect(stored.some((row) => row.id === id)).toBe(true);
    expect(stored.some((row) => row.id === entry.id)).toBe(false);
    expect(
      stored.filter((row) => row.normalized_name === entry.name.toLowerCase()),
    ).toHaveLength(1);
  });

  it('adds nothing on a second import', async () => {
    await useCase.execute();

    const outcome = await useCase.execute();

    expect(outcome).toEqual({
      skippedCount: starterExercises.length,
      status: 'unchanged',
    });
    expect(await rows()).toHaveLength(starterExercises.length);
  });

  it('rolls back to exactly the previous catalog when a write fails', async () => {
    const id = '22222222-2222-4222-8222-222222222222';
    await catalog.insert(authored(id, 'Authored movement'));
    const before = await rows();
    observed.failOnInsertIndex = 4;

    const outcome = await useCase.execute();

    expect(outcome).toEqual({ reason: 'write-failed', status: 'refused' });
    expect(await rows()).toEqual(before);
  });

  it('writes no other table', async () => {
    const before = await rowCounts();

    await useCase.execute();
    const after = await rowCounts();

    expect(after).toEqual({
      ...before,
      exercise_catalog_item: starterExercises.length,
    });
  });

  it('leaves the schema version unchanged', async () => {
    await useCase.execute();

    expect(await database.getVersion()).toBe(migrations.length);
  });

  it('lets an imported definition be updated and deleted like any other', async () => {
    await useCase.execute();
    const entry = starterExercises[0];
    if (entry === undefined) throw new Error('Invalid fixture');

    const updated = await new UpdateExerciseUseCase(catalog).execute(entry.id, {
      equipment: 'dumbbell',
      isFavorite: true,
      loggingMode: 'external-load-and-repetitions',
      name: 'Renamed movement',
      primaryMuscleGroup: 'shoulders',
    });
    const deleted = await new DeleteExerciseUseCase(catalog).execute(entry.id);

    expect(updated.status).toBe('saved');
    expect(deleted).toEqual({ status: 'deleted' });
    const stored = (await rows()).find((row) => row.id === entry.id);
    expect(stored?.deleted_at_epoch_ms).not.toBeNull();
  });

  /**
   * Resolves the interaction Specification 0043 recorded and deliberately
   * left open: what "delete it, then ask for it again" means once deletion
   * is a tombstone rather than a hard delete. Explicit consent to add the
   * definition again resurrects the same row instead of refusing the whole
   * import, but it is not consent to discard an edit made before the
   * deletion, so every stored field the person changed survives untouched
   * and only the tombstone, revision, and modification time move. The
   * reimport runs from a second device to prove `originating_device_id`
   * stays with whichever device first created the row.
   */
  it('resurrects a deleted definition on re-import, keeping what the person changed and its originating device', async () => {
    await useCase.execute();
    const entry = starterExercises[0];
    if (entry === undefined) throw new Error('Invalid fixture');

    const updated = await new UpdateExerciseUseCase(catalog).execute(entry.id, {
      equipment: 'dumbbell',
      isFavorite: true,
      loggingMode: 'external-load-and-repetitions',
      name: 'My custom bench',
      notes: 'Added a spotter',
      primaryMuscleGroup: 'shoulders',
    });
    expect(updated.status).toBe('saved');
    const deleted = await new DeleteExerciseUseCase(catalog).execute(entry.id);
    expect(deleted).toEqual({ status: 'deleted' });
    const beforeReimport = (await rows()).find((row) => row.id === entry.id);
    expect(beforeReimport?.deleted_at_epoch_ms).not.toBeNull();
    expect(beforeReimport).toMatchObject({
      originating_device_id: deviceId,
      revision: 3,
    });

    const otherDeviceUseCase = new AddStarterExercisesUseCase(
      new SqliteTransactionRunner<StarterExerciseImportContext>(
        database,
        (transaction) => ({
          catalog: new ExerciseCatalogSqliteRepository(
            transaction,
            'device-b',
            now,
          ),
        }),
      ),
    );
    const outcome = await otherDeviceUseCase.execute();

    expect(outcome).toEqual({
      addedCount: 1,
      skippedCount: starterExercises.length - 1,
      status: 'imported',
    });
    const stored = await rows();
    // Exactly the starter count: the resurrect undeleted the existing row
    // rather than inserting a second one alongside it.
    expect(stored).toHaveLength(starterExercises.length);
    expect(stored.find((row) => row.id === entry.id)).toMatchObject({
      deleted_at_epoch_ms: null,
      display_name: 'My custom bench',
      equipment: 'dumbbell',
      is_favorite: 1,
      logging_mode: 'external-load-and-repetitions',
      normalized_name: 'my custom bench',
      notes: 'Added a spotter',
      originating_device_id: deviceId,
      primary_muscle_group: 'shoulders',
      revision: 4,
    });
    const queued = await database.getFirst<{
      operation: string;
      revision: number;
    }>(
      'SELECT operation, revision FROM sync_outbox WHERE table_name = ? AND row_id = ?',
      ['exercise_catalog_item', entry.id],
    );
    expect(queued).toEqual({ operation: 'upsert', revision: 4 });
  });

  it('rolls back every write in the batch, leaving the deletion intact, when a restore fails', async () => {
    const [first, second, third] = starterExercises;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error('Invalid fixture');
    await new AddStarterExercisesUseCase(runner, [first]).execute();
    await new DeleteExerciseUseCase(catalog).execute(first.id);
    const before = await rows();
    observed.failOnRestoreIndex = 1;

    // `second` and `third` are genuinely new and insert first; `first` is the
    // previously deleted one and resurrects last, so its failure has to
    // unwind insertions that already succeeded earlier in this transaction.
    const outcome = await new AddStarterExercisesUseCase(runner, [
      second,
      third,
      first,
    ]).execute();

    expect(outcome).toEqual({ reason: 'write-failed', status: 'refused' });
    expect(await rows()).toEqual(before);
  });

  it('keeps a session snapshot after the imported definition is deleted', async () => {
    const entry = starterExercises[0];
    if (entry === undefined) throw new Error('Invalid fixture');
    const history = await SyntheticWorkoutHistory.create();

    try {
      const historyCatalog = new ExerciseCatalogSqliteRepository(
        history.database,
        deviceId,
        now,
      );
      await new AddStarterExercisesUseCase(
        new SqliteTransactionRunner<StarterExerciseImportContext>(
          history.database,
          (transaction) => ({
            catalog: new ExerciseCatalogSqliteRepository(
              transaction,
              deviceId,
              now,
            ),
          }),
        ),
      ).execute();
      await history.store({
        dayIndex: 0,
        exercises: [
          {
            definitionId: entry.id,
            loggingMode: 'repetitions',
            name: entry.name,
            sets: [{ repetitions: 10 }],
          },
        ],
        name: 'Imported workout',
      });

      const deleted = await new DeleteExerciseUseCase(historyCatalog).execute(
        entry.id,
      );
      const snapshot = await history.database.getFirst<{
        exercise_name_snapshot: string;
        source_exercise_definition_id: string;
      }>('SELECT * FROM workout_session_exercise');

      expect(deleted).toEqual({ status: 'deleted' });
      expect(snapshot?.exercise_name_snapshot).toBe(entry.name);
      expect(snapshot?.source_exercise_definition_id).toBe(entry.id);
    } finally {
      history.close();
    }
  });

  /**
   * The whole reason this is an explicit act rather than a seed. An
   * installation stays restorable until the person asks for content, and once
   * they have asked it is indistinguishable from one they typed themselves.
   */
  it('leaves an installation that has not imported holding nothing', async () => {
    expect(
      await new ExerciseCatalogStoredDataProbe(database).hasStoredRecords(),
    ).toBe(false);
  });

  it('reads as holding records once imported, exactly as a hand-authored one does', async () => {
    const probe = new ExerciseCatalogStoredDataProbe(database);
    await catalog.insert(
      authored('11111111-1111-4111-8111-111111111111', 'Authored movement'),
    );
    const afterAuthoring = await probe.hasStoredRecords();

    await new ExerciseCatalogDataEraser(database).eraseStoredRecords();
    await useCase.execute();

    expect(afterAuthoring).toBe(true);
    expect(await probe.hasStoredRecords()).toBe(true);
  });

  it('lets erasure remove imported definitions like any other row', async () => {
    await useCase.execute();

    await new ExerciseCatalogDataEraser(database).eraseStoredRecords();

    expect(await rows()).toHaveLength(0);
    expect(
      await new ExerciseCatalogStoredDataProbe(database).hasStoredRecords(),
    ).toBe(false);
  });

  it('exports imported definitions as ordinary catalog rows', async () => {
    await useCase.execute();

    const page = await new ExerciseCatalogExportSqliteReader(
      database,
    ).listExercisesPage({ limit: starterExercises.length + 1 });

    expect(page.items).toHaveLength(starterExercises.length);
    expect(page.items.every((item) => !item.isFavorite)).toBe(true);
  });
});
