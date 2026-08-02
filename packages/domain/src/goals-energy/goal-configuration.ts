import { Energy } from '../nutrition/energy';
import { DomainError } from '../shared/domain-error';
import { err, isErr, ok, type Result } from '../shared/result';

export const goalTypes = Object.freeze([
  'lose-weight',
  'maintain-weight',
  'gain-weight',
] as const);
export type GoalType = (typeof goalTypes)[number];
export const calorieAdjustmentPolicy = Object.freeze({
  maximumKilocalories: 500,
  maximumMaintenanceFraction: 0.25,
  minimumDailyTargetKilocalories: 1_000,
  minimumKilocalories: 100,
});

export class GoalConfiguration {
  private constructor(
    readonly type: GoalType,
    readonly adjustmentKilocalories: number,
  ) {
    Object.freeze(this);
  }

  static create(
    type: unknown,
    adjustmentKilocalories: unknown,
  ): Result<GoalConfiguration, DomainError> {
    if (typeof type !== 'string' || !goalTypes.includes(type as GoalType)) {
      return err(
        DomainError.create(
          'unsupported-option',
          'Choose a supported goal.',
          'goalType',
        ),
      );
    }
    if (
      typeof adjustmentKilocalories !== 'number' ||
      !Number.isInteger(adjustmentKilocalories)
    ) {
      return err(
        DomainError.create(
          'invalid-number',
          'Enter a whole-number calorie adjustment.',
          'adjustmentKilocalories',
        ),
      );
    }
    if (type === 'maintain-weight' && adjustmentKilocalories !== 0) {
      return err(
        DomainError.create(
          'out-of-range',
          'Maintain weight does not use a calorie adjustment.',
          'adjustmentKilocalories',
        ),
      );
    }
    if (
      type !== 'maintain-weight' &&
      (adjustmentKilocalories < calorieAdjustmentPolicy.minimumKilocalories ||
        adjustmentKilocalories > calorieAdjustmentPolicy.maximumKilocalories)
    ) {
      return err(
        DomainError.create(
          'out-of-range',
          'Calorie adjustment must be between 100 and 500 kilocalories.',
          'adjustmentKilocalories',
        ),
      );
    }
    return ok(new GoalConfiguration(type as GoalType, adjustmentKilocalories));
  }
}

export function calculateDailyCalorieTarget(
  maintenanceEnergy: Energy,
  goal: GoalConfiguration,
): Result<Energy, DomainError> {
  const maintenanceKilocalories = maintenanceEnergy.in('kilocalorie');
  if (
    goal.adjustmentKilocalories >
    maintenanceKilocalories * calorieAdjustmentPolicy.maximumMaintenanceFraction
  ) {
    return err(
      DomainError.create(
        'out-of-range',
        'Calorie adjustment cannot exceed 25% of estimated maintenance.',
        'adjustmentKilocalories',
      ),
    );
  }
  const direction =
    goal.type === 'lose-weight' ? -1 : goal.type === 'gain-weight' ? 1 : 0;
  const targetKilocalories =
    maintenanceKilocalories + direction * goal.adjustmentKilocalories;
  if (
    targetKilocalories < calorieAdjustmentPolicy.minimumDailyTargetKilocalories
  ) {
    return err(
      DomainError.create(
        'out-of-range',
        'Daily calorie target must be at least 1,000 kilocalories.',
        'adjustmentKilocalories',
      ),
    );
  }
  const target = Energy.create(targetKilocalories, 'kilocalorie');
  return isErr(target) ? target : ok(target.value);
}
