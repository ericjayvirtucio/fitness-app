import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { HydrationProgressSqliteReader } from './hydration-progress-sqlite-reader';

describe('HydrationProgressSqliteReader', () => {
  it('groups plain and other fluid by captured local date', async () => {
    const database = new FakeDatabase();
    database.rows = [
      {
        entry_count: 2,
        local_calendar_date: '2026-08-02',
        other_fluid_milliliters: 250,
        plain_water_milliliters: 500,
        total_fluid_milliliters: 750,
      },
    ];
    await expect(
      new HydrationProgressSqliteReader(database).summarizeRange({
        endLocalCalendarDate: '2026-08-08',
        startLocalCalendarDate: '2026-08-02',
      }),
    ).resolves.toEqual([
      {
        entryCount: 2,
        localCalendarDate: '2026-08-02',
        otherFluidMilliliters: 250,
        plainWaterMilliliters: 500,
        totalFluidMilliliters: 750,
      },
    ]);
    expect(database.parameters).toEqual(['2026-08-02', '2026-08-08']);
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
