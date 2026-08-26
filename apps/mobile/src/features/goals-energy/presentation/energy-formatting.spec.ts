import { Energy, isOk } from '@fitness/domain';
import {
  formatBmi,
  formatBmiCategory,
  formatDailyEnergy,
  formatMacronutrientGrams,
} from './energy-formatting';

describe('energy presentation formatting', () => {
  it('centralizes BMI display rounding and category labels', () => {
    expect(formatBmi(24.999)).toBe('25.0');
    expect(formatBmiCategory('healthy-weight')).toBe('Healthy weight');
  });

  it('rounds positive daily energy to the nearest whole kilocalorie', () => {
    const energy = Energy.create(2_000.5, 'kilocalorie');
    if (!isOk(energy)) throw new Error('Invalid fixture.');
    expect(formatDailyEnergy(energy.value)).toBe('2,001 kcal/day');
  });

  it('rounds macronutrient grams the same way daily energy is rounded', () => {
    expect(formatMacronutrientGrams(66.66666666666667)).toBe('67 g');
    expect(formatMacronutrientGrams(1_234.5)).toBe('1,235 g');
  });
});
