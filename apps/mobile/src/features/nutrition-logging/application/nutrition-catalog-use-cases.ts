import { DomainError, DomainId, isErr } from '@fitness/domain';
import {
  buildNutritionCatalogItem,
  type SaveNutritionCatalogItemInput,
} from './build-nutrition-catalog-item';
import type { ConsumptionEntryRepository } from './consumption-entry-repository';
import type { NutritionCatalogItem } from './nutrition-catalog-item';
import { normalizeNutritionCatalogName } from './nutrition-catalog-name';
import type { NutritionCatalogRepository } from './nutrition-catalog-repository';

export type CatalogSaveOutcome =
  | Readonly<{ errors: readonly DomainError[]; status: 'invalid' }>
  | Readonly<{
      item: NutritionCatalogItem;
      matches: readonly NutritionCatalogItem[];
      status: 'duplicate';
    }>
  | Readonly<{ item: NutritionCatalogItem; status: 'saved' }>;

export class CreateNutritionCatalogItemUseCase {
  constructor(
    private readonly repository: NutritionCatalogRepository,
    private readonly generateId: () => string,
  ) {}

  async execute(
    input: SaveNutritionCatalogItemInput,
    allowDuplicate = false,
  ): Promise<CatalogSaveOutcome> {
    const result = buildNutritionCatalogItem(this.generateId(), input);
    if (!result.isSuccess) return { errors: result.error, status: 'invalid' };
    const matches = await this.repository.findByNormalizedName(
      normalizeNutritionCatalogName(result.value.facts.description),
    );
    if (!allowDuplicate && matches.length > 0) {
      return { item: result.value, matches, status: 'duplicate' };
    }
    await this.repository.insert(result.value);
    return { item: result.value, status: 'saved' };
  }
}

export class UpdateNutritionCatalogItemUseCase {
  constructor(private readonly repository: NutritionCatalogRepository) {}

  async execute(
    idValue: unknown,
    input: SaveNutritionCatalogItemInput,
    allowDuplicate = false,
  ): Promise<CatalogSaveOutcome> {
    const id = DomainId.create(idValue);
    if (isErr(id)) return { errors: [id.error], status: 'invalid' };
    const existing = await this.repository.getById(id.value);
    if (existing === null) return missingOutcome();
    const result = buildNutritionCatalogItem(id.value.value, input, existing);
    if (!result.isSuccess) return { errors: result.error, status: 'invalid' };
    const matches = (
      await this.repository.findByNormalizedName(
        normalizeNutritionCatalogName(result.value.facts.description),
      )
    ).filter((match) => match.id.value !== id.value.value);
    if (!allowDuplicate && matches.length > 0) {
      return { item: result.value, matches, status: 'duplicate' };
    }
    return (await this.repository.update(result.value))
      ? { item: result.value, status: 'saved' }
      : missingOutcome();
  }
}

export class GetNutritionCatalogItemUseCase {
  constructor(private readonly repository: NutritionCatalogRepository) {}
  async execute(idValue: unknown) {
    const id = DomainId.create(idValue);
    return isErr(id) ? null : this.repository.getById(id.value);
  }
}

export class DeleteNutritionCatalogItemUseCase {
  constructor(private readonly repository: NutritionCatalogRepository) {}
  async execute(idValue: unknown): Promise<boolean> {
    const id = DomainId.create(idValue);
    return isErr(id) ? false : this.repository.delete(id.value);
  }
}

export class BrowseNutritionCatalogUseCase {
  constructor(private readonly repository: NutritionCatalogRepository) {}
  listFavorites(limit = 10) {
    return this.repository.listFavorites(limit);
  }
  listRecent(limit = 10) {
    return this.repository.listRecent(limit);
  }
  search(query: string, limit = 50) {
    const normalized = normalizeNutritionCatalogName(query);
    return normalized === ''
      ? Promise.resolve(Object.freeze([]))
      : this.repository.search(normalized, limit);
  }
}

export class SetNutritionCatalogFavoriteUseCase {
  constructor(private readonly repository: NutritionCatalogRepository) {}
  async execute(idValue: unknown, isFavorite: boolean): Promise<boolean> {
    const id = DomainId.create(idValue);
    return isErr(id)
      ? false
      : this.repository.setFavorite(id.value, isFavorite);
  }
}

export type NutritionCatalogTransactionContext = Readonly<{
  consumptionEntryRepository: ConsumptionEntryRepository;
  nutritionCatalogRepository: NutritionCatalogRepository;
}>;

export class SaveConsumptionEntryAsCatalogItemUseCase {
  constructor(
    private readonly consumptionRepository: ConsumptionEntryRepository,
    private readonly catalogRepository: NutritionCatalogRepository,
    private readonly generateId: () => string,
  ) {}

  async execute(
    entryIdValue: unknown,
    description: unknown,
    isFavorite: boolean,
    allowDuplicate = false,
  ): Promise<CatalogSaveOutcome> {
    const entryId = DomainId.create(entryIdValue);
    if (isErr(entryId)) {
      return { errors: [entryId.error], status: 'invalid' };
    }
    const entry = await this.consumptionRepository.getById(entryId.value);
    if (entry === null) {
      return {
        errors: [
          DomainError.create(
            'invalid-identifier',
            'Consumption entry no longer exists.',
            'id',
          ),
        ],
        status: 'invalid',
      };
    }
    const referenceAmount =
      entry.facts.reference.kind === 'mass'
        ? entry.facts.reference.amount.grams
        : entry.facts.reference.amount.milliliters;
    return new CreateNutritionCatalogItemUseCase(
      this.catalogRepository,
      this.generateId,
    ).execute(
      {
        carbohydrateGrams: entry.facts.nutrients.carbohydrateGrams,
        description,
        energyKilocalories: entry.facts.energy.in('kilocalorie'),
        fatGrams: entry.facts.nutrients.fatGrams,
        fiberGrams: entry.facts.nutrients.fiberGrams,
        isFavorite,
        kind: entry.kind,
        proteinGrams: entry.facts.nutrients.proteinGrams,
        provenance: entry.facts.provenance,
        referenceAmount,
        sodiumMilligrams: entry.facts.nutrients.sodiumMilligrams,
        sugarGrams: entry.facts.nutrients.sugarGrams,
      },
      allowDuplicate,
    );
  }
}

function missingOutcome(): CatalogSaveOutcome {
  return {
    errors: [
      DomainError.create(
        'invalid-identifier',
        'Saved nutrition item no longer exists.',
        'id',
      ),
    ],
    status: 'invalid',
  };
}
