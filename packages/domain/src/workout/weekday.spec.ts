import { describe, expect, it } from 'vitest';

import { Weekday, weekdayValues } from './weekday';

describe('Weekday', () => {
  it('defines an immutable Sunday-first week', () => {
    expect(weekdayValues).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(Object.isFrozen(weekdayValues)).toBe(true);
    expect(Weekday.create(0)).toMatchObject({
      isSuccess: true,
      value: { value: 0 },
    });
    expect(Weekday.create(6)).toMatchObject({
      isSuccess: true,
      value: { value: 6 },
    });
  });

  it.each([-1, 7, 1.5, 'monday', null])('rejects invalid day %p', (value) => {
    expect(Weekday.create(value)).toMatchObject({
      error: { field: 'weekday' },
      isSuccess: false,
    });
  });
});
