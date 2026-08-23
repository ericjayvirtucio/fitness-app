import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { buildConsumptionEntry } from '../application/build-consumption-entry';
import { ConsumptionEntrySqliteRepository } from './consumption-entry-sqlite-repository';

const deviceId = 'device-a';
const now = () => new Date('2026-08-02T00:00:00.000Z');

class FakeDatabase implements DatabaseConnection {
  rows: readonly unknown[] = [];
  firstRow: unknown = null;
  readonly runs: { parameters: DatabaseParameters; statement: string }[] = [];
  exec(): Promise<void> {
    return Promise.resolve();
  }
  getAll<TResult>(): Promise<readonly TResult[]> {
    return Promise.resolve(this.rows as readonly TResult[]);
  }
  getFirst<TResult>(): Promise<TResult | null> {
    return Promise.resolve(this.firstRow as TResult | null);
  }
  getVersion(): Promise<number> {
    return Promise.resolve(4);
  }
  run(statement: string, parameters: DatabaseParameters = []): Promise<void> {
    this.runs.push({ parameters, statement });
    return Promise.resolve();
  }
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

const storedRow = {
  carbohydrate_grams: 20,
  consumed_amount: 50,
  description: 'Oats',
  energy_kilojoules: 836.8,
  entry_kind: 'food',
  fat_grams: 4,
  fiber_grams: null,
  id: '550e8400-e29b-41d4-a716-446655440000',
  local_calendar_date: '2026-08-02',
  occurred_at_epoch_ms: Date.UTC(2026, 7, 2, 4),
  protein_grams: 8,
  provenance: 'provided',
  reference_amount: 100,
  reference_kind: 'mass',
  sodium_milligrams: 0,
  sugar_grams: 2,
  utc_offset_minutes: 480,
};

describe('ConsumptionEntrySqliteRepository', () => {
  it('reconstructs rows and preserves unknown versus zero', async () => {
    const database = new FakeDatabase();
    database.rows = [storedRow];
    const entries = await new ConsumptionEntrySqliteRepository(
      database,
      deviceId,
      now,
    ).listByLocalDate('2026-08-02');
    expect(entries[0]?.facts.nutrients.fiberGrams).toBeNull();
    expect(entries[0]?.facts.nutrients.sodiumMilligrams).toBe(0);
  });

  it('rejects a corrupt stored row safely', async () => {
    const database = new FakeDatabase();
    database.rows = [{ ...storedRow, reference_kind: 'serving' }];
    await expect(
      new ConsumptionEntrySqliteRepository(
        database,
        deviceId,
        now,
      ).listByLocalDate('2026-08-02'),
    ).rejects.toMatchObject({ code: 'operation-failed' });
  });

  it('inserts canonical values with bound parameters', async () => {
    const database = new FakeDatabase();
    const entry = buildConsumptionEntry(
      storedRow.id,
      {
        carbohydrateGrams: '20',
        consumedAmount: '50',
        description: 'Oats',
        energyKilocalories: '200',
        fatGrams: '4',
        fiberGrams: '',
        kind: 'food',
        localCalendarDate: '2026-08-02',
        occurredAtEpochMilliseconds: storedRow.occurred_at_epoch_ms,
        proteinGrams: '8',
        quantityKind: 'mass',
        referenceAmount: '100',
        sodiumMilligrams: '0',
        sugarGrams: '2',
        utcOffsetMinutes: 480,
      },
      storedRow.occurred_at_epoch_ms,
    );
    if (!entry.isSuccess) throw new Error('Invalid fixture.');
    await new ConsumptionEntrySqliteRepository(database, deviceId, now).insert(
      entry.value,
    );
    expect(database.runs[0]?.statement).toContain(
      'INSERT INTO nutrition_consumption_entry',
    );
    expect(database.runs[0]?.parameters).toEqual([
      storedRow.id,
      'food',
      'Oats',
      'mass',
      100,
      50,
      836.8000000000001,
      8,
      20,
      4,
      null,
      2,
      0,
      'provided',
      storedRow.occurred_at_epoch_ms,
      '2026-08-02',
      480,
      now().getTime(),
      deviceId,
    ]);
  });
});
