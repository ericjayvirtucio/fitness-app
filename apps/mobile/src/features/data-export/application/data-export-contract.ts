import type {
  ActivityLevel,
  BiologicalSex,
  ConsumptionEntryKind,
  ExerciseEquipment,
  ExerciseLoggingMode,
  ExerciseMuscleGroup,
  GoalType,
  HydrationFluidType,
  NutritionProvenance,
  UnitSystem,
  WeekdayValue,
  WorkoutSessionStatus,
} from '@fitness/domain';

/**
 * Version 2 of the public export contract.
 *
 * This is a compatibility promise to whoever reads a saved file, so it is
 * deliberately independent of the SQLite migration version and of internal
 * table, column, and class names. Any change to the shape below increments
 * `dataExportFormatVersion`.
 *
 * Version 2 adds one field, `ExportedWorkoutSet.repsInReserve`. Every other
 * shape is unchanged from version 1. `parse-data-export.ts` still reads
 * version 1 files, mapping their sets to an absent reps-in-reserve
 * observation, exactly as a person's own installation always did before this
 * field existed.
 */
export const dataExportFormat = 'fitness-app-data-export';
export const dataExportFormatVersion = 2;

export const dataExportMediaType = 'application/json';
export const dataExportUniformTypeIdentifier = 'public.json';

export type ExportedApplication = Readonly<{
  name: string;
  /** Build metadata only. It carries no compatibility meaning. */
  version: string | null;
}>;

export type ExportedOccurrence = Readonly<{
  localCalendarDate: string;
  occurredAtEpochMilliseconds: number;
  utcOffsetMinutes: number;
}>;

export type ExportedProfile = Readonly<{
  activityLevel: ActivityLevel;
  biologicalSex: BiologicalSex;
  dateOfBirth: string;
  heightMillimeters: number;
  preferredUnitSystem: UnitSystem;
  weightGrams: number;
}>;

export type ExportedGoal = Readonly<{
  adjustmentKilocalories: number;
  goalType: GoalType;
}>;

export type ExportedQuantity =
  | Readonly<{ amountGrams: number; kind: 'mass' }>
  | Readonly<{ amountMilliliters: number; kind: 'volume' }>;

/** Amounts describing the reference quantity. `null` means never recorded. */
export type ExportedNutrition = Readonly<{
  carbohydrateGrams: number | null;
  energyKilojoules: number;
  fatGrams: number | null;
  fiberGrams: number | null;
  proteinGrams: number | null;
  sodiumMilligrams: number | null;
  sugarGrams: number | null;
}>;

export type ExportedNutritionEntry = ExportedOccurrence &
  Readonly<{
    consumedQuantity: ExportedQuantity;
    description: string;
    id: string;
    kind: ConsumptionEntryKind;
    provenance: NutritionProvenance;
    reference: ExportedQuantity;
    referenceNutrition: ExportedNutrition;
  }>;

export type ExportedNutritionCatalogItem = Readonly<{
  description: string;
  id: string;
  isFavorite: boolean;
  kind: ConsumptionEntryKind;
  lastUsedAtEpochMilliseconds: number | null;
  provenance: NutritionProvenance;
  reference: ExportedQuantity;
  referenceNutrition: ExportedNutrition;
  useCount: number;
}>;

export type ExportedHydrationEntry = ExportedOccurrence &
  Readonly<{
    description: string | null;
    fluidType: HydrationFluidType;
    id: string;
    volumeMilliliters: number;
  }>;

export type ExportedHydrationTarget = Readonly<{
  targetMilliliters: number;
}>;

export type ExportedExercise = Readonly<{
  equipment: ExerciseEquipment;
  id: string;
  isFavorite: boolean;
  loggingMode: ExerciseLoggingMode;
  name: string;
  notes: string | null;
  primaryMuscleGroup: ExerciseMuscleGroup;
}>;

export type ExportedPrescription =
  | Readonly<{ kind: 'repetitions'; repetitions: number; sets: number }>
  | Readonly<{
      kind: 'resistance-and-repetitions';
      repetitions: number;
      resistanceGrams: number | null;
      sets: number;
    }>
  | Readonly<{ durationSeconds: number; kind: 'duration'; sets: number }>
  | Readonly<{ distanceMillimeters: number; kind: 'distance'; sets: number }>
  | Readonly<{
      distanceMillimeters: number;
      durationSeconds: number;
      kind: 'distance-and-duration';
      sets: number;
    }>;

export type ExportedResult =
  | Readonly<{ kind: 'repetitions'; repetitions: number }>
  | Readonly<{
      kind: 'resistance-and-repetitions';
      repetitions: number;
      resistanceGrams: number;
    }>
  | Readonly<{ durationSeconds: number; kind: 'duration' }>
  | Readonly<{ distanceMillimeters: number; kind: 'distance' }>
  | Readonly<{
      distanceMillimeters: number;
      durationSeconds: number;
      kind: 'distance-and-duration';
    }>;

export type ExportedPlannedExercise = Readonly<{
  exerciseId: string;
  id: string;
  position: number;
  prescription: ExportedPrescription;
}>;

export type ExportedPlannedWorkout = Readonly<{
  exercises: readonly ExportedPlannedExercise[];
  id: string;
  name: string;
  weekday: WeekdayValue;
}>;

export type ExportedWorkoutSet = Readonly<{
  id: string;
  position: number;
  /**
   * The person's own estimate of how many more repetitions they believed
   * they could have performed. `null` means no estimate was recorded — never
   * zero repetitions in reserve. Present only for `repetitions` and
   * `resistance-and-repetitions` results; always `null` otherwise.
   */
  repsInReserve: number | null;
  result: ExportedResult;
}>;

export type ExportedWorkoutSessionExercise = Readonly<{
  id: string;
  loggingModeSnapshot: ExerciseLoggingMode;
  nameSnapshot: string;
  plannedPrescriptionSnapshot: ExportedPrescription | null;
  position: number;
  sets: readonly ExportedWorkoutSet[];
  sourceExerciseId: string;
  sourcePlannedExerciseId: string | null;
}>;

export type ExportedWorkoutSession = Readonly<{
  completedAtEpochMilliseconds: number | null;
  exercises: readonly ExportedWorkoutSessionExercise[];
  id: string;
  name: string;
  sourcePlannedWorkoutId: string | null;
  sourceWeekday: WeekdayValue | null;
  startedAtEpochMilliseconds: number;
  startedLocalCalendarDate: string;
  startedUtcOffsetMinutes: number;
  status: WorkoutSessionStatus;
}>;

export type ExportedBodyWeightCheckIn = ExportedOccurrence &
  Readonly<{
    id: string;
    massGrams: number;
    note: string | null;
  }>;

/** Record totals shown to the user after generation. */
export type DataExportCounts = Readonly<{
  bodyWeightCheckIns: number;
  completedWorkouts: number;
  exercises: number;
  hydrationEntries: number;
  nutritionCatalogItems: number;
  nutritionEntries: number;
  plannedWorkouts: number;
}>;

export const emptyDataExportCounts: DataExportCounts = Object.freeze({
  bodyWeightCheckIns: 0,
  completedWorkouts: 0,
  exercises: 0,
  hydrationEntries: 0,
  nutritionCatalogItems: 0,
  nutritionEntries: 0,
  plannedWorkouts: 0,
});
