export { DomainError, domainErrorCodes } from './shared/domain-error';
export type { DomainErrorCode } from './shared/domain-error';
export { DomainId } from './shared/domain-id';
export { isErr, isOk, err, ok } from './shared/result';
export type { Result } from './shared/result';

export {
  activityLevels,
  biologicalSexes,
  unitSystems,
} from './personal-profile/profile-options';
export type {
  ActivityLevel,
  BiologicalSex,
  UnitSystem,
} from './personal-profile/profile-options';
export { profileLimits, UserProfile } from './personal-profile/user-profile';
export type {
  UserProfileInput,
  UserProfileValidationErrors,
} from './personal-profile/user-profile';

export { calculateAge } from './goals-energy/age';
export { bmiCategories, calculateBmi, classifyBmi } from './goals-energy/bmi';
export type { BmiCategory, BmiResult } from './goals-energy/bmi';
export {
  activityMultipliers,
  energyCalculationAgeRange,
  estimateMaintenanceEnergy,
  estimateRestingEnergy,
} from './goals-energy/energy-estimates';
export type { RestingEnergyInput } from './goals-energy/energy-estimates';
export {
  calorieAdjustmentPolicy,
  calculateDailyCalorieTarget,
  GoalConfiguration,
  goalTypes,
} from './goals-energy/goal-configuration';
export type { GoalType } from './goals-energy/goal-configuration';

export { Length, lengthUnits } from './shared/measurement/length';
export type { LengthUnit } from './shared/measurement/length';
export { Mass, massUnits } from './shared/measurement/mass';
export type { MassUnit } from './shared/measurement/mass';
export { Volume, volumeUnits } from './shared/measurement/volume';
export type { VolumeUnit } from './shared/measurement/volume';

export { Energy, energyUnits } from './nutrition/energy';
export type { EnergyUnit } from './nutrition/energy';
export {
  ConsumptionEntry,
  consumptionEntryKinds,
} from './nutrition/consumption-entry';
export type {
  ConsumptionEntryInput,
  ConsumptionEntryKind,
} from './nutrition/consumption-entry';
export { summarizeConsumptionEntries } from './nutrition/daily-nutrition-summary';
export type { DailyNutritionSummary } from './nutrition/daily-nutrition-summary';
export {
  NutritionFacts,
  nutritionProvenances,
  scaleNutritionFacts,
} from './nutrition/nutrition-facts';
export type {
  NutrientAmounts,
  NutritionFactsInput,
  NutritionProvenance,
  NutritionReference,
} from './nutrition/nutrition-facts';
export { Duration, durationUnits } from './workout/duration';
export type { DurationUnit } from './workout/duration';
