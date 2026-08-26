import { describe, expect, it } from 'vitest';
import {
  calculateDailyMacronutrientTargets,
  Energy,
  isOk,
  macronutrientCaloriesPerGram,
  macronutrientDistributionPolicy,
} from '../index';

function target(kilocalories: number) {
  const energy = Energy.create(kilocalories, 'kilocalorie');
  if (!isOk(energy)) throw new Error('Invalid test fixture.');
  return energy.value;
}

describe('goal-derived daily macronutrient targets', () => {
  it('publishes a fixed distribution that sums to 100%', () => {
    expect(macronutrientDistributionPolicy).toEqual({
      carbohydratePercentageOfCalories: 50,
      fatPercentageOfCalories: 30,
      proteinPercentageOfCalories: 20,
    });
    expect(
      macronutrientDistributionPolicy.carbohydratePercentageOfCalories +
        macronutrientDistributionPolicy.fatPercentageOfCalories +
        macronutrientDistributionPolicy.proteinPercentageOfCalories,
    ).toBe(100);
    expect(macronutrientCaloriesPerGram).toEqual({
      carbohydrate: 4,
      fat: 9,
      protein: 4,
    });
  });

  it('matches hand-computed grams for a representative calorie target', () => {
    const result = calculateDailyMacronutrientTargets(target(2_000));
    expect(result).toEqual({
      carbohydrateGrams: 250,
      fatGrams: 66.66666666666667,
      proteinGrams: 100,
    });
  });

  it.each([1_000, 1_200, 1_846, 2_096, 2_500])(
    'accounts for the whole %d-kilocalorie target with no rounding artifact',
    (kilocalories) => {
      const result = calculateDailyMacronutrientTargets(target(kilocalories));
      const recomposedKilocalories =
        result.proteinGrams * macronutrientCaloriesPerGram.protein +
        result.carbohydrateGrams * macronutrientCaloriesPerGram.carbohydrate +
        result.fatGrams * macronutrientCaloriesPerGram.fat;
      expect(recomposedKilocalories).toBe(kilocalories);
    },
  );
});
