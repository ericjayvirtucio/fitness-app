import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { NutritionExportSqliteReader } from './nutrition-export-sqlite-reader';

class FakeDatabase implements DatabaseConnection {
  rows: readonly unknown[] = [];
  error: Error | undefined;
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
    if (this.error) return Promise.reject(this.error);
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

const entryRow = {
  carbohydrate_grams: 60.1,
  consumed_amount: 60,
  description: 'E2E oats',
  energy_kilojoules: 1_570,
  entry_kind: 'food',
  fat_grams: 6.9,
  fiber_grams: null,
  id: '123e4567-e89b-42d3-a456-426614174000',
  local_calendar_date: '2026-08-04',
  occurred_at_epoch_ms: Date.UTC(2026, 7, 4, 4),
  protein_grams: 13.2,
  provenance: 'provided',
  reference_amount: 100,
  reference_kind: 'mass',
  sodium_milligrams: null,
  sugar_grams: null,
  utc_offset_minutes: 480,
};

const catalogRow = {
  carbohydrate_grams: null,
  display_name: 'E2E Milk',
  energy_kilojoules: 640,
  fat_grams: null,
  fiber_grams: null,
  id: '223e4567-e89b-42d3-a456-426614174000',
  is_favorite: 1,
  item_kind: 'beverage',
  last_used_at_epoch_ms: Date.UTC(2026, 7, 4, 5),
  normalized_name: 'e2e milk',
  protein_grams: null,
  provenance: 'provided',
  reference_amount: 250,
  reference_kind: 'volume',
  sodium_milligrams: null,
  sugar_grams: null,
  use_count: 3,
};

describe('NutritionExportSqliteReader', () => {
  it('reads entries in ascending export order without an offset', async () => {
    const database = new FakeDatabase();
    database.rows = [entryRow];
    const reader = new NutritionExportSqliteReader(database);

    await reader.listEntriesPage({ limit: 200 });

    const query = database.queries[0];
    expect(query?.statement).toContain(
      'ORDER BY local_calendar_date ASC, occurred_at_epoch_ms ASC, id ASC',
    );
    expect(query?.statement).not.toContain('OFFSET');
    expect(query?.statement).toContain('WHERE deleted_at_epoch_ms IS NULL');
    expect(query?.parameters).toEqual([201]);
  });

  it('resumes entries from the cursor with bound parameters', async () => {
    const database = new FakeDatabase();
    const reader = new NutritionExportSqliteReader(database);

    await reader.listEntriesPage({
      cursor: {
        id: 'cursor-id',
        localCalendarDate: '2026-08-04',
        occurredAtEpochMilliseconds: 42,
      },
      limit: 2,
    });

    expect(database.queries[0]?.parameters).toEqual([
      '2026-08-04',
      '2026-08-04',
      42,
      '2026-08-04',
      42,
      'cursor-id',
      3,
    ]);
  });

  it('preserves canonical values and keeps unknown nutrients unknown', async () => {
    const database = new FakeDatabase();
    database.rows = [entryRow];
    const reader = new NutritionExportSqliteReader(database);

    const page = await reader.listEntriesPage({ limit: 200 });

    const entry = page.items[0];
    expect(entry?.facts.energy.kilojoules).toBe(1_570);
    expect(entry?.facts.nutrients.proteinGrams).toBe(13.2);
    expect(entry?.facts.nutrients.fiberGrams).toBeNull();
    expect(entry?.facts.nutrients.sodiumMilligrams).toBeNull();
    expect(entry?.localCalendarDate).toBe('2026-08-04');
    expect(entry?.utcOffsetMinutes).toBe(480);
  });

  it('reports a further page only when the look-ahead row exists', async () => {
    const database = new FakeDatabase();
    database.rows = [entryRow, { ...entryRow, id: 'b' }];
    const reader = new NutritionExportSqliteReader(database);

    const page = await reader.listEntriesPage({ limit: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toEqual({
      id: entryRow.id,
      localCalendarDate: '2026-08-04',
      occurredAtEpochMilliseconds: entryRow.occurred_at_epoch_ms,
    });
  });

  it('ends paging when no look-ahead row exists', async () => {
    const database = new FakeDatabase();
    database.rows = [entryRow];
    const reader = new NutritionExportSqliteReader(database);

    expect((await reader.listEntriesPage({ limit: 1 })).nextCursor).toBeNull();
  });

  it('reads catalog items in ascending name order with usage state', async () => {
    const database = new FakeDatabase();
    database.rows = [catalogRow];
    const reader = new NutritionExportSqliteReader(database);

    const page = await reader.listCatalogItemsPage({ limit: 200 });

    expect(database.queries[0]?.statement).toContain(
      'ORDER BY normalized_name ASC, id ASC',
    );
    expect(page.items[0]?.isFavorite).toBe(true);
    expect(page.items[0]?.usage.useCount).toBe(3);
  });

  it('translates a corrupt row into a safe persistence error', async () => {
    const database = new FakeDatabase();
    database.rows = [{ ...entryRow, id: 'not-a-uuid' }];
    const reader = new NutritionExportSqliteReader(database);

    await expect(reader.listEntriesPage({ limit: 200 })).rejects.toThrow(
      PersistenceError,
    );
    await expect(reader.listEntriesPage({ limit: 200 })).rejects.toThrow(
      'The local storage operation failed.',
    );
  });
});
