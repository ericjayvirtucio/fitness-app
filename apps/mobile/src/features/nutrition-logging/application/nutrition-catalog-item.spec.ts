import {
  DomainId,
  Energy,
  Mass,
  NutritionFacts,
  Volume,
  isOk,
} from '@fitness/domain';
import { NutritionCatalogItem } from './nutrition-catalog-item';
import {
  escapeLikePattern,
  normalizeNutritionCatalogName,
} from './nutrition-catalog-name';

function createFacts(kind: 'mass' | 'volume' = 'mass') {
  const energy = Energy.create(100, 'kilocalorie');
  if (!isOk(energy)) throw new Error('Invalid fixture.');
  const reference =
    kind === 'mass' ? createMassReference() : createVolumeReference();
  const facts = NutritionFacts.create({
    description: 'Chicken adobo',
    energy: energy.value,
    nutrients: {
      carbohydrateGrams: 2,
      fatGrams: 4,
      fiberGrams: null,
      proteinGrams: 8,
      sodiumMilligrams: 0,
      sugarGrams: 1,
    },
    provenance: 'provided',
    reference,
  });
  if (!isOk(facts)) throw new Error('Invalid fixture.');
  return facts.value;
}

function createMassReference() {
  const amount = Mass.create(100, 'gram');
  if (!isOk(amount)) throw new Error('Invalid fixture.');
  return { amount: amount.value, kind: 'mass' as const };
}

function createVolumeReference() {
  const amount = Volume.create(250, 'milliliter');
  if (!isOk(amount)) throw new Error('Invalid fixture.');
  return { amount: amount.value, kind: 'volume' as const };
}

function createItem(
  overrides: Partial<Parameters<typeof NutritionCatalogItem.create>[0]> = {},
) {
  const id = DomainId.create('550e8400-e29b-41d4-a716-446655440000');
  if (!isOk(id)) throw new Error('Invalid fixture.');
  return NutritionCatalogItem.create({
    facts: createFacts(),
    id: id.value,
    isFavorite: false,
    kind: 'food',
    lastUsedAtEpochMilliseconds: null,
    useCount: 0,
    ...overrides,
  });
}

describe('NutritionCatalogItem', () => {
  it('creates immutable catalog lifecycle state around domain facts', () => {
    const result = createItem({
      isFavorite: true,
      lastUsedAtEpochMilliseconds: 100,
      useCount: 2,
    });

    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.facts.nutrients.fiberGrams).toBeNull();
    expect(result.value.facts.nutrients.sodiumMilligrams).toBe(0);
    expect(result.value.usage).toEqual({
      lastUsedAtEpochMilliseconds: 100,
      useCount: 2,
    });
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.usage)).toBe(true);
  });

  it('enforces food/mass and beverage/volume compatibility', () => {
    expect(createItem({ facts: createFacts('volume') }).isSuccess).toBe(false);
    expect(
      createItem({ facts: createFacts('volume'), kind: 'beverage' }).isSuccess,
    ).toBe(true);
  });

  it('rejects inconsistent usage metadata', () => {
    expect(
      createItem({ lastUsedAtEpochMilliseconds: 100, useCount: 0 }).isSuccess,
    ).toBe(false);
    expect(createItem({ useCount: 1 }).isSuccess).toBe(false);
  });
});

describe('nutrition catalog name normalization', () => {
  it('trims, collapses whitespace, and case-folds without changing words', () => {
    expect(normalizeNutritionCatalogName('  Chicken\n  Adobo  ')).toBe(
      'chicken adobo',
    );
    expect(normalizeNutritionCatalogName('Chicken breast adobo')).not.toBe(
      normalizeNutritionCatalogName('Chicken adobo'),
    );
  });

  it('escapes literal LIKE wildcard characters', () => {
    expect(escapeLikePattern('100%_sure\\')).toBe('100\\%\\_sure\\\\');
  });
});
