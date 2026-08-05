import { randomUUID } from 'expo-crypto';
import { ExerciseCatalogSqliteRepository } from '../features/exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { BrowseExercisesUseCase } from '../features/exercise-catalog/application/exercise-catalog-use-cases';
import { GetProfileUseCase } from '../features/personal-profile/application/get-profile-use-case';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import {
  GetPlannedWorkoutUseCase,
  GetWeeklyPlanUseCase,
  SavePlannedWorkoutUseCase,
  SetRestDayUseCase,
} from '../features/workout-planner/application/workout-planner-use-cases';
import { WorkoutPlannerSqliteRepository } from '../features/workout-planner/infrastructure/workout-planner-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, initializePersistence } from './persistence';

export async function createWorkoutPlannerUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const planner = new WorkoutPlannerSqliteRepository(database);
  const catalog = new ExerciseCatalogSqliteRepository(database);
  const transactionRunner = new SqliteTransactionRunner(
    database,
    (transaction) => ({
      planner: new WorkoutPlannerSqliteRepository(transaction),
    }),
  );
  return Object.freeze({
    generateId: randomUUID,
    browseExercises: new BrowseExercisesUseCase(catalog),
    get: new GetPlannedWorkoutUseCase(planner),
    getProfile: new GetProfileUseCase(
      new PersonalProfileSqliteRepository(database),
    ),
    getWeekly: new GetWeeklyPlanUseCase(planner),
    save: new SavePlannedWorkoutUseCase(catalog, transactionRunner),
    setRest: new SetRestDayUseCase(transactionRunner),
  });
}
