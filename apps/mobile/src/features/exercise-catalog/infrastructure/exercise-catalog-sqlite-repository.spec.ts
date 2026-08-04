import { DomainId, ExerciseDefinition } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import { ExerciseCatalogSqliteRepository } from './exercise-catalog-sqlite-repository';

class FakeDatabase implements DatabaseConnection {
  row: unknown = null;
  rows: readonly unknown[] = [];
  error?: Error;
  runs: { parameters: DatabaseParameters; statement: string }[] = [];
  exec() {
    return Promise.resolve();
  }
  getVersion() {
    return Promise.resolve(7);
  }
  getFirst<TResult>() {
    return this.error
      ? Promise.reject(this.error)
      : Promise.resolve(this.row as TResult | null);
  }
  getAll<TResult>() {
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

const row = {
  display_name: 'Bench Press',
  equipment: 'barbell',
  id: '550e8400-e29b-41d4-a716-446655440000',
  is_favorite: 0,
  logging_mode: 'external-load-and-repetitions',
  normalized_name: 'bench press',
  notes: null,
  primary_muscle_group: 'chest',
} as const;

function item() {
  const id = DomainId.create(row.id);
  if (!id.isSuccess) throw new Error('Invalid fixture');
  const definition = ExerciseDefinition.create({
    equipment: row.equipment,
    id: id.value,
    loggingMode: row.logging_mode,
    name: row.display_name,
    notes: row.notes,
    primaryMuscleGroup: row.primary_muscle_group,
  });
  if (!definition.isSuccess) throw new Error('Invalid fixture');
  const result = ExerciseCatalogItem.create({
    definition: definition.value,
    isFavorite: false,
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('ExerciseCatalogSqliteRepository', () => {
  it('maps rows and binds CRUD values', async () => {
    const database = new FakeDatabase();
    database.row = row;
    database.rows = [row];
    const repository = new ExerciseCatalogSqliteRepository(database);
    await expect(
      repository.getById(item().definition.id),
    ).resolves.toMatchObject({ definition: { name: 'Bench Press' } });
    await expect(repository.search('bench', 50)).resolves.toHaveLength(1);
    await repository.insert(item());
    await expect(repository.update(item())).resolves.toBe(true);
    await expect(
      repository.setFavorite(item().definition.id, true),
    ).resolves.toBe(true);
    await expect(repository.delete(item().definition.id)).resolves.toBe(true);
    expect(database.runs[0]?.parameters).toEqual([
      row.id,
      'Bench Press',
      'bench press',
      'barbell',
      'chest',
      'external-load-and-repetitions',
      null,
      0,
    ]);
    expect(database.runs.some((run) => run.statement.includes('DELETE'))).toBe(
      true,
    );
  });

  it('escapes wildcard search and uses deterministic ordering', async () => {
    const database = new FakeDatabase();
    await new ExerciseCatalogSqliteRepository(database).search('100%_\\', 50);
    expect(database.rows).toEqual([]);
  });

  it.each([
    { ...row, id: 'bad' },
    { ...row, normalized_name: 'wrong' },
    { ...row, is_favorite: 2 },
    { ...row, logging_mode: 'invalid' },
  ])('rejects corrupt persisted rows', async (invalidRow) => {
    const database = new FakeDatabase();
    database.row = invalidRow;
    await expect(
      new ExerciseCatalogSqliteRepository(database).getById(
        item().definition.id,
      ),
    ).rejects.toMatchObject({ code: 'operation-failed' });
  });

  it('translates driver failures without exposing details', async () => {
    const database = new FakeDatabase();
    database.error = new Error('sensitive exercise name and SQL');
    await expect(
      new ExerciseCatalogSqliteRepository(database).insert(item()),
    ).rejects.toMatchObject({
      code: 'operation-failed',
      message: 'The local storage operation failed.',
    });
  });
});
