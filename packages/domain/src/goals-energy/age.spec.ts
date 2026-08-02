import { describe, expect, it } from 'vitest';
import { calculateAge, isErr, isOk } from '../index';

describe('calculateAge', () => {
  it('changes age exactly on the birthday boundary', () => {
    expect(calculateAge('1990-08-03', '2026-08-02')).toEqual({
      isSuccess: true,
      value: 35,
    });
    expect(calculateAge('1990-08-02', '2026-08-02')).toEqual({
      isSuccess: true,
      value: 36,
    });
  });

  it('advances a leap-day birthday on March 1 in a non-leap year', () => {
    expect(calculateAge('2000-02-29', '2026-02-28')).toEqual({
      isSuccess: true,
      value: 25,
    });
    expect(calculateAge('2000-02-29', '2026-03-01')).toEqual({
      isSuccess: true,
      value: 26,
    });
  });

  it('rejects invalid dates and future births', () => {
    expect(isErr(calculateAge('2000-02-30', '2026-08-02'))).toBe(true);
    expect(isErr(calculateAge('2030-01-01', '2026-08-02'))).toBe(true);
    expect(isOk(calculateAge('2000-02-29', '2024-02-29'))).toBe(true);
  });
});
