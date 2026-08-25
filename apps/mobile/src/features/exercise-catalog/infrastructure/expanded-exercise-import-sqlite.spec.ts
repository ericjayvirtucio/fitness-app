import { DomainId, isErr } from '@fitness/domain';
import { initializeDatabase } from '../../../infrastructure/persistence/database-initializer';
import { migrations } from '../../../infrastructure/persistence/migrations';
import { SqliteTransactionRunner } from '../../../infrastructure/persistence/sqlite-transaction-runner';
import { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { AddStarterExercisesUseCase } from '../application/add-starter-exercises-use-case';
import { DeleteExerciseUseCase } from '../application/exercise-catalog-use-cases';
import { expandedExercises } from '../application/expanded-exercises';
import type { StarterExerciseImportContext } from '../application/starter-exercise-import-context';
import { starterExercises } from '../application/starter-exercises';
import { ExerciseCatalogDataEraser } from './exercise-catalog-data-eraser';
import { ExerciseCatalogExportSqliteReader } from './exercise-catalog-export-sqlite-reader';
import { ExerciseCatalogSqliteRepository } from './exercise-catalog-sqlite-repository';

const deviceId = 'device-a';
const now = () => new Date();

/**
 * The expanded pack reuses `AddStarterExercisesUseCase` exactly as
 * Specification 0027 built it, parametrized with different content, so its
 * general import mechanics — validate-then-transact, skip on matching
 * identifier or name, roll back atomically on a failed write — are already
 * proven by `starter-exercise-import-sqlite.spec.ts` against the starter
 * content. What is specific to the expanded pack, and therefore what belongs
 * here, is its relationship to the starter set it is offered alongside: that
 * both can be imported into the same catalog without collision, and what
 * happens when a person deletes an entry the expanded import wrote and then
 * imports again.
 */
describe('Expanded exercise import on a real database', () => {
  let database: NodeSqliteDatabase;
  let catalog: ExerciseCatalogSqliteRepository;
  let starterUseCase: AddStarterExercisesUseCase;
  let expandedUseCase: AddStarterExercisesUseCase;

  beforeEach(async () => {
    database = new NodeSqliteDatabase();
    await initializeDatabase(database, migrations);
    catalog = new ExerciseCatalogSqliteRepository(database, deviceId, now);
    const runner = new SqliteTransactionRunner<StarterExerciseImportContext>(
      database,
      (transaction) => ({
        catalog: new ExerciseCatalogSqliteRepository(
          transaction,
          deviceId,
          now,
        ),
      }),
    );
    starterUseCase = new AddStarterExercisesUseCase(runner);
    expandedUseCase = new AddStarterExercisesUseCase(runner, expandedExercises);
  });

  afterEach(() => {
    database.close();
  });

  async function rowCount(): Promise<number> {
    const row = await database.getFirst<{ total: number }>(
      'SELECT COUNT(*) AS total FROM exercise_catalog_item',
    );
    return row?.total ?? 0;
  }

  it('writes every definition into an empty catalog', async () => {
    const outcome = await expandedUseCase.execute();

    expect(outcome).toEqual({
      addedCount: expandedExercises.length,
      skippedCount: 0,
      status: 'imported',
    });
    expect(await rowCount()).toBe(expandedExercises.length);
  });

  it('adds the full count of both packs when both are imported, in either order', async () => {
    await starterUseCase.execute();
    const outcome = await expandedUseCase.execute();

    expect(outcome).toEqual({
      addedCount: expandedExercises.length,
      skippedCount: 0,
      status: 'imported',
    });
    expect(await rowCount()).toBe(
      starterExercises.length + expandedExercises.length,
    );
  });

  it('adds nothing on a second import of the expanded pack', async () => {
    await expandedUseCase.execute();

    const outcome = await expandedUseCase.execute();

    expect(outcome).toEqual({
      skippedCount: expandedExercises.length,
      status: 'unchanged',
    });
    expect(await rowCount()).toBe(expandedExercises.length);
  });

  it('exports imported definitions from both packs as ordinary catalog rows', async () => {
    await starterUseCase.execute();
    await expandedUseCase.execute();

    const page = await new ExerciseCatalogExportSqliteReader(
      database,
    ).listExercisesPage({
      limit: starterExercises.length + expandedExercises.length + 1,
    });

    expect(page.items).toHaveLength(
      starterExercises.length + expandedExercises.length,
    );
  });

  it('lets erasure remove both packs together', async () => {
    await starterUseCase.execute();
    await expandedUseCase.execute();

    await new ExerciseCatalogDataEraser(database).eraseStoredRecords();

    expect(await rowCount()).toBe(0);
  });

  /**
   * The regression Specification 0043 recorded and left unresolved: a
   * deleted entry's row still physically exists (deletion is a tombstone,
   * not a hard delete), so re-importing it under the same identifier used to
   * collide with the primary key and refuse the whole transaction. The
   * import now resurrects a tombstoned identifier instead of inserting it
   * again. The mechanism is shared with the starter pack — full field,
   * revision, and outbox fidelity is proven against that content in
   * `starter-exercise-import-sqlite.spec.ts` — so what belongs here is only
   * confirming it resolves this way for the expanded pack too, per that
   * specification's note that the fix is "for both packs, not only this
   * one."
   */
  it('resurrects a deleted entry instead of refusing the import when it is repeated', async () => {
    await expandedUseCase.execute();
    const first = expandedExercises[0];
    if (first === undefined) throw new Error('Invalid fixture');
    const deleteUseCase = new DeleteExerciseUseCase(catalog);
    const deleted = await deleteUseCase.execute(first.id);
    expect(deleted).toEqual({ status: 'deleted' });

    const outcome = await expandedUseCase.execute();

    expect(outcome).toEqual({
      addedCount: 1,
      skippedCount: expandedExercises.length - 1,
      status: 'imported',
    });
    const id = DomainId.create(first.id);
    if (isErr(id)) throw new Error('Invalid fixture');
    expect(await catalog.getById(id.value)).toMatchObject({
      definition: { name: first.name },
    });
    expect(await rowCount()).toBe(expandedExercises.length);
  });
});
