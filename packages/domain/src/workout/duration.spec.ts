import { describe, expect, it } from 'vitest';

import { isErr, isOk } from '../shared/result';
import { Duration, durationUnits } from './duration';

describe('Duration', () => {
  it.each([
    ['second', 1, 1],
    ['minute', 1, 60],
    ['hour', 1, 3_600],
  ] as const)('converts %s to canonical seconds', (unit, value, seconds) => {
    const result = Duration.create(value, unit);

    if (isOk(result)) {
      expect(result.value.seconds).toBe(seconds);
      expect(result.value.in(unit)).toBe(value);
    }
  });

  it('compares equivalent durations', () => {
    const hour = Duration.create(1, 'hour');
    const minutes = Duration.create(60, 'minute');

    if (isOk(hour) && isOk(minutes)) {
      expect(hour.value.equals(minutes.value)).toBe(true);
    }
  });

  it.each([
    [Infinity, 'second', 'invalid-number'],
    [-1, 'minute', 'negative-measurement'],
    [1, 'day', 'unsupported-unit'],
  ])('rejects invalid input', (value, unit, code) => {
    const result = Duration.create(value, unit);
    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('accepts zero and freezes the value', () => {
    const result = Duration.create(0, 'second');

    if (isOk(result)) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Reflect.set(result.value, 'seconds', 10)).toBe(false);
    }
  });

  it('publishes supported units', () => {
    expect(durationUnits).toEqual(['second', 'minute', 'hour']);
  });
});
