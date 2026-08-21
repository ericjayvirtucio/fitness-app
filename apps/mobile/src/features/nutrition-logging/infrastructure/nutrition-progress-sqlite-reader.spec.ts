import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { NutritionProgressSqliteReader } from './nutrition-progress-sqlite-reader';

describe('NutritionProgressSqliteReader', () => {
  it('groups a bounded range and preserves incomplete nutrients', async () => {
    const database = new FakeDatabase();
    database.rows = [
      row({
        carbohydrate_grams: 30,
        carbohydrate_known_count: 2,
        fat_grams: null,
        fat_known_count: 0,
        protein_grams: 10,
        protein_known_count: 1,
      }),
    ];
    const result = await new NutritionProgressSqliteReader(
      database,
    ).summarizeRange({
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    });
    expect(database.parameters).toEqual(['2026-08-02', '2026-08-08']);
    expect(result[0]).toMatchObject({
      carbohydrate: { total: 30 },
      fat: { total: null },
      protein: { total: null },
    });
  });

  it('sums every stored nutrient for a day, not only the three macronutrients', async () => {
    const database = new FakeDatabase();
    database.rows = [
      row({
        carbohydrate_grams: 40,
        carbohydrate_known_count: 2,
        fat_grams: 12,
        fat_known_count: 2,
        fiber_grams: 6,
        fiber_known_count: 2,
        protein_grams: 30,
        protein_known_count: 2,
        sodium_milligrams: 450,
        sodium_known_count: 2,
        sugar_grams: 9,
        sugar_known_count: 2,
      }),
    ];
    const [day] = await new NutritionProgressSqliteReader(
      database,
    ).summarizeRange({
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    });
    expect(day).toEqual({
      carbohydrate: { total: 40 },
      energyKilojoules: 1_200,
      entryCount: 2,
      fat: { total: 12 },
      fiber: { total: 6 },
      localCalendarDate: '2026-08-02',
      protein: { total: 30 },
      sodium: { total: 450 },
      sugar: { total: 9 },
    });
  });

  it('reports one omitted nutrient as unknown and leaves every other nutrient exact', async () => {
    const database = new FakeDatabase();
    database.rows = [
      row({
        carbohydrate_grams: 40,
        carbohydrate_known_count: 2,
        fat_grams: 12,
        fat_known_count: 2,
        // One of the two entries omitted fiber. Nothing else is affected.
        fiber_grams: 6,
        fiber_known_count: 1,
        protein_grams: 30,
        protein_known_count: 2,
        sodium_milligrams: 450,
        sodium_known_count: 2,
        sugar_grams: 9,
        sugar_known_count: 2,
      }),
    ];
    const [day] = await new NutritionProgressSqliteReader(
      database,
    ).summarizeRange({
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    });
    expect(day?.fiber).toEqual({ total: null });
    expect(day?.protein).toEqual({ total: 30 });
    expect(day?.carbohydrate).toEqual({ total: 40 });
    expect(day?.fat).toEqual({ total: 12 });
    expect(day?.sugar).toEqual({ total: 9 });
    expect(day?.sodium).toEqual({ total: 450 });
  });

  it('keeps a milligram sodium total distinct from the gram totals beside it', async () => {
    // Sodium is stored in milligrams and every other nutrient in grams, so the
    // magnitudes here are deliberately far apart. A reader that routed sodium
    // through a gram column, or a gram nutrient through the sodium column,
    // would swap these two numbers rather than fail to produce them.
    const database = new FakeDatabase();
    database.rows = [
      row({
        entry_count: 1,
        fiber_grams: 6,
        fiber_known_count: 1,
        sodium_milligrams: 2_300,
        sodium_known_count: 1,
      }),
    ];
    const [day] = await new NutritionProgressSqliteReader(
      database,
    ).summarizeRange({
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    });
    expect(day?.sodium.total).toBe(2_300);
    expect(day?.fiber.total).toBe(6);
  });

  it('rejects a corrupt sodium value through the existing safe message', async () => {
    // A negative milligram value fails through the same guard a negative gram
    // value already does, and surfaces the fixed sentence rather than SQL, a
    // column name, or the guard's own wording.
    const database = new FakeDatabase();
    database.rows = [
      row({ entry_count: 1, sodium_known_count: 1, sodium_milligrams: -1 }),
    ];
    await expect(
      new NutritionProgressSqliteReader(database).summarizeRange({
        endLocalCalendarDate: '2026-08-08',
        startLocalCalendarDate: '2026-08-02',
      }),
    ).rejects.toThrow('The local storage operation failed.');
  });
});

/**
 * A complete two-entry day whose nutrients are all unknown, so each test states
 * only the columns its claim is about.
 */
function row(overrides: Readonly<Record<string, number | null>>) {
  return {
    carbohydrate_grams: null,
    carbohydrate_known_count: 0,
    energy_kilojoules: 1_200,
    entry_count: 2,
    fat_grams: null,
    fat_known_count: 0,
    fiber_grams: null,
    fiber_known_count: 0,
    local_calendar_date: '2026-08-02',
    protein_grams: null,
    protein_known_count: 0,
    sodium_known_count: 0,
    sodium_milligrams: null,
    sugar_grams: null,
    sugar_known_count: 0,
    ...overrides,
  };
}

class FakeDatabase implements DatabaseConnection {
  rows: readonly unknown[] = [];
  parameters: DatabaseParameters = [];
  exec(): Promise<void> {
    return Promise.resolve();
  }
  getAll<TResult>(
    _statement: string,
    parameters: DatabaseParameters = [],
  ): Promise<readonly TResult[]> {
    this.parameters = parameters;
    return Promise.resolve(this.rows as readonly TResult[]);
  }
  getFirst<TResult>(): Promise<TResult | null> {
    return Promise.resolve(null);
  }
  getVersion(): Promise<number> {
    return Promise.resolve(10);
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
