export { DomainError, domainErrorCodes } from './shared/domain-error';
export type { DomainErrorCode } from './shared/domain-error';
export { DomainId } from './shared/domain-id';
export { isErr, isOk, err, ok } from './shared/result';
export type { Result } from './shared/result';

export {
  BodyWeightEntry,
  bodyWeightEntryPolicy,
} from './body-measurement/body-weight-entry';
export type { BodyWeightEntryInput } from './body-measurement/body-weight-entry';

export {
  HydrationEntry,
  hydrationEntryPolicy,
  hydrationFluidTypes,
} from './hydration/hydration-entry';
export type {
  HydrationEntryInput,
  HydrationFluidType,
} from './hydration/hydration-entry';
export {
  HydrationTarget,
  hydrationTargetPolicy,
} from './hydration/hydration-target';
export { summarizeHydrationEntries } from './hydration/daily-hydration-summary';
export type { DailyHydrationSummary } from './hydration/daily-hydration-summary';

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
export {
  calculateDailyMacronutrientTargets,
  macronutrientCaloriesPerGram,
  macronutrientDistributionPolicy,
} from './goals-energy/macro-targets';
export type { MacronutrientTargets } from './goals-energy/macro-targets';

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
export {
  ExerciseDefinition,
  exerciseDefinitionPolicy,
  exerciseEquipment,
  exerciseLoggingModes,
  exerciseMuscleGroups,
} from './workout/exercise-definition';
export type {
  ExerciseDefinitionInput,
  ExerciseEquipment,
  ExerciseLoggingMode,
  ExerciseMuscleGroup,
} from './workout/exercise-definition';
export { Weekday, weekdayValues } from './workout/weekday';
export type { WeekdayValue } from './workout/weekday';
export {
  createPlannedPrescription,
  DistanceDurationPrescription,
  DistancePrescription,
  DurationPrescription,
  isPlannedPrescription,
  plannedPrescriptionPolicy,
  RepetitionPrescription,
  ResistanceRepetitionPrescription,
} from './workout/planned-prescription';
export type {
  PlannedPrescription,
  PlannedPrescriptionInput,
} from './workout/planned-prescription';
export {
  PlannedExercise,
  plannedWorkoutPolicy,
  PlannedWorkout,
  WeeklyWorkoutPlan,
} from './workout/planned-workout';
export type { PlannedDay } from './workout/planned-workout';
export {
  createWorkoutResult,
  DistanceDurationResult,
  DistanceResult,
  DurationResult,
  isWorkoutResult,
  RepetitionResult,
  ResistanceRepetitionResult,
  workoutResultPolicy,
} from './workout/workout-result';
export type { WorkoutResult } from './workout/workout-result';
export {
  WorkoutSession,
  WorkoutSessionExercise,
  workoutSessionPolicy,
  WorkoutSet,
} from './workout/workout-session';
export type { WorkoutSessionStatus } from './workout/workout-session';
