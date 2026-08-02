import { describe, expect, it } from 'vitest';
import { Length, Mass, calculateBmi, classifyBmi, isOk } from '../index';

function validMeasurements(weightKilograms: number, heightMeters: number) {
  const weight = Mass.create(weightKilograms, 'kilogram');
  const height = Length.create(heightMeters, 'meter');
  if (!isOk(weight) || !isOk(height)) throw new Error('Invalid test fixture.');
  return { height: height.value, weight: weight.value };
}

describe('BMI', () => {
  it('calculates from canonical measurements without rounding', () => {
    const { height, weight } = validMeasurements(70, 1.75);
    const result = calculateBmi(weight, height);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.value).toBeCloseTo(22.8571428571, 10);
      expect(result.value.category).toBe('healthy-weight');
      expect(Object.isFrozen(result.value)).toBe(true);
    }
  });

  it.each([
    [18.4999, 'underweight'],
    [18.5, 'healthy-weight'],
    [24.9999, 'healthy-weight'],
    [25, 'overweight'],
    [29.9999, 'overweight'],
    [30, 'obesity'],
  ] as const)('classifies the raw boundary %s as %s', (value, category) => {
    expect(classifyBmi(value)).toBe(category);
  });

  it('rejects zero height or weight', () => {
    const { height, weight } = validMeasurements(0, 0);
    expect(calculateBmi(weight, height)).toMatchObject({ isSuccess: false });
  });
});
