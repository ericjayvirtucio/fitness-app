import { BodyWeightEntrySqliteRepository } from '../features/body-measurement-history/infrastructure/body-weight-entry-sqlite-repository';
import { BodyWeightStoredDataProbe } from '../features/body-measurement-history/infrastructure/body-weight-stored-data-probe';
import type { DataRestoreTransactionContext } from '../features/data-restore/application/data-restore-transaction-context';
import { GetRestoreTargetUseCase } from '../features/data-restore/application/get-restore-target-use-case';
import { ParseDataExportUseCase } from '../features/data-restore/application/parse-data-export-use-case';
import { RestoreDataExportUseCase } from '../features/data-restore/application/restore-data-export-use-case';
import { SelectDataRestoreFileUseCase } from '../features/data-restore/application/select-data-restore-file-use-case';
import { ExpoDataRestoreFileSource } from '../features/data-restore/infrastructure/expo-data-restore-file-source';
import { ExerciseCatalogSqliteRepository } from '../features/exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { ExerciseCatalogStoredDataProbe } from '../features/exercise-catalog/infrastructure/exercise-catalog-stored-data-probe';
import { GoalSqliteRepository } from '../features/goals-energy/infrastructure/goal-sqlite-repository';
import { GoalStoredDataProbe } from '../features/goals-energy/infrastructure/goal-stored-data-probe';
import { HydrationEntrySqliteRepository } from '../features/hydration-tracking/infrastructure/hydration-entry-sqlite-repository';
import { HydrationStoredDataProbe } from '../features/hydration-tracking/infrastructure/hydration-stored-data-probe';
import { HydrationTargetSqliteRepository } from '../features/hydration-tracking/infrastructure/hydration-target-sqlite-repository';
import { ConsumptionEntrySqliteRepository } from '../features/nutrition-logging/infrastructure/consumption-entry-sqlite-repository';
import { NutritionCatalogSqliteRepository } from '../features/nutrition-logging/infrastructure/nutrition-catalog-sqlite-repository';
import { NutritionStoredDataProbe } from '../features/nutrition-logging/infrastructure/nutrition-stored-data-probe';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { PersonalProfileStoredDataProbe } from '../features/personal-profile/infrastructure/personal-profile-stored-data-probe';
import { WorkoutPlannerSqliteRepository } from '../features/workout-planner/infrastructure/workout-planner-sqlite-repository';
import { WorkoutPlannerStoredDataProbe } from '../features/workout-planner/infrastructure/workout-planner-stored-data-probe';
import { WorkoutSessionSqliteRepository } from '../features/workout-session/infrastructure/workout-session-sqlite-repository';
import { WorkoutSessionStoredDataProbe } from '../features/workout-session/infrastructure/workout-session-stored-data-probe';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, initializePersistence } from './persistence';

export async function createDataRestoreUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  // Every probe and every repository is built from the same exclusive
  // transaction, so the emptiness check and the writes cannot disagree about
  // what the database held.
  const transactionRunner =
    new SqliteTransactionRunner<DataRestoreTransactionContext>(
      database,
      (transaction) => ({
        bodyWeight: new BodyWeightEntrySqliteRepository(transaction),
        exerciseCatalog: new ExerciseCatalogSqliteRepository(transaction),
        goals: new GoalSqliteRepository(transaction),
        hydrationEntries: new HydrationEntrySqliteRepository(transaction),
        hydrationTarget: new HydrationTargetSqliteRepository(transaction),
        nutritionCatalog: new NutritionCatalogSqliteRepository(transaction),
        nutritionEntries: new ConsumptionEntrySqliteRepository(transaction),
        planner: new WorkoutPlannerSqliteRepository(transaction),
        probes: [
          new PersonalProfileStoredDataProbe(transaction),
          new GoalStoredDataProbe(transaction),
          new NutritionStoredDataProbe(transaction),
          new HydrationStoredDataProbe(transaction),
          new ExerciseCatalogStoredDataProbe(transaction),
          new WorkoutPlannerStoredDataProbe(transaction),
          new WorkoutSessionStoredDataProbe(transaction),
          new BodyWeightStoredDataProbe(transaction),
        ],
        profile: new PersonalProfileSqliteRepository(transaction),
        sessions: new WorkoutSessionSqliteRepository(transaction),
      }),
    );

  return Object.freeze({
    getRestoreTarget: new GetRestoreTargetUseCase(transactionRunner),
    parseExport: new ParseDataExportUseCase(() => new Date()),
    restoreExport: new RestoreDataExportUseCase(transactionRunner),
    selectFile: new SelectDataRestoreFileUseCase(
      new ExpoDataRestoreFileSource(),
    ),
  });
}
