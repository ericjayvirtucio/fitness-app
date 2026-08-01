import { describe, expect, it } from 'vitest';

import { isErr, isOk } from '../shared/result';
import { Energy, energyUnits } from './energy';

describe('Energy', () => {
  it('converts kilocalories to canonical kilojoules', () => {
    const result = Energy.create(100, 'kilocalorie');

    if (isOk(result)) {
      expect(result.value.kilojoules).toBeCloseTo(418.4, 12);
      expect(result.value.in('kilocalorie')).toBeCloseTo(100, 12);
    }
  });

  it('compares equivalent energy values', () => {
    const kilocalories = Energy.create(100, 'kilocalorie');
    const kilojoules = Energy.create(418.4, 'kilojoule');

    if (isOk(kilocalories) && isOk(kilojoules)) {
      expect(kilocalories.value.equals(kilojoules.value)).toBe(true);
    }
  });

  it.each([
    [NaN, 'kilojoule', 'invalid-number'],
    [-1, 'kilocalorie', 'negative-measurement'],
    [1, 'calorie', 'unsupported-unit'],
  ])('rejects invalid input', (value, unit, code) => {
    const result = Energy.create(value, unit);
    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('accepts zero and freezes the value', () => {
    const result = Energy.create(0, 'kilojoule');

    if (isOk(result)) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Reflect.set(result.value, 'kilojoules', 10)).toBe(false);
    }
  });

  it('publishes supported units', () => {
    expect(energyUnits).toEqual(['kilojoule', 'kilocalorie']);
  });
});
