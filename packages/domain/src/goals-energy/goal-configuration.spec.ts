import { describe, expect, it } from 'vitest';
import {
  Energy,
  GoalConfiguration,
  calculateDailyCalorieTarget,
  isErr,
  isOk,
} from '../index';

describe('goal configuration and target', () => {
  it.each([
    ['lose-weight', 300],
    ['maintain-weight', 0],
    ['gain-weight', 250],
  ] as const)('accepts %s with a valid adjustment', (type, adjustment) => {
    const result = GoalConfiguration.create(type, adjustment);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('rejects unsupported and unreasonable static configurations', () => {
    expect(isErr(GoalConfiguration.create('other', 200))).toBe(true);
    expect(isErr(GoalConfiguration.create('maintain-weight', 100))).toBe(true);
    expect(isErr(GoalConfiguration.create('lose-weight', 99))).toBe(true);
    expect(isErr(GoalConfiguration.create('gain-weight', 501))).toBe(true);
    expect(isErr(GoalConfiguration.create('gain-weight', 150.5))).toBe(true);
  });

  it('calculates loss, maintenance, and gain targets from raw maintenance', () => {
    const maintenance = Energy.create(2_000.4, 'kilocalorie');
    if (!isOk(maintenance)) throw new Error('Invalid test fixture.');
    for (const [type, adjustment, expected] of [
      ['lose-weight', 300, 1_700.4],
      ['maintain-weight', 0, 2_000.4],
      ['gain-weight', 300, 2_300.4],
    ] as const) {
      const goal = GoalConfiguration.create(type, adjustment);
      if (!isOk(goal)) throw new Error('Invalid test fixture.');
      const target = calculateDailyCalorieTarget(maintenance.value, goal.value);
      expect(isOk(target) && target.value.in('kilocalorie')).toBeCloseTo(
        expected,
        10,
      );
    }
  });

  it('enforces the percentage cap and minimum target', () => {
    const maintenance = Energy.create(1_200, 'kilocalorie');
    const goal = GoalConfiguration.create('lose-weight', 400);
    if (!isOk(maintenance) || !isOk(goal))
      throw new Error('Invalid test fixture.');
    expect(
      isErr(calculateDailyCalorieTarget(maintenance.value, goal.value)),
    ).toBe(true);

    const lowMaintenance = Energy.create(1_050, 'kilocalorie');
    const smallGoal = GoalConfiguration.create('lose-weight', 100);
    if (!isOk(lowMaintenance) || !isOk(smallGoal))
      throw new Error('Invalid fixture.');
    expect(
      isErr(calculateDailyCalorieTarget(lowMaintenance.value, smallGoal.value)),
    ).toBe(true);
  });
});
