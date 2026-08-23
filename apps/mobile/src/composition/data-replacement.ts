import { BodyWeightEntrySqliteRepository } from '../features/body-measurement-history/infrastructure/body-weight-entry-sqlite-repository';
import { BodyWeightDataEraser } from '../features/body-measurement-history/infrastructure/body-weight-data-eraser';
import { BodyWeightStoredDataProbe } from '../features/body-measurement-history/infrastructure/body-weight-stored-data-probe';
import { CreateRecoveryExportUseCase } from '../features/data-lifecycle/application/create-recovery-export-use-case';
import type { LocalDataReplacementTransactionContext } from '../features/data-lifecycle/application/local-data-replacement-transaction-context';
import { ReplaceLocalDataUseCase } from '../features/data-lifecycle/application/replace-local-data-use-case';
import { ExerciseCatalogDataEraser } from '../features/exercise-catalog/infrastructure/exercise-catalog-data-eraser';
import { ExerciseCatalogSqliteRepository } from '../features/exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { ExerciseCatalogStoredDataProbe } from '../features/exercise-catalog/infrastructure/exercise-catalog-stored-data-probe';
import { GoalDataEraser } from '../features/goals-energy/infrastructure/goal-data-eraser';
import { GoalSqliteRepository } from '../features/goals-energy/infrastructure/goal-sqlite-repository';
import { GoalStoredDataProbe } from '../features/goals-energy/infrastructure/goal-stored-data-probe';
import { HydrationDataEraser } from '../features/hydration-tracking/infrastructure/hydration-data-eraser';
import { HydrationEntrySqliteRepository } from '../features/hydration-tracking/infrastructure/hydration-entry-sqlite-repository';
import { HydrationStoredDataProbe } from '../features/hydration-tracking/infrastructure/hydration-stored-data-probe';
import { HydrationTargetSqliteRepository } from '../features/hydration-tracking/infrastructure/hydration-target-sqlite-repository';
import { ConsumptionEntrySqliteRepository } from '../features/nutrition-logging/infrastructure/consumption-entry-sqlite-repository';
import { NutritionCatalogSqliteRepository } from '../features/nutrition-logging/infrastructure/nutrition-catalog-sqlite-repository';
import { NutritionDataEraser } from '../features/nutrition-logging/infrastructure/nutrition-data-eraser';
import { NutritionStoredDataProbe } from '../features/nutrition-logging/infrastructure/nutrition-stored-data-probe';
import { PersonalProfileDataEraser } from '../features/personal-profile/infrastructure/personal-profile-data-eraser';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { PersonalProfileStoredDataProbe } from '../features/personal-profile/infrastructure/personal-profile-stored-data-probe';
import { WorkoutPlannerDataEraser } from '../features/workout-planner/infrastructure/workout-planner-data-eraser';
import { WorkoutPlannerSqliteRepository } from '../features/workout-planner/infrastructure/workout-planner-sqlite-repository';
import { WorkoutPlannerStoredDataProbe } from '../features/workout-planner/infrastructure/workout-planner-stored-data-probe';
import { WorkoutSessionDataEraser } from '../features/workout-session/infrastructure/workout-session-data-eraser';
import { WorkoutSessionSqliteRepository } from '../features/workout-session/infrastructure/workout-session-sqlite-repository';
import { WorkoutSessionStoredDataProbe } from '../features/workout-session/infrastructure/workout-session-stored-data-probe';
import { SqliteStorageCompactor } from '../infrastructure/persistence/sqlite-storage-compactor';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { clearOutbox } from '../infrastructure/persistence/sync-outbox';
import { createDataExportUseCases } from './data-export';
import { createDataRestoreUseCases } from './data-restore';
import { getDatabase, getDeviceId, initializePersistence } from './persistence';

/**
 * Replacement is the existing export, restore, and erasure mechanisms under one
 * workflow, so it composes the existing composition roots rather than rebuilding
 * them: file selection, parsing, recovery export generation, and sharing are the
 * very same use cases the export and restore screens run.
 *
 * Only the replacement transaction is new here, and it puts the erasers, the
 * probes, and the repositories on one exclusive transaction connection so the
 * deletion, the writes, and the checks that they worked cannot disagree about
 * what the database held.
 */
export async function createDataReplacementUseCases() {
  await initializePersistence();
  const [database, deviceId, exports, restores] = await Promise.all([
    getDatabase(),
    getDeviceId(),
    createDataExportUseCases(),
    createDataRestoreUseCases(),
  ]);
  const now = () => new Date();

  const transactionRunner =
    new SqliteTransactionRunner<LocalDataReplacementTransactionContext>(
      database,
      (transaction) => {
        const probes = {
          bodyWeight: new BodyWeightStoredDataProbe(transaction),
          exerciseCatalog: new ExerciseCatalogStoredDataProbe(transaction),
          goal: new GoalStoredDataProbe(transaction),
          hydration: new HydrationStoredDataProbe(transaction),
          nutrition: new NutritionStoredDataProbe(transaction),
          personalProfile: new PersonalProfileStoredDataProbe(transaction),
          workoutPlanner: new WorkoutPlannerStoredDataProbe(transaction),
          workoutSession: new WorkoutSessionStoredDataProbe(transaction),
        };

        return {
          clearOutbox: () => clearOutbox(transaction),
          // Ordered so a referencing row is always gone before what it
          // references: sets before session exercises before sessions, planned
          // exercises before both their workout and the catalog definition they
          // point at.
          erasers: [
            new WorkoutSessionDataEraser(transaction),
            new WorkoutPlannerDataEraser(transaction),
            new ExerciseCatalogDataEraser(transaction),
            new NutritionDataEraser(transaction),
            new HydrationDataEraser(transaction),
            new BodyWeightDataEraser(transaction),
            new GoalDataEraser(transaction),
            new PersonalProfileDataEraser(transaction),
          ],
          presence: probes,
          target: {
            bodyWeight: new BodyWeightEntrySqliteRepository(
              transaction,
              deviceId,
              now,
            ),
            exerciseCatalog: new ExerciseCatalogSqliteRepository(
              transaction,
              deviceId,
              now,
            ),
            goals: new GoalSqliteRepository(transaction, deviceId, now),
            hydrationEntries: new HydrationEntrySqliteRepository(
              transaction,
              deviceId,
              now,
            ),
            hydrationTarget: new HydrationTargetSqliteRepository(
              transaction,
              deviceId,
              now,
            ),
            nutritionCatalog: new NutritionCatalogSqliteRepository(
              transaction,
              deviceId,
              now,
            ),
            nutritionEntries: new ConsumptionEntrySqliteRepository(
              transaction,
              deviceId,
              now,
            ),
            planner: new WorkoutPlannerSqliteRepository(
              transaction,
              deviceId,
              now,
            ),
            probes: [
              probes.personalProfile,
              probes.goal,
              probes.nutrition,
              probes.hydration,
              probes.exerciseCatalog,
              probes.workoutPlanner,
              probes.workoutSession,
              probes.bodyWeight,
            ],
            profile: new PersonalProfileSqliteRepository(
              transaction,
              deviceId,
              now,
            ),
            sessions: new WorkoutSessionSqliteRepository(
              transaction,
              deviceId,
              now,
            ),
          },
        };
      },
    );

  return Object.freeze({
    createRecoveryExport: new CreateRecoveryExportUseCase(exports.createExport),
    parseExport: restores.parseExport,
    replaceLocalData: new ReplaceLocalDataUseCase(
      transactionRunner,
      new SqliteStorageCompactor(database),
    ),
    selectFile: restores.selectFile,
    shareRecoveryExport: exports.shareExport,
  });
}
