import { DomainError } from '../shared/domain-error';
import type { Length } from '../shared/measurement/length';
import type { Mass } from '../shared/measurement/mass';
import { err, ok, type Result } from '../shared/result';

export const bmiCategories = Object.freeze([
  'underweight',
  'healthy-weight',
  'overweight',
  'obesity',
] as const);
export type BmiCategory = (typeof bmiCategories)[number];
export type BmiResult = Readonly<{ category: BmiCategory; value: number }>;

export function classifyBmi(value: number): BmiCategory {
  if (value < 18.5) return 'underweight';
  if (value < 25) return 'healthy-weight';
  if (value < 30) return 'overweight';
  return 'obesity';
}

export function calculateBmi(
  weight: Mass,
  height: Length,
): Result<BmiResult, DomainError> {
  const kilograms = weight.in('kilogram');
  const meters = height.in('meter');
  if (kilograms <= 0 || meters <= 0) {
    return err(
      DomainError.create(
        'out-of-range',
        'BMI requires positive height and weight.',
        'profile',
      ),
    );
  }
  const value = kilograms / meters ** 2;
  if (!Number.isFinite(value)) {
    return err(
      DomainError.create(
        'invalid-number',
        'BMI could not be calculated.',
        'profile',
      ),
    );
  }
  return ok(Object.freeze({ category: classifyBmi(value), value }));
}
