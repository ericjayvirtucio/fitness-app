import type { Energy } from '../nutrition/energy';

export const macronutrientDistributionPolicy = Object.freeze({
  carbohydratePercentageOfCalories: 50,
  fatPercentageOfCalories: 30,
  proteinPercentageOfCalories: 20,
});

export const macronutrientCaloriesPerGram = Object.freeze({
  carbohydrate: 4,
  fat: 9,
  protein: 4,
});

export interface MacronutrientTargets {
  readonly carbohydrateGrams: number;
  readonly fatGrams: number;
  readonly proteinGrams: number;
}

export function calculateDailyMacronutrientTargets(
  dailyCalorieTarget: Energy,
): MacronutrientTargets {
  const kilocalories = dailyCalorieTarget.in('kilocalorie');
  return Object.freeze({
    carbohydrateGrams:
      (kilocalories *
        (macronutrientDistributionPolicy.carbohydratePercentageOfCalories /
          100)) /
      macronutrientCaloriesPerGram.carbohydrate,
    fatGrams:
      (kilocalories *
        (macronutrientDistributionPolicy.fatPercentageOfCalories / 100)) /
      macronutrientCaloriesPerGram.fat,
    proteinGrams:
      (kilocalories *
        (macronutrientDistributionPolicy.proteinPercentageOfCalories / 100)) /
      macronutrientCaloriesPerGram.protein,
  });
}
