import { describe, expect, it } from 'vitest';
import {
  Length,
  Mass,
  activityMultipliers,
  estimateMaintenanceEnergy,
  estimateRestingEnergy,
  isErr,
  isOk,
} from '../index';

function profileMeasurements() {
  const weight = Mass.create(70, 'kilogram');
  const height = Length.create(175, 'centimeter');
  if (!isOk(weight) || !isOk(height)) throw new Error('Invalid test fixture.');
  return { height: height.value, weight: weight.value };
}

describe('energy estimates', () => {
  it('matches Mifflin-St Jeor female and male test vectors', () => {
    const measurements = profileMeasurements();
    const female = estimateRestingEnergy({
      ...measurements,
      age: 30,
      biologicalSex: 'female',
    });
    const male = estimateRestingEnergy({
      ...measurements,
      age: 30,
      biologicalSex: 'male',
    });
    expect(isOk(female) && female.value.in('kilocalorie')).toBe(1482.75);
    expect(isOk(male) && male.value.in('kilocalorie')).toBe(1648.75);
  });

  it('enforces the supported age and biological-sex inputs', () => {
    const measurements = profileMeasurements();
    expect(
      isErr(
        estimateRestingEnergy({
          ...measurements,
          age: 19,
          biologicalSex: 'female',
        }),
      ),
    ).toBe(true);
    expect(
      isOk(
        estimateRestingEnergy({
          ...measurements,
          age: 78,
          biologicalSex: 'male',
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        estimateRestingEnergy({
          ...measurements,
          age: 30,
          biologicalSex: 'prefer-not-to-say',
        }),
      ),
    ).toBe(true);
  });

  it('publishes explicit activity factors and estimates maintenance', () => {
    expect(activityMultipliers).toEqual({
      'extremely-active': 2.2,
      'lightly-active': 1.4,
      'moderately-active': 1.6,
      sedentary: 1.2,
      'very-active': 1.9,
    });
    const resting = estimateRestingEnergy({
      ...profileMeasurements(),
      age: 30,
      biologicalSex: 'female',
    });
    if (!isOk(resting)) throw new Error('Invalid test fixture.');
    const maintenance = estimateMaintenanceEnergy(
      resting.value,
      'moderately-active',
    );
    expect(isOk(maintenance) && maintenance.value.in('kilocalorie')).toBe(
      2372.4,
    );
    expect(isErr(estimateMaintenanceEnergy(resting.value, 'unknown'))).toBe(
      true,
    );
  });
});
