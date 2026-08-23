import Constants from 'expo-constants';
import { BodyWeightExportSqliteReader } from '../features/body-measurement-history/infrastructure/body-weight-export-sqlite-reader';
import { ClearDataExportsUseCase } from '../features/data-export/application/clear-data-exports-use-case';
import { CreateDataExportUseCase } from '../features/data-export/application/create-data-export-use-case';
import type { DataExportTransactionContext } from '../features/data-export/application/data-export-transaction-context';
import { ShareDataExportUseCase } from '../features/data-export/application/share-data-export-use-case';
import { ExpoDataExportFileWriter } from '../features/data-export/infrastructure/expo-data-export-file-writer';
import { ExpoDataExportShareService } from '../features/data-export/infrastructure/expo-data-export-share-service';
import { ExerciseCatalogExportSqliteReader } from '../features/exercise-catalog/infrastructure/exercise-catalog-export-sqlite-reader';
import { GoalSqliteRepository } from '../features/goals-energy/infrastructure/goal-sqlite-repository';
import { HydrationExportSqliteReader } from '../features/hydration-tracking/infrastructure/hydration-export-sqlite-reader';
import { HydrationTargetSqliteRepository } from '../features/hydration-tracking/infrastructure/hydration-target-sqlite-repository';
import { NutritionExportSqliteReader } from '../features/nutrition-logging/infrastructure/nutrition-export-sqlite-reader';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { WorkoutPlannerSqliteRepository } from '../features/workout-planner/infrastructure/workout-planner-sqlite-repository';
import { WorkoutSessionExportSqliteReader } from '../features/workout-history/infrastructure/workout-session-export-sqlite-reader';
import { WorkoutSessionSqliteRepository } from '../features/workout-session/infrastructure/workout-session-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, getDeviceId, initializePersistence } from './persistence';

export async function createDataExportUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const deviceId = await getDeviceId();
  const now = () => new Date();
  const fileWriter = new ExpoDataExportFileWriter();
  // Every capability reader is built from the same exclusive transaction so
  // one export cannot mix records written at different moments.
  const transactionRunner =
    new SqliteTransactionRunner<DataExportTransactionContext>(
      database,
      (transaction) => ({
        bodyWeight: new BodyWeightExportSqliteReader(transaction),
        exerciseCatalog: new ExerciseCatalogExportSqliteReader(transaction),
        goals: new GoalSqliteRepository(transaction, deviceId, now),
        hydrationEntries: new HydrationExportSqliteReader(transaction),
        hydrationTarget: new HydrationTargetSqliteRepository(
          transaction,
          deviceId,
          now,
        ),
        nutrition: new NutritionExportSqliteReader(transaction),
        planner: new WorkoutPlannerSqliteRepository(transaction, deviceId, now),
        profile: new PersonalProfileSqliteRepository(
          transaction,
          deviceId,
          now,
        ),
        workoutHistory: new WorkoutSessionExportSqliteReader(transaction),
        workoutSessions: new WorkoutSessionSqliteRepository(
          transaction,
          deviceId,
          now,
        ),
      }),
    );

  return Object.freeze({
    clearExports: new ClearDataExportsUseCase(fileWriter),
    createExport: new CreateDataExportUseCase(
      transactionRunner,
      fileWriter,
      () => Constants.expoConfig?.version ?? null,
      () => new Date(),
    ),
    shareExport: new ShareDataExportUseCase(new ExpoDataExportShareService()),
  });
}
