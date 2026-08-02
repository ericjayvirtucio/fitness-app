import { describe, expect, it } from 'vitest';

import {
  Energy,
  Mass,
  NutritionFacts,
  Volume,
  isErr,
  isOk,
  nutritionProvenances,
  scaleNutritionFacts,
  type NutrientAmounts,
  type NutritionReference,
  type Result,
} from '../index';

const completeNutrients: NutrientAmounts = {
  carbohydrateGrams: 5.1,
  fatGrams: 12.4,
  fiberGrams: null,
  proteinGrams: 8.2,
  sodiumMilligrams: 640,
  sugarGrams: 0,
};

describe('NutritionFacts', () => {
  it('creates immutable facts against canonical mass', () => {
    const facts = createFacts(massReference(100), completeNutrients);

    expect(facts.description).toBe('Chicken adobo');
    expect(facts.reference.kind).toBe('mass');
    if (facts.reference.kind === 'mass') {
      expect(facts.reference.amount.grams).toBe(100);
    }
    expect(facts.nutrients).toEqual(completeNutrients);
    expect(facts.provenance).toBe('estimated');
    expect(Object.isFrozen(facts)).toBe(true);
    expect(Object.isFrozen(facts.reference)).toBe(true);
    expect(Object.isFrozen(facts.nutrients)).toBe(true);
  });

  it('creates facts against canonical volume', () => {
    const facts = createFacts(volumeReference(250), completeNutrients);

    expect(facts.reference.kind).toBe('volume');
    if (facts.reference.kind === 'volume') {
      expect(facts.reference.amount.milliliters).toBe(250);
    }
  });

  it('canonicalizes physical units before nutrition construction', () => {
    const mass = required(Mass.create(1, 'ounce'));
    const facts = createFacts(
      { amount: mass, kind: 'mass' },
      completeNutrients,
    );

    if (facts.reference.kind === 'mass') {
      expect(facts.reference.amount.grams).toBeCloseTo(28.349523125, 12);
    }
  });

  it('distinguishes unknown nutrients from known zero nutrients', () => {
    const facts = createFacts(massReference(100), completeNutrients);

    expect(facts.nutrients.fiberGrams).toBeNull();
    expect(facts.nutrients.sugarGrams).toBe(0);
  });

  it.each([
    ['', massReference(100), completeNutrients, 'estimated', 'description'],
    [
      'Food',
      { amount: required(Mass.create(0, 'gram')), kind: 'mass' },
      completeNutrients,
      'estimated',
      'reference',
    ],
    [
      'Food',
      { amount: required(Mass.create(100, 'gram')), kind: 'volume' },
      completeNutrients,
      'estimated',
      'reference',
    ],
    ['Food', massReference(100), completeNutrients, 'generated', 'provenance'],
    ['Food', massReference(100), null, 'estimated', 'nutrients'],
  ])(
    'rejects invalid composition input',
    (description, reference, nutrients, provenance, field) => {
      const result = NutritionFacts.create({
        description,
        energy: required(Energy.create(100, 'kilocalorie')),
        nutrients,
        provenance,
        reference,
      });

      expect(isErr(result) && result.error.field).toBe(field);
    },
  );

  it('requires canonical energy', () => {
    const result = NutritionFacts.create({
      description: 'Food',
      energy: null,
      nutrients: completeNutrients,
      provenance: 'provided',
      reference: massReference(100),
    });

    expect(isErr(result) && result.error.field).toBe('energy');
  });

  it.each([
    ['proteinGrams', -1],
    ['carbohydrateGrams', Number.NaN],
    ['fatGrams', Number.POSITIVE_INFINITY],
    ['fiberGrams', undefined],
    ['sugarGrams', 'unknown'],
    ['sodiumMilligrams', -0.1],
  ] as const)('rejects invalid %s', (field, value) => {
    const result = NutritionFacts.create({
      description: 'Food',
      energy: required(Energy.create(100, 'kilocalorie')),
      nutrients: { ...completeNutrients, [field]: value },
      provenance: 'provided',
      reference: massReference(100),
    });

    expect(isErr(result) && result.error.field).toBe(field);
  });

  it('requires every supported nutrient with an explicit value or unknown', () => {
    const { fiberGrams: omitted, ...incompleteNutrients } = completeNutrients;
    expect(omitted).toBeNull();

    const result = NutritionFacts.create({
      description: 'Food',
      energy: required(Energy.create(100, 'kilocalorie')),
      nutrients: incompleteNutrients,
      provenance: 'provided',
      reference: massReference(100),
    });

    expect(isErr(result) && result.error.field).toBe('fiberGrams');
  });

  it('publishes the provider-neutral provenance vocabulary', () => {
    expect(nutritionProvenances).toEqual(['provided', 'estimated']);
  });
});

