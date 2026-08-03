import type { ConsumptionEntry, DomainId } from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import {
  buildNutritionCatalogItem,
  type SaveNutritionCatalogItemInput,
} from './build-nutrition-catalog-item';
import type { ConsumptionEntryRepository } from './consumption-entry-repository';
import { LogFromNutritionCatalogUseCase } from './log-from-nutrition-catalog-use-case';
import type { NutritionCatalogItem } from './nutrition-catalog-item';
import type { NutritionCatalogRepository } from './nutrition-catalog-repository';
import {
  BrowseNutritionCatalogUseCase,
  CreateNutritionCatalogItemUseCase,
  SaveConsumptionEntryAsCatalogItemUseCase,
  SetNutritionCatalogFavoriteUseCase,
  UpdateNutritionCatalogItemUseCase,
  type NutritionCatalogTransactionContext,
} from './nutrition-catalog-use-cases';

const id = '550e8400-e29b-41d4-a716-446655440000';
const entryId = '2f1f5f92-3cc4-4b63-b8aa-e8fc92f254dc';
const validInput: SaveNutritionCatalogItemInput = {
  carbohydrateGrams: '2',
  description: 'Chicken adobo',
  energyKilocalories: '200',
  fatGrams: '4',
  fiberGrams: '',
  isFavorite: false,
  kind: 'food',
  proteinGrams: '8',
  referenceAmount: '100',
  sodiumMilligrams: '0',
  sugarGrams: '1',
};

class FakeCatalogRepository implements NutritionCatalogRepository {
  items: NutritionCatalogItem[] = [];
  recordedUsage: { id: string; time: number }[] = [];
  delete(catalogId: DomainId): Promise<boolean> {
    const index = this.items.findIndex((item) => item.id.equals(catalogId));
    if (index < 0) return Promise.resolve(false);
    this.items.splice(index, 1);
    return Promise.resolve(true);
  }
  findByNormalizedName(name: string): Promise<readonly NutritionCatalogItem[]> {
    return Promise.resolve(
      this.items.filter(
        (item) => item.facts.description.toLowerCase() === name,
      ),
    );
  }
  getById(catalogId: DomainId): Promise<NutritionCatalogItem | null> {
    return Promise.resolve(
      this.items.find((item) => item.id.equals(catalogId)) ?? null,
    );
  }
  insert(item: NutritionCatalogItem): Promise<void> {
    this.items.push(item);
    return Promise.resolve();
  }
  listFavorites(): Promise<readonly NutritionCatalogItem[]> {
    return Promise.resolve(this.items.filter((item) => item.isFavorite));
  }
  listRecent(): Promise<readonly NutritionCatalogItem[]> {
    return Promise.resolve(
      [...this.items].sort(
        (left, right) =>
          (right.usage.lastUsedAtEpochMilliseconds ?? -1) -
          (left.usage.lastUsedAtEpochMilliseconds ?? -1),
      ),
    );
  }
  recordUsage(catalogId: DomainId, time: number): Promise<boolean> {
    if (!this.items.some((item) => item.id.equals(catalogId))) {
      return Promise.resolve(false);
    }
    this.recordedUsage.push({ id: catalogId.value, time });
    return Promise.resolve(true);
  }
  search(query: string): Promise<readonly NutritionCatalogItem[]> {
    return Promise.resolve(
      this.items.filter((item) =>
        item.facts.description.toLowerCase().includes(query),
      ),
    );
  }
  setFavorite(catalogId: DomainId, favorite: boolean): Promise<boolean> {
    const item = this.items.find((candidate) => candidate.id.equals(catalogId));
    if (!item) return Promise.resolve(false);
    const rebuilt = buildNutritionCatalogItem(
      item.id.value,
      { ...toInput(item), isFavorite: favorite },
      item,
    );
    if (!rebuilt.isSuccess) throw new Error('Invalid fixture.');
    this.items = this.items.map((candidate) =>
      candidate.id.equals(catalogId) ? rebuilt.value : candidate,
    );
    return Promise.resolve(true);
  }
  update(item: NutritionCatalogItem): Promise<boolean> {
    const index = this.items.findIndex((candidate) =>
      candidate.id.equals(item.id),
    );
    if (index < 0) return Promise.resolve(false);
    this.items[index] = item;
    return Promise.resolve(true);
  }
}

