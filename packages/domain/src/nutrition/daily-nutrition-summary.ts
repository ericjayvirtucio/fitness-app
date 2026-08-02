import type { DomainError } from '../shared/domain-error';
import { isErr, ok, type Result } from '../shared/result';
import { Energy } from './energy';
import type { ConsumptionEntry } from './consumption-entry';
import type { NutrientAmounts } from './nutrition-facts';

export type DailyNutritionSummary = Readonly<{
  energy: Energy;
  entryCount: number;
  nutrients: NutrientAmounts;
}>;

const nutrientFields = Object.freeze([
  'carbohydrateGrams',
  'fatGrams',
  'fiberGrams',
  'proteinGrams',
  'sodiumMilligrams',
  'sugarGrams',
] as const satisfies readonly (keyof NutrientAmounts)[]);

export function summarizeConsumptionEntries(
  entries: readonly ConsumptionEntry[],
): Result<DailyNutritionSummary, DomainError> {
  let energyKilojoules = 0;
  const nutrientTotals: Record<keyof NutrientAmounts, number | null> = {
    carbohydrateGrams: 0,
    fatGrams: 0,
    fiberGrams: 0,
    proteinGrams: 0,
    sodiumMilligrams: 0,
    sugarGrams: 0,
  };

  for (const entry of entries) {
    energyKilojoules += entry.consumedFacts.energy.kilojoules;

    for (const field of nutrientFields) {
      const total = nutrientTotals[field];
      const amount = entry.consumedFacts.nutrients[field];
      nutrientTotals[field] =
        total === null || amount === null ? null : total + amount;
    }
  }

  const energy = Energy.create(energyKilojoules, 'kilojoule');
  if (isErr(energy)) return energy;

  return ok(
    Object.freeze({
      energy: energy.value,
      entryCount: entries.length,
      nutrients: Object.freeze(nutrientTotals),
    }),
  );
}
