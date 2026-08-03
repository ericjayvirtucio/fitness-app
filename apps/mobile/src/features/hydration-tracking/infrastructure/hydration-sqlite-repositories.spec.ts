import {
  DomainId,
  HydrationEntry,
  HydrationTarget,
  Volume,
} from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { HydrationEntrySqliteRepository } from './hydration-entry-sqlite-repository';
import { HydrationTargetSqliteRepository } from './hydration-target-sqlite-repository';

class FakeDatabase implements DatabaseConnection {
  row: unknown = null;
  rows: readonly unknown[] = [];
  error: Error | undefined;
  readonly runs: { parameters: DatabaseParameters; statement: string }[] = [];
  exec(): Promise<void> {
    return Promise.resolve();
  }
  getFirst<TResult>(): Promise<TResult | null> {
    if (this.error) return Promise.reject(this.error);
    return Promise.resolve(this.row as TResult | null);
  }
  getAll<TResult>(): Promise<readonly TResult[]> {
    if (this.error) return Promise.reject(this.error);
    return Promise.resolve(this.rows as readonly TResult[]);
  }
  getVersion(): Promise<number> {
    return Promise.resolve(6);
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

const row = {
  description: null,
  fluid_type: 'plain-water',
  id: '550e8400-e29b-41d4-a716-446655440000',
  local_calendar_date: '2026-08-04',
  occurred_at_epoch_ms: Date.UTC(2026, 7, 4, 4),
  utc_offset_minutes: 480,
  volume_milliliters: 500,
} as const;

function entry() {
  const id = DomainId.create(row.id);
  const volume = Volume.create(500, 'milliliter');
  if (!id.isSuccess || !volume.isSuccess) throw new Error('Invalid fixture');
  const result = HydrationEntry.create({
    description: null,
    fluidType: 'plain-water',
    id: id.value,
    localCalendarDate: row.local_calendar_date,
    occurredAtEpochMilliseconds: row.occurred_at_epoch_ms,
    utcOffsetMinutes: row.utc_offset_minutes,
    volume: volume.value,
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('Hydration SQLite repositories', () => {
  it('maps, queries, and writes entry rows with bound canonical values', async () => {
    const database = new FakeDatabase();
    database.row = row;
    database.rows = [row];
    const repository = new HydrationEntrySqliteRepository(database);
    await expect(repository.getById(entry().id)).resolves.toMatchObject({
      fluidType: 'plain-water',
    });
    await expect(
      repository.listByLocalDate('2026-08-04'),
    ).resolves.toHaveLength(1);
    await repository.insert(entry());
    await expect(repository.update(entry())).resolves.toBe(true);
    await expect(repository.delete(entry().id)).resolves.toBe(true);
    expect(database.runs[0]?.parameters).toEqual([
      row.id,
      'plain-water',
      500,
      null,
      row.occurred_at_epoch_ms,
      '2026-08-04',
      480,
    ]);
    expect(database.runs.some((run) => run.statement.includes('DELETE'))).toBe(
      true,
    );
  });

  it('rejects corrupt rows and translates driver errors safely', async () => {
    const database = new FakeDatabase();
    database.row = { ...row, volume_milliliters: -1 };
    const repository = new HydrationEntrySqliteRepository(database);
    await expect(repository.getById(entry().id)).rejects.toMatchObject({
      code: 'operation-failed',
    });
    database.error = new Error('sensitive hydration SQL');
    await expect(repository.insert(entry())).rejects.toMatchObject({
      code: 'operation-failed',
      message: 'The local storage operation failed.',
    });
  });

  it('reads and upserts the singleton target', async () => {
    const database = new FakeDatabase();
    const repository = new HydrationTargetSqliteRepository(database);
    await expect(repository.get()).resolves.toBeNull();
    database.row = { target_milliliters: 3_000 };
    await expect(repository.get()).resolves.toMatchObject({
      volume: { milliliters: 3_000 },
    });
    const volume = Volume.create(3_000, 'milliliter');
    if (!volume.isSuccess) throw new Error('Invalid fixture');
    const target = HydrationTarget.create(volume.value);
    if (!target.isSuccess) throw new Error('Invalid fixture');
    await repository.save(target.value);
    expect(database.runs[0]?.parameters).toEqual([1, 3_000]);
    expect(database.runs[0]?.statement).toContain('ON CONFLICT');
  });

  it('rejects a corrupt singleton target', async () => {
    const database = new FakeDatabase();
    database.row = { target_milliliters: 0 };
    await expect(
      new HydrationTargetSqliteRepository(database).get(),
    ).rejects.toMatchObject({ code: 'operation-failed' });
  });
});
