import { describe, expect, it } from 'vitest';

import {
  DomainError,
  DomainId,
  Duration,
  Energy,
  GoalConfiguration,
  Length,
  Mass,
  UserProfile,
  Volume,
  activityMultipliers,
  bmiCategories,
  calculateAge,
  calculateBmi,
  calculateDailyCalorieTarget,
  err,
  estimateMaintenanceEnergy,
  estimateRestingEnergy,
  goalTypes,
  isErr,
  isOk,
  ok,
} from './index';

describe('@fitness/domain public API', () => {
  it('exports every approved runtime concept', () => {
    expect([
      DomainError,
      DomainId,
      Duration,
      Energy,
      GoalConfiguration,
      Length,
      Mass,
      UserProfile,
      Volume,
      activityMultipliers,
      bmiCategories,
      calculateAge,
      calculateBmi,
      calculateDailyCalorieTarget,
      err,
      estimateMaintenanceEnergy,
      estimateRestingEnergy,
      goalTypes,
      isErr,
      isOk,
      ok,
    ]).not.toContain(undefined);
  });
});
