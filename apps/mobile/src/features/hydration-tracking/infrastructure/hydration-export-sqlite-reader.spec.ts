import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { HydrationExportSqliteReader } from './hydration-export-sqlite-reader';

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
  description: null,
  fluid_type: 'plain-water',
  id: '123e4567-e89b-42d3-a456-426614174000',
  local_calendar_date: '2026-08-04',
  occurred_at_epoch_ms: Date.UTC(2026, 7, 4, 4),
  utc_offset_minutes: 480,
  volume_milliliters: 500,
};

describe('HydrationExportSqliteReader', () => {
  it('reads recorded entries in ascending export order', async () => {
    const database = new FakeDatabase();
    database.rows = [row];
    const reader = new HydrationExportSqliteReader(database);

    const page = await reader.listEntriesPage({ limit: 200 });

    expect(database.queries[0]?.statement).toContain(
      'ORDER BY local_calendar_date ASC, occurred_at_epoch_ms ASC, id ASC',
    );
    expect(page.items[0]?.volume.milliliters).toBe(500);
    expect(page.items[0]?.utcOffsetMinutes).toBe(480);
  });

  it('reads only hydration entries and never the daily target', async () => {
    const database = new FakeDatabase();
    const reader = new HydrationExportSqliteReader(database);

    await reader.listEntriesPage({ limit: 200 });

    expect(database.queries[0]?.statement).toContain('FROM hydration_entry');
    expect(database.queries[0]?.statement).not.toContain('hydration_target');
  });

  it('resumes from the cursor with bound parameters', async () => {
    const database = new FakeDatabase();
    const reader = new HydrationExportSqliteReader(database);

    await reader.listEntriesPage({
      cursor: {
        id: 'cursor-id',
        localCalendarDate: '2026-08-04',
        occurredAtEpochMilliseconds: 42,
      },
      limit: 5,
    });

    expect(database.queries[0]?.parameters).toEqual([
      '2026-08-04',
      '2026-08-04',
      42,
      '2026-08-04',
      42,
      'cursor-id',
      6,
    ]);
  });

  it('translates a corrupt row into a safe persistence error', async () => {
    const database = new FakeDatabase();
    database.rows = [{ ...row, volume_milliliters: -1 }];
    const reader = new HydrationExportSqliteReader(database);

    await expect(reader.listEntriesPage({ limit: 200 })).rejects.toThrow(
      PersistenceError,
    );
  });
});
