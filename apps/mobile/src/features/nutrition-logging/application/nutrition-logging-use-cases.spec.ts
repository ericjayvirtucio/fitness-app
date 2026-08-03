import type { ConsumptionEntry } from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { buildConsumptionEntry } from './build-consumption-entry';
import type {
  ConsumptionEntryRepository,
  ConsumptionEntryTransactionContext,
} from './consumption-entry-repository';
import { CreateConsumptionEntryUseCase } from './create-consumption-entry-use-case';
import { GetDailyNutritionUseCase } from './get-daily-nutrition-use-case';

const validInput = {
  carbohydrateGrams: '20',
  consumedAmount: '50',
  description: 'Oats',
  energyKilocalories: '200',
  fatGrams: '4',
  fiberGrams: '',
  kind: 'food',
  localCalendarDate: '2026-08-02',
  occurredAtEpochMilliseconds: Date.UTC(2026, 7, 2, 4),
  proteinGrams: '8',
  quantityKind: 'mass',
  referenceAmount: '100',
  sodiumMilligrams: '0',
  sugarGrams: '2',
  utcOffsetMinutes: 480,
} as const;

class FakeRepository implements ConsumptionEntryRepository {
  entries: ConsumptionEntry[] = [];
  delete(): Promise<boolean> {
    return Promise.resolve(false);
  }
  getById(): Promise<ConsumptionEntry | null> {
    return Promise.resolve(null);
  }
  insert(entry: ConsumptionEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }
  listByLocalDate(): Promise<readonly ConsumptionEntry[]> {
    return Promise.resolve(this.entries);
  }
  update(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

describe('nutrition logging application', () => {
  it('parses blank nutrients as unknown and preserves entered zero', () => {
    const result = buildConsumptionEntry(
      '550e8400-e29b-41d4-a716-446655440000',
      validInput,
      Date.UTC(2026, 7, 2, 5),
    );
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.facts.nutrients.fiberGrams).toBeNull();
    expect(result.value.facts.nutrients.sodiumMilligrams).toBe(0);
  });

  it('rejects future entries without writing', async () => {
    const repository = new FakeRepository();
    const runner: TransactionRunner<ConsumptionEntryTransactionContext> = {
      run: (operation) => operation({ consumptionEntryRepository: repository }),
    };
    const result = await new CreateConsumptionEntryUseCase(
      runner,
      () => '550e8400-e29b-41d4-a716-446655440000',
      () => Date.UTC(2026, 7, 2, 3),
    ).execute(validInput);
    expect(result.isSuccess).toBe(false);
    expect(repository.entries).toHaveLength(0);
  });

  it('inserts and returns scaled daily totals', async () => {
    const repository = new FakeRepository();
    const runner: TransactionRunner<ConsumptionEntryTransactionContext> = {
      run: (operation) => operation({ consumptionEntryRepository: repository }),
    };
    const created = await new CreateConsumptionEntryUseCase(
      runner,
      () => '550e8400-e29b-41d4-a716-446655440000',
      () => Date.UTC(2026, 7, 2, 5),
    ).execute(validInput);
    expect(created.isSuccess).toBe(true);

    const daily = await new GetDailyNutritionUseCase(repository).execute(
      '2026-08-02',
    );
    expect(daily.summary.energy.in('kilocalorie')).toBe(100);
    expect(daily.summary.nutrients.fiberGrams).toBeNull();
  });
});