class FakeConsumptionRepository implements ConsumptionEntryRepository {
  entries: ConsumptionEntry[] = [];
  delete(): Promise<boolean> {
    return Promise.resolve(false);
  }
  getById(): Promise<ConsumptionEntry | null> {
    return Promise.resolve(this.entries[0] ?? null);
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

function createItem(itemId = id, input = validInput) {
  const result = buildNutritionCatalogItem(itemId, input);
  if (!result.isSuccess) throw new Error('Invalid fixture.');
  return result.value;
}

describe('nutrition catalog application', () => {
  it('builds food and beverage items while preserving unknown and zero', () => {
    const food = buildNutritionCatalogItem(id, validInput);
    const beverage = buildNutritionCatalogItem(entryId, {
      ...validInput,
      kind: 'beverage',
      referenceAmount: '250',
    });
    expect(food.isSuccess).toBe(true);
    expect(beverage.isSuccess).toBe(true);
    if (!food.isSuccess || !beverage.isSuccess) return;
    expect(food.value.facts.reference.kind).toBe('mass');
    expect(beverage.value.facts.reference.kind).toBe('volume');
    expect(food.value.facts.nutrients.fiberGrams).toBeNull();
    expect(food.value.facts.nutrients.sodiumMilligrams).toBe(0);
  });

  it('warns on exact normalized duplicates but allows confirmed insertion', async () => {
    const repository = new FakeCatalogRepository();
    repository.items.push(createItem());
    const useCase = new CreateNutritionCatalogItemUseCase(
      repository,
      () => entryId,
    );

    await expect(
      useCase.execute({ ...validInput, description: '  CHICKEN ADOB0  ' }),
    ).resolves.toMatchObject({ status: 'saved' });
    const duplicate = await useCase.execute({
      ...validInput,
      description: '  CHICKEN   ADOB0  ',
    });
    expect(duplicate.status).toBe('duplicate');
    expect(repository.items).toHaveLength(2);
    await expect(
      useCase.execute(
        { ...validInput, description: '  CHICKEN   ADOB0  ' },
        true,
      ),
    ).resolves.toMatchObject({ status: 'saved' });
  });

  it('preserves usage metadata when editing and excludes itself from duplicates', async () => {
    const repository = new FakeCatalogRepository();
    const used = buildNutritionCatalogItem(id, validInput, createItem());
    if (!used.isSuccess) throw new Error('Invalid fixture.');
    repository.items.push(used.value);
    const outcome = await new UpdateNutritionCatalogItemUseCase(
      repository,
    ).execute(id, { ...validInput, energyKilocalories: '250' });
    expect(outcome.status).toBe('saved');
    expect(repository.items[0]?.facts.energy.in('kilocalorie')).toBe(250);
  });

  it('performs focused browse and favorite operations', async () => {
    const repository = new FakeCatalogRepository();
    repository.items.push(createItem());
    const browse = new BrowseNutritionCatalogUseCase(repository);
    await expect(browse.search(' adobo ')).resolves.toHaveLength(1);
    await expect(browse.search('   ')).resolves.toEqual([]);
    await new SetNutritionCatalogFavoriteUseCase(repository).execute(id, true);
    await expect(browse.listFavorites()).resolves.toHaveLength(1);
  });

  it('logs a scaled snapshot and records usage in one transaction callback', async () => {
    const catalog = new FakeCatalogRepository();
    const consumption = new FakeConsumptionRepository();
    catalog.items.push(createItem());
    let transactionRuns = 0;
    const runner: TransactionRunner<NutritionCatalogTransactionContext> = {
      run: async (operation) => {
        transactionRuns += 1;
        return operation({
          consumptionEntryRepository: consumption,
          nutritionCatalogRepository: catalog,
        });
      },
    };
    const now = new Date(2026, 7, 3, 12).getTime();
    const result = await new LogFromNutritionCatalogUseCase(
      runner,
      () => entryId,
      () => now,
    ).execute(id, '175');

    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.consumedFacts.energy.in('kilocalorie')).toBeCloseTo(
      350,
    );
    expect(result.value.facts.nutrients.fiberGrams).toBeNull();
    expect(result.value.facts.nutrients.sodiumMilligrams).toBe(0);
    expect(catalog.recordedUsage).toEqual([{ id, time: now }]);
    expect(transactionRuns).toBe(1);
  });

  it('propagates transaction failure instead of reporting a partial success', async () => {
    const runner: TransactionRunner<NutritionCatalogTransactionContext> = {
      run: () => Promise.reject(new Error('transaction failed')),
    };
    await expect(
      new LogFromNutritionCatalogUseCase(
        runner,
        () => entryId,
        () => 100,
      ).execute(id, '100'),
    ).rejects.toThrow('transaction failed');
  });

  it('copies original reference facts when saving a diary entry as reusable', async () => {
    const catalog = new FakeCatalogRepository();
    const consumption = new FakeConsumptionRepository();
    catalog.items.push(createItem());
    const runner: TransactionRunner<NutritionCatalogTransactionContext> = {
      run: (operation) =>
        operation({
          consumptionEntryRepository: consumption,
          nutritionCatalogRepository: catalog,
        }),
    };
    const now = new Date(2026, 7, 3, 12).getTime();
    const logged = await new LogFromNutritionCatalogUseCase(
      runner,
      () => entryId,
      () => now,
    ).execute(id, '175');
    catalog.items = [];
    expect(logged.isSuccess).toBe(true);

    const saved = await new SaveConsumptionEntryAsCatalogItemUseCase(
      consumption,
      catalog,
      () => id,
    ).execute(entryId, 'My adobo', false);
    expect(saved.status).toBe('saved');
    expect(catalog.items[0]?.facts.reference.kind).toBe('mass');
    if (catalog.items[0]?.facts.reference.kind === 'mass') {
      expect(catalog.items[0].facts.reference.amount.grams).toBe(100);
    }
    expect(catalog.items[0]?.facts.energy.in('kilocalorie')).toBeCloseTo(200);
  });
});

function toInput(item: NutritionCatalogItem): SaveNutritionCatalogItemInput {
  const nutrients = item.facts.nutrients;
  return {
    carbohydrateGrams: nutrients.carbohydrateGrams,
    description: item.facts.description,
    energyKilocalories: item.facts.energy.in('kilocalorie'),
    fatGrams: nutrients.fatGrams,
    fiberGrams: nutrients.fiberGrams,
    isFavorite: item.isFavorite,
    kind: item.kind,
    proteinGrams: nutrients.proteinGrams,
    provenance: item.facts.provenance,
    referenceAmount:
      item.facts.reference.kind === 'mass'
        ? item.facts.reference.amount.grams
        : item.facts.reference.amount.milliliters,
    sodiumMilligrams: nutrients.sodiumMilligrams,
    sugarGrams: nutrients.sugarGrams,
  };
}
