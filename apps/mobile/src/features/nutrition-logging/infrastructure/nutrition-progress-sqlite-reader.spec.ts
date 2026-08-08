import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { NutritionProgressSqliteReader } from './nutrition-progress-sqlite-reader';

describe('NutritionProgressSqliteReader', () => {
  it('groups a bounded range and preserves incomplete nutrients', async () => {
    const database = new FakeDatabase();
    database.rows = [
      {
        carbohydrate_grams: 30,
        carbohydrate_known_count: 2,
        energy_kilojoules: 1_200,
        entry_count: 2,
        fat_grams: null,
        fat_known_count: 0,
        local_calendar_date: '2026-08-02',
        protein_grams: 10,
        protein_known_count: 1,
      },
    ];
    const result = await new NutritionProgressSqliteReader(
      database,
    ).summarizeRange({
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    });
    expect(database.parameters).toEqual(['2026-08-02', '2026-08-08']);
    expect(result[0]).toMatchObject({
      carbohydrate: { isComplete: true, totalGrams: 30 },
      fat: { isComplete: false, totalGrams: null },
      protein: { isComplete: false, totalGrams: null },
    });
  });
});

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
