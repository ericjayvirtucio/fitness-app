import type {
  BodyWeightEntry,
  ConsumptionEntry,
  GoalConfiguration,
  HydrationEntry,
  HydrationTarget,
  PlannedWorkout,
  UserProfile,
  WorkoutSession,
} from '@fitness/domain';
import type { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import type { NutritionCatalogItem } from '../../nutrition-logging/application/nutrition-catalog-item';

/**
 * A validated export, held as domain records rather than parsed primitives.
 *
 * Everything here has already passed structural validation, domain
 * reconstruction, and referential checks, so the write phase interprets
 * nothing: it only hands each record to the capability that owns it.
 */
export type RestoreData = Readonly<{
  activeSession: WorkoutSession | null;
  bodyWeightCheckIns: readonly BodyWeightEntry[];
  completedSessions: readonly WorkoutSession[];
  exercises: readonly ExerciseCatalogItem[];
  goal: GoalConfiguration | null;
  hydrationEntries: readonly HydrationEntry[];
  hydrationTarget: HydrationTarget | null;
  nutritionCatalogItems: readonly NutritionCatalogItem[];
  nutritionEntries: readonly ConsumptionEntry[];
  plannedWorkouts: readonly PlannedWorkout[];
  profile: UserProfile | null;
}>;

/**
 * What the user reviews before confirming. Counts and presence only: showing a
 * weight, a meal, or a date would put personal information on screen to answer
 * a question that "12 weight check-ins" already answers.
 */
export type DataRestorePreview = Readonly<{
  bodyWeightCheckIns: number;
  completedWorkouts: number;
  exercises: number;
  /** The export's own creation instant, so the user can confirm the file. */
  generatedAt: string;
  hasActiveWorkout: boolean;
  hasGoal: boolean;
  hasHydrationTarget: boolean;
  hasProfile: boolean;
  hydrationEntries: number;
  nutritionCatalogItems: number;
  nutritionEntries: number;
  plannedWorkouts: number;
}>;

export type ParsedDataExport = Readonly<{
  data: RestoreData;
  preview: DataRestorePreview;
}>;

export function toDataRestorePreview(
  data: RestoreData,
  generatedAt: string,
): DataRestorePreview {
  return Object.freeze({
    bodyWeightCheckIns: data.bodyWeightCheckIns.length,
    completedWorkouts: data.completedSessions.length,
    exercises: data.exercises.length,
    generatedAt,
    hasActiveWorkout: data.activeSession !== null,
    hasGoal: data.goal !== null,
    hasHydrationTarget: data.hydrationTarget !== null,
    hasProfile: data.profile !== null,
    hydrationEntries: data.hydrationEntries.length,
    nutritionCatalogItems: data.nutritionCatalogItems.length,
    nutritionEntries: data.nutritionEntries.length,
    plannedWorkouts: data.plannedWorkouts.length,
  });
}