describe('scaleNutritionFacts', () => {
  it('scales mass-based energy and every known nutrient', () => {
    const facts = createFacts(massReference(100), completeNutrients);
    const result = scaleNutritionFacts(facts, massReference(175));
    const scaled = required(result);

    expect(scaled.energy.in('kilocalorie')).toBeCloseTo(350, 12);
    expect(scaled.nutrients.carbohydrateGrams).toBeCloseTo(8.925, 12);
    expect(scaled.nutrients.fatGrams).toBeCloseTo(21.7, 12);
    expect(scaled.nutrients.fiberGrams).toBeNull();
    expect(scaled.nutrients.proteinGrams).toBeCloseTo(14.35, 12);
    expect(scaled.nutrients.sodiumMilligrams).toBeCloseTo(1_120, 12);
    expect(scaled.nutrients.sugarGrams).toBe(0);
    expect(scaled.reference.kind).toBe('mass');
    if (scaled.reference.kind === 'mass') {
      expect(scaled.reference.amount.grams).toBe(175);
    }
  });

  it('downscales volume-based composition without rounding', () => {
    const facts = createFacts(volumeReference(250), completeNutrients);
    const scaled = required(scaleNutritionFacts(facts, volumeReference(100)));

    expect(scaled.energy.in('kilocalorie')).toBeCloseTo(80, 12);
    expect(scaled.nutrients.proteinGrams).toBeCloseTo(3.28, 12);
    expect(scaled.nutrients.fiberGrams).toBeNull();
    expect(scaled.nutrients.sugarGrams).toBe(0);
  });

  it('rejects cross-dimension scaling', () => {
    const facts = createFacts(massReference(100), completeNutrients);
    const result = scaleNutritionFacts(facts, volumeReference(100));

    expect(isErr(result) && result.error).toMatchObject({
      code: 'unsupported-option',
      field: 'consumedQuantity',
    });
  });

  it('rejects zero and ambiguous consumed quantities', () => {
    const facts = createFacts(massReference(100), completeNutrients);
    const zeroMass = required(Mass.create(0, 'gram'));

    const zeroResult = scaleNutritionFacts(facts, {
      amount: zeroMass,
      kind: 'mass',
    });
    expect(isErr(zeroResult) && zeroResult.error).toMatchObject({
      code: 'out-of-range',
      field: 'consumedQuantity',
    });

    const servingResult = scaleNutritionFacts(facts, {
      amount: 2,
      kind: 'serving',
    });
    expect(isErr(servingResult) && servingResult.error.field).toBe(
      'consumedQuantity',
    );
  });
});

function createFacts(
  reference: NutritionReference,
  nutrients: NutrientAmounts,
): NutritionFacts {
  return required(
    NutritionFacts.create({
      description: ' Chicken adobo ',
      energy: required(Energy.create(200, 'kilocalorie')),
      nutrients,
      provenance: 'estimated',
      reference,
    }),
  );
}

function massReference(grams: number): NutritionReference {
  return { amount: required(Mass.create(grams, 'gram')), kind: 'mass' };
}

function volumeReference(milliliters: number): NutritionReference {
  return {
    amount: required(Volume.create(milliliters, 'milliliter')),
    kind: 'volume',
  };
}

function required<T, E>(result: Result<T, E>): T {
  if (!isOk(result)) {
    throw new Error('Invalid test fixture.');
  }
  return result.value;
}
