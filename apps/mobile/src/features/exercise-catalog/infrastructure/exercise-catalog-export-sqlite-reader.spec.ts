import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { ExerciseCatalogExportSqliteReader } from './exercise-catalog-export-sqlite-reader';

class FakeDatabase implements DatabaseConnection {
  rows: readonly unknown[] = [];
  readonly queries: { parameters: DatabaseParameters; statement: string }[] =
    [];

  exec(): Promise<void> {
    return Promise.resolve();
  }
  getFirst<TResult>(): Promise<TResult | null> {
    return Promise.resolve(null);
  }
  getAll<TResult>(
    statement: string,
    parameters: DatabaseParameters = [],
  ): Promise<readonly TResult[]> {
    this.queries.push({ parameters, statement });
    return Promise.resolve(this.rows as readonly TResult[]);
  }
  getVersion(): Promise<number> {
    return Promise.resolve(11);
  }
  run(): Promise<void> {
    return Promise.resolve();
  }
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

const row = {
  display_name: 'E2E Back Squat',
  equipment: 'barbell',
  id: '123e4567-e89b-42d3-a456-426614174000',
  is_favorite: 1,
  logging_mode: 'external-load-and-repetitions',
  normalized_name: 'e2e back squat',
  notes: null,
  primary_muscle_group: 'quadriceps',
};

describe('ExerciseCatalogExportSqliteReader', () => {
  it('reads existing definitions in ascending name order', async () => {
    const database = new FakeDatabase();
    database.rows = [row];
    const reader = new ExerciseCatalogExportSqliteReader(database);

    const page = await reader.listExercisesPage({ limit: 200 });

    expect(database.queries[0]?.statement).toContain(
      'ORDER BY normalized_name ASC, id ASC',
    );
    expect(page.items[0]?.definition.name).toBe('E2E Back Squat');
    expect(page.items[0]?.isFavorite).toBe(true);
  });

  it('reads only the catalog and never workout snapshots', async () => {
    const database = new FakeDatabase();
    const reader = new ExerciseCatalogExportSqliteReader(database);

    await reader.listExercisesPage({ limit: 200 });

    expect(database.queries[0]?.statement).toContain(
      'FROM exercise_catalog_item',
    );
    expect(database.queries[0]?.statement).not.toContain(
      'workout_session_exercise',
    );
  });

  it('resumes from the cursor with bound parameters', async () => {
    const database = new FakeDatabase();
    const reader = new ExerciseCatalogExportSqliteReader(database);

    await reader.listExercisesPage({
      cursor: { id: 'cursor-id', normalizedName: 'e2e back squat' },
      limit: 4,
    });

    expect(database.queries[0]?.parameters).toEqual([
      'e2e back squat',
      'e2e back squat',
      'cursor-id',
      5,
    ]);
  });

  it('translates a corrupt row into a safe persistence error', async () => {
    const database = new FakeDatabase();
    database.rows = [{ ...row, normalized_name: 'mismatched' }];
    const reader = new ExerciseCatalogExportSqliteReader(database);

    await expect(reader.listExercisesPage({ limit: 200 })).rejects.toThrow(
      PersistenceError,
    );
  });
});
