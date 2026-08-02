import {
  calculateAge,
  calculateBmi,
  calculateDailyCalorieTarget,
  DomainError,
  err,
  estimateMaintenanceEnergy,
  estimateRestingEnergy,
  isErr,
  ok,
  type BmiResult,
  type Energy,
  type GoalConfiguration,
  type Result,
  type UserProfile,
} from '@fitness/domain';

export type EnergySummary = Readonly<{
  age: number;
  bmi: BmiResult;
  goal: GoalConfiguration | null;
  maintenanceEnergy: Energy;
  restingEnergy: Energy;
  target: Result<Energy, DomainError> | null;
}>;

export type EnergySummaryOutcome =
  | Readonly<{ status: 'profile-required' }>
  | Readonly<{
      bmi?: BmiResult;
      reason: DomainError;
      status: 'calculation-unavailable';
    }>
  | Readonly<{ status: 'ready'; summary: EnergySummary }>;

export function deriveEnergySummary(
  profile: UserProfile,
  goal: GoalConfiguration | null,
  asOfDate: string,
): EnergySummaryOutcome {
  const age = calculateAge(profile.dateOfBirth, asOfDate);
  if (isErr(age))
    return { reason: age.error, status: 'calculation-unavailable' };

  if (age.value < 20) {
    return {
      reason: DomainError.create(
        'out-of-range',
        'Adult goals and energy calculations are available from age 20.',
        'age',
      ),
      status: 'calculation-unavailable',
    };
  }

  const bmi = calculateBmi(profile.weight, profile.height);
  if (isErr(bmi))
    return { reason: bmi.error, status: 'calculation-unavailable' };
  const restingEnergy = estimateRestingEnergy({
    age: age.value,
    biologicalSex: profile.biologicalSex,
    height: profile.height,
    weight: profile.weight,
  });
  if (isErr(restingEnergy)) {
    return {
      bmi: bmi.value,
      reason: restingEnergy.error,
      status: 'calculation-unavailable',
    };
  }
  const maintenanceEnergy = estimateMaintenanceEnergy(
    restingEnergy.value,
    profile.activityLevel,
  );
  if (isErr(maintenanceEnergy)) {
    return {
      bmi: bmi.value,
      reason: maintenanceEnergy.error,
      status: 'calculation-unavailable',
    };
  }

  return {
    status: 'ready',
    summary: Object.freeze({
      age: age.value,
      bmi: bmi.value,
      goal,
      maintenanceEnergy: maintenanceEnergy.value,
      restingEnergy: restingEnergy.value,
      target: goal
        ? calculateDailyCalorieTarget(maintenanceEnergy.value, goal)
        : null,
    }),
  };
}

export function validateGoalForSummary(
  outcome: EnergySummaryOutcome,
  goal: GoalConfiguration,
): Result<GoalConfiguration, readonly DomainError[]> {
  if (outcome.status !== 'ready') {
    return err(
      Object.freeze([
        outcome.status === 'calculation-unavailable'
          ? outcome.reason
          : DomainError.create(
              'required-field',
              'Complete your profile before saving a goal.',
              'profile',
            ),
      ]),
    );
  }
  const target = calculateDailyCalorieTarget(
    outcome.summary.maintenanceEnergy,
    goal,
  );
  return isErr(target)
    ? { error: Object.freeze([target.error]), isSuccess: false }
    : ok(goal);
}
