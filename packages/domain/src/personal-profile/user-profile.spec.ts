import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '../shared/result';
import { UserProfile } from './user-profile';

const validInput = {
  activityLevel: 'moderately-active',
  biologicalSex: 'female',
  dateOfBirth: '1990-06-15',
  heightMillimeters: 1_650,
  preferredUnitSystem: 'metric',
  weightGrams: 62_000,
} as const;

describe('UserProfile', () => {
  it('creates an immutable profile with canonical measurements', () => {
    const result = UserProfile.create(validInput, '2026-08-02');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.height.millimeters).toBe(1_650);
      expect(result.value.weight.grams).toBe(62_000);
      expect(Object.isFrozen(result.value)).toBe(true);
    }
  });

  it('returns all actionable validation errors', () => {
    const result = UserProfile.create(
      {
        ...validInput,
        activityLevel: 'unknown',
        biologicalSex: '',
        dateOfBirth: '2027-01-01',
        heightMillimeters: 100,
        preferredUnitSystem: 'customary',
        weightGrams: Number.NaN,
      },
      '2026-08-02',
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.map((error) => error.field)).toEqual([
        'height',
        'weight',
        'dateOfBirth',
        'biologicalSex',
        'activityLevel',
        'preferredUnitSystem',
      ]);
    }
  });

  it.each(['2024-02-30', '06/15/1990', ''])(
    'rejects invalid dates: %s',
    (date) => {
      const result = UserProfile.create(
        { ...validInput, dateOfBirth: date },
        '2026-08-02',
      );
      expect(isErr(result)).toBe(true);
    },
  );
});
