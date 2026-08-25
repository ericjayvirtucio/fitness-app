import { DomainId, ExerciseDefinition } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import { ExerciseCatalogSqliteRepository } from './exercise-catalog-sqlite-repository';

const deviceId = 'device-a';
const now = () => new Date('2026-08-02T00:00:00.000Z');

class FakeDatabase implements DatabaseConnection {
  row: unknown = null;
  rows: readonly unknown[] = [];
  error?: Error;
  reads: { parameters: DatabaseParameters; statement: string }[] = [];
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
  getAll<TResult>(statement: string, parameters: DatabaseParameters = []) {
    if (this.error) return Promise.reject(this.error);
    this.reads.push({ parameters, statement });
    return Promise.resolve(this.rows as readonly TResult[]);
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
    const repository = new ExerciseCatalogSqliteRepository(
      database,
      deviceId,
      now,
    );
    await expect(
      repository.getById(item().definition.id),
    ).resolves.toMatchObject({ definition: { name: 'Bench Press' } });
    await expect(
      repository.getByIds([item().definition.id]),
    ).resolves.toHaveLength(1);
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
      now().getTime(),
      deviceId,
    ]);
    expect(
      database.runs.some((run) => run.statement.startsWith('DELETE FROM')),
    ).toBe(false);
    expect(
      database.runs.some(
        (run) =>
          run.statement.includes('UPDATE exercise_catalog_item') &&
          run.statement.includes('deleted_at_epoch_ms = ?'),
      ),
    ).toBe(true);
  });

  it('escapes wildcard search and uses deterministic ordering', async () => {
    const database = new FakeDatabase();
    await new ExerciseCatalogSqliteRepository(database, deviceId, now).search(
      '100%_\\',
      50,
    );
    expect(database.rows).toEqual([]);
  });

  it('issues the statements it always has when nothing is narrowed', async () => {
    const database = new FakeDatabase();
    const repository = new ExerciseCatalogSqliteRepository(
      database,
      deviceId,
      now,
    );
    await repository.listAll(100);
    await repository.search('bench', 50);

    expect(database.reads[0]).toEqual({
      parameters: [100],
      statement:
        'SELECT id, display_name, normalized_name, equipment, primary_muscle_group, logging_mode, notes, is_favorite FROM exercise_catalog_item ORDER BY normalized_name ASC, id ASC LIMIT ?',
    });
    expect(database.reads[1]).toEqual({
      parameters: ['%bench%', 50],
      statement:
        "SELECT id, display_name, normalized_name, equipment, primary_muscle_group, logging_mode, notes, is_favorite FROM exercise_catalog_item WHERE normalized_name LIKE ? ESCAPE '\\' ORDER BY is_favorite DESC, normalized_name ASC, id ASC LIMIT ?",
    });
  });

  it('binds every narrowed value and interpolates none of them', async () => {
    const database = new FakeDatabase();
    const repository = new ExerciseCatalogSqliteRepository(
      database,
      deviceId,
      now,
    );
    await repository.listAll(100, {
      equipment: 'dumbbell',
      primaryMuscleGroup: 'chest',
    });
    await repository.search('press', 50, {
      equipment: 'dumbbell',
      primaryMuscleGroup: null,
    });

    expect(database.reads).toHaveLength(2);
    expect(database.reads[0]?.statement).toBe(
      'SELECT id, display_name, normalized_name, equipment, primary_muscle_group, logging_mode, notes, is_favorite FROM exercise_catalog_item WHERE equipment = ? AND primary_muscle_group = ? ORDER BY normalized_name ASC, id ASC LIMIT ?',
    );
    expect(database.reads[0]?.parameters).toEqual(['dumbbell', 'chest', 100]);
    expect(database.reads[1]?.statement).toBe(
      "SELECT id, display_name, normalized_name, equipment, primary_muscle_group, logging_mode, notes, is_favorite FROM exercise_catalog_item WHERE normalized_name LIKE ? ESCAPE '\\' AND equipment = ? ORDER BY is_favorite DESC, normalized_name ASC, id ASC LIMIT ?",
    );
    expect(database.reads[1]?.parameters).toEqual(['%press%', 'dumbbell', 50]);
    for (const read of database.reads) {
      expect(read.statement).not.toContain('dumbbell');
      expect(read.statement).not.toContain('chest');
      expect(read.statement).not.toContain('press');
    }
  });

  it('narrows in one query rather than reading and filtering afterwards', async () => {
    const database = new FakeDatabase();
    database.rows = [row];
    await new ExerciseCatalogSqliteRepository(database, deviceId, now).listAll(
      100,
      {
        equipment: 'barbell',
        primaryMuscleGroup: 'chest',
      },
    );
    expect(database.reads).toHaveLength(1);
    expect(database.runs).toEqual([]);
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
      new ExerciseCatalogSqliteRepository(database, deviceId, now).getById(
        item().definition.id,
      ),
    ).rejects.toMatchObject({ code: 'operation-failed' });
  });

  it('does nothing when the identifier is not a tombstoned row', async () => {
    const database = new FakeDatabase();
    database.row = null;

    const restored = await new ExerciseCatalogSqliteRepository(
      database,
      deviceId,
      now,
    ).restore(item().definition.id);

    expect(restored).toBe(false);
    expect(database.runs).toEqual([]);
  });

  it('undeletes a tombstoned row, bumps its revision, and queues an outbox upsert without touching its stored fields', async () => {
    const database = new FakeDatabase();
    // One row shape answers both `getFirst` calls this makes: the existence
    // check only reads `id`, and the revision lookup inside `queueRevision`
    // only reads `revision`.
    database.row = { id: row.id, revision: 5 };

    const restored = await new ExerciseCatalogSqliteRepository(
      database,
      deviceId,
      now,
    ).restore(item().definition.id);

    expect(restored).toBe(true);
    const undelete = database.runs.find((run) =>
      run.statement.includes('deleted_at_epoch_ms = NULL'),
    );
    expect(undelete?.statement).not.toMatch(/display_name|is_favorite/);
    expect(undelete?.parameters).toEqual([now().getTime(), row.id]);
    const queued = database.runs.find((run) =>
      run.statement.includes('sync_outbox'),
    );
    expect(queued?.parameters).toEqual([
      'exercise_catalog_item',
      row.id,
      'upsert',
      5,
      now().getTime(),
    ]);
  });

  it('translates driver failures without exposing details', async () => {
    const database = new FakeDatabase();
    database.error = new Error('sensitive exercise name and SQL');
    await expect(
      new ExerciseCatalogSqliteRepository(database, deviceId, now).insert(
        item(),
      ),
    ).rejects.toMatchObject({
      code: 'operation-failed',
      message: 'The local storage operation failed.',
    });
    await expect(
      new ExerciseCatalogSqliteRepository(database, deviceId, now).restore(
        item().definition.id,
      ),
    ).rejects.toMatchObject({
      code: 'operation-failed',
      message: 'The local storage operation failed.',
    });
  });
});
