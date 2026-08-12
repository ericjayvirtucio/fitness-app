import { BodyWeightDataEraser } from '../features/body-measurement-history/infrastructure/body-weight-data-eraser';
import { BodyWeightStoredDataProbe } from '../features/body-measurement-history/infrastructure/body-weight-stored-data-probe';
import { ClearDataExportsUseCase } from '../features/data-export/application/clear-data-exports-use-case';
import { ExpoDataExportFileWriter } from '../features/data-export/infrastructure/expo-data-export-file-writer';
import { EraseLocalDataUseCase } from '../features/data-lifecycle/application/erase-local-data-use-case';
import { GetLocalDataPresenceUseCase } from '../features/data-lifecycle/application/get-local-data-presence-use-case';
import type { LocalDataErasureTransactionContext } from '../features/data-lifecycle/application/local-data-erasure-transaction-context';
import { ExerciseCatalogDataEraser } from '../features/exercise-catalog/infrastructure/exercise-catalog-data-eraser';
import { ExerciseCatalogStoredDataProbe } from '../features/exercise-catalog/infrastructure/exercise-catalog-stored-data-probe';
import { GoalDataEraser } from '../features/goals-energy/infrastructure/goal-data-eraser';
import { GoalStoredDataProbe } from '../features/goals-energy/infrastructure/goal-stored-data-probe';
import { HydrationDataEraser } from '../features/hydration-tracking/infrastructure/hydration-data-eraser';
import { HydrationStoredDataProbe } from '../features/hydration-tracking/infrastructure/hydration-stored-data-probe';
import { NutritionDataEraser } from '../features/nutrition-logging/infrastructure/nutrition-data-eraser';
import { NutritionStoredDataProbe } from '../features/nutrition-logging/infrastructure/nutrition-stored-data-probe';
import { PersonalProfileDataEraser } from '../features/personal-profile/infrastructure/personal-profile-data-eraser';
import { PersonalProfileStoredDataProbe } from '../features/personal-profile/infrastructure/personal-profile-stored-data-probe';
import { WorkoutPlannerDataEraser } from '../features/workout-planner/infrastructure/workout-planner-data-eraser';
import { WorkoutPlannerStoredDataProbe } from '../features/workout-planner/infrastructure/workout-planner-stored-data-probe';
import { WorkoutSessionDataEraser } from '../features/workout-session/infrastructure/workout-session-data-eraser';
import { WorkoutSessionStoredDataProbe } from '../features/workout-session/infrastructure/workout-session-stored-data-probe';
import { SqliteStorageCompactor } from '../infrastructure/persistence/sqlite-storage-compactor';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, initializePersistence } from './persistence';

export async function createDataLifecycleUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  // Every eraser and every probe is built from the same exclusive transaction,
  // so the deletion and the check that it worked cannot disagree about what the
  // database held.
  const transactionRunner =
    new SqliteTransactionRunner<LocalDataErasureTransactionContext>(
      database,
      (transaction) => ({
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
      }),
    );

  return Object.freeze({
    eraseLocalData: new EraseLocalDataUseCase(
      transactionRunner,
      // The export capability still owns its own directory and file names.
      new ClearDataExportsUseCase(new ExpoDataExportFileWriter()),
      new SqliteStorageCompactor(database),
    ),
    getLocalDataPresence: new GetLocalDataPresenceUseCase(transactionRunner),
  });
}
