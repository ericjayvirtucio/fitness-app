import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';
import type { BodyWeightEntryRepository } from '../../body-measurement-history/application/body-weight-entry-repository';
import type { ExerciseCatalogRepository } from '../../exercise-catalog/application/exercise-catalog-repository';
import type { GoalRepository } from '../../goals-energy/application/goal-repository';
import type { HydrationEntryRepository } from '../../hydration-tracking/application/hydration-entry-repository';
import type { HydrationTargetRepository } from '../../hydration-tracking/application/hydration-target-repository';
import type { ConsumptionEntryRepository } from '../../nutrition-logging/application/consumption-entry-repository';
import type { NutritionCatalogRepository } from '../../nutrition-logging/application/nutrition-catalog-repository';
import type { PersonalProfileRepository } from '../../personal-profile/application/personal-profile-repository';
import type { WorkoutPlannerRepository } from '../../workout-planner/application/workout-planner-repository';
import type { WorkoutSessionRepository } from '../../workout-session/application/workout-session-repository';

/**
 * Every capability contract a restore touches, composed from one exclusive
 * SQLite transaction so the whole file lands or none of it does.
 *
 * The writes are each capability's existing repository method. Those already
 * preserve identifiers, favourite and usage state, snapshots, and occurrence
 * context, so a parallel set of restore-only writers would duplicate working
 * code and grow the public surface for nothing. The coordinator owns no table
 * and issues no SQL of its own.
 */
export type DataRestoreTransactionContext = Readonly<{
  bodyWeight: BodyWeightEntryRepository;
  exerciseCatalog: ExerciseCatalogRepository;
  goals: GoalRepository;
  hydrationEntries: HydrationEntryRepository;
  hydrationTarget: HydrationTargetRepository;
  nutritionCatalog: NutritionCatalogRepository;
  nutritionEntries: ConsumptionEntryRepository;
  planner: WorkoutPlannerRepository;
  /** One per capability, so "empty" cannot quietly mean "no profile". */
  probes: readonly StoredDataProbe[];
  profile: PersonalProfileRepository;
  sessions: WorkoutSessionRepository;
}>;
