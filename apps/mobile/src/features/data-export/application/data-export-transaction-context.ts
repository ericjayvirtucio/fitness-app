import type { BodyWeightExportReader } from '../../body-measurement-history/application/body-weight-export-reader';
import type { ExerciseCatalogExportReader } from '../../exercise-catalog/application/exercise-catalog-export-reader';
import type { GoalRepository } from '../../goals-energy/application/goal-repository';
import type { HydrationExportReader } from '../../hydration-tracking/application/hydration-export-reader';
import type { HydrationTargetRepository } from '../../hydration-tracking/application/hydration-target-repository';
import type { NutritionExportReader } from '../../nutrition-logging/application/nutrition-export-reader';
import type { PersonalProfileRepository } from '../../personal-profile/application/personal-profile-repository';
import type { WorkoutPlannerRepository } from '../../workout-planner/application/workout-planner-repository';
import type { WorkoutSessionExportReader } from '../../workout-history/application/workout-session-export-reader';
import type { WorkoutSessionRepository } from '../../workout-session/application/workout-session-repository';

/**
 * Every capability contract an export reads, composed from one exclusive
 * SQLite transaction so a single file cannot contain a mutually inconsistent
 * set of related records. The exporter owns no table and issues no SQL of its
 * own; each capability still decides what it exposes.
 */
export type DataExportTransactionContext = Readonly<{
  bodyWeight: BodyWeightExportReader;
  exerciseCatalog: ExerciseCatalogExportReader;
  goals: GoalRepository;
  hydrationEntries: HydrationExportReader;
  hydrationTarget: HydrationTargetRepository;
  nutrition: NutritionExportReader;
  planner: WorkoutPlannerRepository;
  profile: PersonalProfileRepository;
  workoutHistory: WorkoutSessionExportReader;
  workoutSessions: WorkoutSessionRepository;
}>;
