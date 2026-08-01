import { describe, expect, it } from 'vitest';

import { isErr, isOk } from '../result';
import { Volume, volumeUnits } from './volume';

describe('Volume', () => {
  it.each([
    ['milliliter', 1, 1],
    ['liter', 1, 1_000],
    ['us-fluid-ounce', 1, 29.5735295625],
  ] as const)(
    'converts %s to canonical milliliters',
    (unit, value, milliliters) => {
      const result = Volume.create(value, unit);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.milliliters).toBe(milliliters);
        expect(result.value.in(unit)).toBeCloseTo(value, 12);
      }
    },
  );

  it('compares equivalent and different volumes', () => {
    const liters = Volume.create(1, 'liter');
    const milliliters = Volume.create(1_000, 'milliliter');
    const different = Volume.create(500, 'milliliter');

    if (isOk(liters) && isOk(milliliters) && isOk(different)) {
      expect(liters.value.equals(milliliters.value)).toBe(true);
      expect(liters.value.equals(different.value)).toBe(false);
    }
  });

  it.each([
    [NaN, 'milliliter', 'invalid-number'],
    [Infinity, 'liter', 'invalid-number'],
    [-1, 'milliliter', 'negative-measurement'],
    [1, 'imperial-fluid-ounce', 'unsupported-unit'],
  ])('rejects invalid input', (value, unit, code) => {
    const result = Volume.create(value, unit);

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('accepts zero and freezes the value', () => {
    const result = Volume.create(0, 'milliliter');

    if (isOk(result)) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Reflect.set(result.value, 'milliliters', 10)).toBe(false);
    }
  });

  it('publishes supported units', () => {
    expect(volumeUnits).toEqual(['milliliter', 'liter', 'us-fluid-ounce']);
  });
});
