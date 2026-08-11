import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { BodyWeightExportSqliteReader } from './body-weight-export-sqlite-reader';

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
  id: '123e4567-e89b-42d3-a456-426614174000',
  local_calendar_date: '2026-08-04',
  mass_grams: 82_400,
  note: null,
  occurred_at_epoch_ms: Date.UTC(2026, 7, 4, 4),
  utc_offset_minutes: 480,
};

describe('BodyWeightExportSqliteReader', () => {
  it('reads recorded check-ins in ascending recorded order', async () => {
    const database = new FakeDatabase();
    database.rows = [row];
    const reader = new BodyWeightExportSqliteReader(database);

    const page = await reader.listCheckInsPage({ limit: 200 });

    expect(database.queries[0]?.statement).toContain(
      'ORDER BY local_calendar_date ASC, occurred_at_epoch_ms ASC, id ASC',
    );
    expect(page.items[0]?.mass.grams).toBe(82_400);
    expect(page.items[0]?.localCalendarDate).toBe('2026-08-04');
  });

  it('reads recorded check-ins and never the current profile weight', async () => {
    const database = new FakeDatabase();
    const reader = new BodyWeightExportSqliteReader(database);

    await reader.listCheckInsPage({ limit: 200 });

    expect(database.queries[0]?.statement).toContain('FROM body_weight_entry');
    expect(database.queries[0]?.statement).not.toContain('personal_profile');
  });

  it('resumes from the cursor with bound parameters', async () => {
    const database = new FakeDatabase();
    const reader = new BodyWeightExportSqliteReader(database);

    await reader.listCheckInsPage({
      cursor: {
        id: 'cursor-id',
        localCalendarDate: '2026-08-04',
        occurredAtEpochMilliseconds: 42,
      },
      limit: 3,
    });

    expect(database.queries[0]?.parameters).toEqual([
      '2026-08-04',
      '2026-08-04',
      42,
      '2026-08-04',
      42,
      'cursor-id',
      4,
    ]);
  });

  it('translates a corrupt row into a safe persistence error', async () => {
    const database = new FakeDatabase();
    database.rows = [{ ...row, mass_grams: 1 }];
    const reader = new BodyWeightExportSqliteReader(database);

    await expect(reader.listCheckInsPage({ limit: 200 })).rejects.toThrow(
      PersistenceError,
    );
  });
});
