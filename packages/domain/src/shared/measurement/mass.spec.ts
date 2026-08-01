import { describe, expect, it } from 'vitest';

import { isErr, isOk } from '../result';
import { Mass, massUnits } from './mass';

describe('Mass', () => {
  it.each([
    ['milligram', 1_000, 1],
    ['gram', 1, 1],
    ['kilogram', 1, 1_000],
    ['ounce', 1, 28.349523125],
    ['pound', 1, 453.59237],
  ] as const)('converts %s to canonical grams', (unit, value, grams) => {
    const result = Mass.create(value, unit);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.grams).toBe(grams);
      expect(result.value.in(unit)).toBeCloseTo(value, 12);
    }
  });

  it('treats equivalent units as equal', () => {
    const kilograms = Mass.create(1, 'kilogram');
    const grams = Mass.create(1_000, 'gram');

    if (isOk(kilograms) && isOk(grams)) {
      expect(kilograms.value.equals(grams.value)).toBe(true);
    }
  });

  it.each([NaN, Infinity, -Infinity, '12', null])(
    'rejects a non-finite numeric value: %s',
    (value) => {
      const result = Mass.create(value, 'gram');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error.code).toBe('invalid-number');
    },
  );

  it('rejects negative and overflowing measurements', () => {
    const negative = Mass.create(-1, 'gram');
    const overflowing = Mass.create(Number.MAX_VALUE, 'kilogram');
    const underflowing = Mass.create(Number.MIN_VALUE, 'milligram');

    expect(isErr(negative) && negative.error.code).toBe('negative-measurement');
    expect(isErr(overflowing) && overflowing.error.code).toBe('invalid-number');
    expect(isErr(underflowing) && underflowing.error.code).toBe(
      'invalid-number',
    );
  });

  it('rejects unsupported units', () => {
    const result = Mass.create(1, 'stone');
    expect(isErr(result) && result.error.code).toBe('unsupported-unit');
  });

  it('accepts zero and freezes the value', () => {
    const result = Mass.create(-0, 'gram');

    if (isOk(result)) {
      expect(result.value.grams).toBe(0);
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Reflect.set(result.value, 'grams', 10)).toBe(false);
    }
  });

  it('does not treat a representable positive value as equal to zero', () => {
    const zero = Mass.create(0, 'gram');
    const positive = Mass.create(Number.MIN_VALUE, 'gram');

    if (isOk(zero) && isOk(positive)) {
      expect(zero.value.equals(positive.value)).toBe(false);
    }
  });

  it('publishes supported units', () => {
    expect(massUnits).toHaveLength(5);
  });
});
