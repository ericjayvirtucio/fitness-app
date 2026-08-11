import { BodyWeightEntry, DomainId, Mass, isErr } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { migrations } from '../../../infrastructure/persistence/migrations';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { BodyWeightEntrySqliteRepository } from './body-weight-entry-sqlite-repository';
import { BodyWeightProgressSqliteReader } from './body-weight-progress-sqlite-reader';

class FakeDatabase implements DatabaseConnection {
  row: unknown = null;
  rows: readonly unknown[] = [];
  error: Error | undefined;
  readonly queries: { parameters: DatabaseParameters; statement: string }[] =
    [];
  readonly runs: { parameters: DatabaseParameters; statement: string }[] = [];

  exec(statement: string): Promise<void> {
    this.runs.push({ parameters: [], statement });
    return Promise.resolve();
  }
  getFirst<TResult>(
    statement: string,
    parameters: DatabaseParameters = [],
  ): Promise<TResult | null> {
    if (this.error) return Promise.reject(this.error);
    this.queries.push({ parameters, statement });
    return Promise.resolve(this.row as TResult | null);
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
  run(statement: string, parameters: DatabaseParameters = []): Promise<void> {
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

type StoredRow = Readonly<{
  id: string;
  local_calendar_date: string;
  mass_grams: number;
  note: string | null;
  occurred_at_epoch_ms: number;
  utc_offset_minutes: number;
}>;

const row: StoredRow = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  local_calendar_date: '2026-08-04',
  mass_grams: 82_400,
  note: 'Morning',
  occurred_at_epoch_ms: Date.UTC(2026, 7, 4, 4),
  utc_offset_minutes: 480,
};

function rowWith(overrides: Partial<StoredRow>): StoredRow {
  return { ...row, ...overrides };
}

function entry(): BodyWeightEntry {
  const id = DomainId.create(row.id);
  const mass = Mass.create(row.mass_grams, 'gram');
  if (isErr(id) || isErr(mass)) throw new Error('Invalid fixture');
  const created = BodyWeightEntry.create({
    id: id.value,
    localCalendarDate: row.local_calendar_date,
    mass: mass.value,
    note: row.note,
    occurredAtEpochMilliseconds: row.occurred_at_epoch_ms,
    utcOffsetMinutes: row.utc_offset_minutes,
  });
  if (isErr(created)) throw new Error('Invalid fixture');
  return created.value;
}

describe('body weight persistence', () => {
  it('creates the forward-only table and one ordered index', async () => {
    const migration = migrations.at(-1);
    if (!migration) throw new Error('Missing migration');
    expect(migration).toMatchObject({
      description: 'Add historical body weight check-ins.',
      version: 11,
    });
    const database = new FakeDatabase();

    await migration.up(database);

    const statements = database.runs.map(({ statement }) => statement);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('CREATE TABLE body_weight_entry');
    expect(statements[0]).toContain('mass_grams >= 2000');
    expect(statements[0]).toContain('utc_offset_minutes BETWEEN -840 AND 840');
    expect(statements[1]).toContain(
      'CREATE INDEX body_weight_entry_local_date_occurred_at',
    );
  });

  it('reconstructs a stored row through the domain', async () => {
    const database = new FakeDatabase();
    database.row = row;
    const repository = new BodyWeightEntrySqliteRepository(database);

    const found = await repository.getById(entry().id);

    expect(found?.mass.grams).toBe(82_400);
    expect(found?.note).toBe('Morning');
    expect(found?.localCalendarDate).toBe('2026-08-04');
  });

  it('reads the latest check-in with the indexed ordering', async () => {
    const database = new FakeDatabase();
    database.row = row;

    await new BodyWeightEntrySqliteRepository(database).getLatest();

    expect(database.queries[0]?.statement).toContain(
      'ORDER BY local_calendar_date DESC',
    );
    expect(database.queries[0]?.statement).toContain('LIMIT 1');
  });

  it('writes canonical grams through bound parameters', async () => {
    const database = new FakeDatabase();
    const repository = new BodyWeightEntrySqliteRepository(database);

    await repository.insert(entry());

    expect(database.runs[0]?.statement).toContain(
      'INSERT INTO body_weight_entry',
    );
    expect(database.runs[0]?.parameters).toEqual([
      row.id,
      82_400,
      'Morning',
      row.occurred_at_epoch_ms,
      '2026-08-04',
      480,
    ]);
  });

  it('updates and deletes only existing check-ins', async () => {
    const database = new FakeDatabase();
    const repository = new BodyWeightEntrySqliteRepository(database);

    await expect(repository.update(entry())).resolves.toBe(false);
    await expect(repository.delete(entry().id)).resolves.toBe(false);

    database.row = row;
    await expect(repository.update(entry())).resolves.toBe(true);
    await expect(repository.delete(entry().id)).resolves.toBe(true);
    expect(database.runs.at(-1)?.parameters).toEqual([row.id]);
  });

  it('pages history without loading lifetime rows', async () => {
    const database = new FakeDatabase();
    database.rows = [
      row,
      rowWith({ id: '223e4567-e89b-42d3-a456-426614174000' }),
      rowWith({ id: '323e4567-e89b-42d3-a456-426614174000' }),
    ];
    const repository = new BodyWeightEntrySqliteRepository(database);

    const page = await repository.listPage({ limit: 2 });

    expect(page.items).toHaveLength(2);
    expect(database.queries[0]?.parameters).toEqual([3]);
    expect(page.nextCursor).toEqual({
      id: '223e4567-e89b-42d3-a456-426614174000',
      localCalendarDate: '2026-08-04',
      occurredAtEpochMilliseconds: row.occurred_at_epoch_ms,
    });
  });

  it('binds a keyset cursor and reports the final page', async () => {
    const database = new FakeDatabase();
    database.rows = [row];
    const repository = new BodyWeightEntrySqliteRepository(database);

    const page = await repository.listPage({
      cursor: {
        id: '923e4567-e89b-42d3-a456-426614174000',
        localCalendarDate: '2026-08-09',
        occurredAtEpochMilliseconds: Date.UTC(2026, 7, 9, 4),
      },
      limit: 2,
    });

    expect(page.nextCursor).toBeNull();
    expect(database.queries[0]?.statement).toContain('local_calendar_date < ?');
    expect(database.queries[0]?.parameters).toEqual([
      '2026-08-09',
      '2026-08-09',
      Date.UTC(2026, 7, 9, 4),
      '2026-08-09',
      Date.UTC(2026, 7, 9, 4),
      '923e4567-e89b-42d3-a456-426614174000',
      3,
    ]);
  });

  it('rejects a corrupt row without leaking its values', async () => {
    const database = new FakeDatabase();
    database.row = { ...row, mass_grams: -5 };
    const repository = new BodyWeightEntrySqliteRepository(database);

    await expect(repository.getById(entry().id)).rejects.toThrow(
      PersistenceError,
    );
    await expect(repository.getById(entry().id)).rejects.not.toThrow('-5');
  });

  it('translates database failures into safe persistence errors', async () => {
    const database = new FakeDatabase();
    database.error = new Error('disk image is malformed');
    const repository = new BodyWeightEntrySqliteRepository(database);

    await expect(repository.getById(entry().id)).rejects.toMatchObject({
      code: 'operation-failed',
    });
  });

  it('summarizes a bounded range and reports recorded change', async () => {
    const database = new FakeDatabase();
    database.row = {
      entry_count: 2,
      first_local_calendar_date: '2026-08-01',
      first_mass_grams: 83_000,
      latest_local_calendar_date: '2026-08-09',
      latest_mass_grams: 81_800,
    };

    const summary = await new BodyWeightProgressSqliteReader(
      database,
    ).summarizeRange({
      endLocalCalendarDate: '2026-08-31',
      startLocalCalendarDate: '2026-08-01',
    });

    expect(summary).toEqual({
      changeGrams: -1_200,
      entryCount: 2,
      firstGrams: 83_000,
      firstLocalCalendarDate: '2026-08-01',
      latestGrams: 81_800,
      latestLocalCalendarDate: '2026-08-09',
    });
    expect(database.queries[0]?.parameters).toEqual([
      '2026-08-01',
      '2026-08-31',
      '2026-08-01',
      '2026-08-31',
      '2026-08-01',
      '2026-08-31',
    ]);
  });

  it('omits change when the period holds a single check-in', async () => {
    const database = new FakeDatabase();
    database.row = {
      entry_count: 1,
      first_local_calendar_date: '2026-08-04',
      first_mass_grams: 82_400,
      latest_local_calendar_date: '2026-08-04',
      latest_mass_grams: 82_400,
    };

    const summary = await new BodyWeightProgressSqliteReader(
      database,
    ).summarizeRange({
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    });

    expect(summary?.changeGrams).toBeNull();
    expect(summary?.entryCount).toBe(1);
  });

  it('reports no data rather than zero for an empty period', async () => {
    const database = new FakeDatabase();

    await expect(
      new BodyWeightProgressSqliteReader(database).summarizeRange({
        endLocalCalendarDate: '2026-07-31',
        startLocalCalendarDate: '2026-07-01',
      }),
    ).resolves.toBeNull();
  });
});
