import { DomainId } from '../shared/domain-id';
import { Mass } from '../shared/measurement/mass';
import { Volume } from '../shared/measurement/volume';
import { isErr, isOk } from '../shared/result';
import { ConsumptionEntry } from './consumption-entry';
import { summarizeConsumptionEntries } from './daily-nutrition-summary';
import { Energy } from './energy';
import { NutritionFacts } from './nutrition-facts';

function createFacts(kind: 'mass' | 'volume' = 'mass') {
  const energy = Energy.create(200, 'kilocalorie');
  if (!isOk(energy)) throw new Error('Invalid fixture.');

  const reference =
    kind === 'mass' ? createMassReference(100) : createVolumeReference(250);

  const facts = NutritionFacts.create({
    description: 'Oats',
    energy: energy.value,
    nutrients: {
      carbohydrateGrams: 30,
      fatGrams: 4,
      fiberGrams: null,
      proteinGrams: 8,
      sodiumMilligrams: 0,
      sugarGrams: 2,
    },
    provenance: 'provided',
    reference,
  });
  if (!isOk(facts)) throw new Error('Invalid fixture.');
  return facts.value;
}

function createEntry(
  idValue = '550e8400-e29b-41d4-a716-446655440000',
  facts = createFacts(),
  consumedAmount = 50,
) {
  const id = DomainId.create(idValue);
  const consumedQuantity =
    facts.reference.kind === 'mass'
      ? createMassReference(consumedAmount)
      : createVolumeReference(consumedAmount);
  if (!isOk(id)) throw new Error('Invalid fixture.');

  return ConsumptionEntry.create({
    consumedQuantity,
    facts,
    id: id.value,
    kind: 'food',
    localCalendarDate: '2026-08-02',
    occurredAtEpochMilliseconds: Date.UTC(2026, 7, 2, 4),
    utcOffsetMinutes: 480,
  });
}

function createMassReference(amount: number) {
  const mass = Mass.create(amount, 'gram');
  if (!isOk(mass)) throw new Error('Invalid fixture.');
  return { amount: mass.value, kind: 'mass' as const };
}

function createVolumeReference(amount: number) {
  const volume = Volume.create(amount, 'milliliter');
  if (!isOk(volume)) throw new Error('Invalid fixture.');
  return { amount: volume.value, kind: 'volume' as const };
}

describe('ConsumptionEntry', () => {
  it('creates an immutable entry and derives consumed nutrition', () => {
    const result = createEntry();
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    expect(result.value.consumedFacts.energy.in('kilocalorie')).toBe(100);
    expect(result.value.consumedFacts.nutrients.fiberGrams).toBeNull();
    expect(result.value.consumedFacts.nutrients.sodiumMilligrams).toBe(0);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('accepts volume-based beverages', () => {
    const result = createEntry(
      '2f1f5f92-3cc4-4b63-b8aa-e8fc92f254dc',
      createFacts('volume'),
      500,
    );
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.consumedFacts.energy.in('kilocalorie')).toBe(400);
    }
  });

  it('rejects mismatched dimensions and invalid temporal metadata', () => {
    const id = DomainId.create('550e8400-e29b-41d4-a716-446655440000');
    const volume = Volume.create(100, 'milliliter');
    if (!isOk(id) || !isOk(volume)) throw new Error('Invalid fixture.');
    const mismatch = ConsumptionEntry.create({
      consumedQuantity: { amount: volume.value, kind: 'volume' },
      facts: createFacts('mass'),
      id: id.value,
      kind: 'food',
      localCalendarDate: '2026-08-02',
      occurredAtEpochMilliseconds: Date.UTC(2026, 7, 2, 4),
      utcOffsetMinutes: 480,
    });
    expect(isErr(mismatch)).toBe(true);

    const wrongDay = createEntry();
    if (!isOk(wrongDay)) throw new Error('Invalid fixture.');
    const invalid = ConsumptionEntry.create({
      ...wrongDay.value,
      localCalendarDate: '2026-08-03',
    });
    expect(isErr(invalid)).toBe(true);
    if (isErr(invalid)) expect(invalid.error.code).toBe('invalid-date');
  });
});

describe('summarizeConsumptionEntries', () => {
  it('returns known zero totals for an empty day', () => {
    const result = summarizeConsumptionEntries([]);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.energy.in('kilocalorie')).toBe(0);
    expect(result.value.nutrients.proteinGrams).toBe(0);
  });

  it('sums known values and propagates an unknown contribution', () => {
    const first = createEntry();
    const second = createEntry('2f1f5f92-3cc4-4b63-b8aa-e8fc92f254dc');
    if (!isOk(first) || !isOk(second)) throw new Error('Invalid fixture.');

    const result = summarizeConsumptionEntries([first.value, second.value]);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.energy.in('kilocalorie')).toBe(200);
    expect(result.value.nutrients.proteinGrams).toBe(8);
    expect(result.value.nutrients.fiberGrams).toBeNull();
    expect(result.value.nutrients.sodiumMilligrams).toBe(0);
  });
});
import { describe, expect, it } from 'vitest';
