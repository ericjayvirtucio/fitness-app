import { describe, expect, it } from 'vitest';

import { isErr, isOk } from '../result';
import { Length, lengthUnits } from './length';

describe('Length', () => {
  it.each([
    ['millimeter', 1, 1],
    ['centimeter', 1, 10],
    ['meter', 1, 1_000],
    ['inch', 1, 25.4],
    ['foot', 1, 304.8],
  ] as const)(
    'converts %s to canonical millimeters',
    (unit, value, millimeters) => {
      const result = Length.create(value, unit);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.millimeters).toBe(millimeters);
        expect(result.value.in(unit)).toBeCloseTo(value, 12);
      }
    },
  );

  it('compares canonical values', () => {
    const meter = Length.create(1, 'meter');
    const centimeters = Length.create(100, 'centimeter');

    if (isOk(meter) && isOk(centimeters)) {
      expect(meter.value.equals(centimeters.value)).toBe(true);
    }
  });

  it.each([
    [undefined, 'meter', 'invalid-number'],
    [Number.NEGATIVE_INFINITY, 'meter', 'invalid-number'],
    [-0.1, 'meter', 'negative-measurement'],
    [1, 'yard', 'unsupported-unit'],
  ])('rejects invalid input', (value, unit, code) => {
    const result = Length.create(value, unit);

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('freezes valid values', () => {
    const result = Length.create(0, 'millimeter');

    if (isOk(result)) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Reflect.set(result.value, 'millimeters', 10)).toBe(false);
    }
  });

  it('publishes supported units', () => {
    expect(lengthUnits).toHaveLength(5);
  });
});
