import { randomUUID } from 'expo-crypto';
import { ExerciseCatalogSqliteRepository } from '../features/exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
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
  const transactionRunner = new SqliteTransactionRunner(
    database,
    (transaction) => ({
      planner: new WorkoutPlannerSqliteRepository(transaction),
    }),
  );
  return Object.freeze({
    generateId: randomUUID,
    get: new GetPlannedWorkoutUseCase(planner),
    getWeekly: new GetWeeklyPlanUseCase(planner),
    save: new SavePlannedWorkoutUseCase(
      new ExerciseCatalogSqliteRepository(database),
      transactionRunner,
    ),
    setRest: new SetRestDayUseCase(transactionRunner),
  });
}
