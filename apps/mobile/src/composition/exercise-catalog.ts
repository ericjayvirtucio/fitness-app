import { randomUUID } from 'expo-crypto';
import {
  BrowseExercisesUseCase,
  CreateExerciseUseCase,
  DeleteExerciseUseCase,
  GetExerciseUseCase,
  SetExerciseFavoriteUseCase,
  UpdateExerciseUseCase,
} from '../features/exercise-catalog/application/exercise-catalog-use-cases';
import { ExerciseCatalogSqliteRepository } from '../features/exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { WorkoutPlannerSqliteRepository } from '../features/workout-planner/infrastructure/workout-planner-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, initializePersistence } from './persistence';

export async function createExerciseCatalogUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const repository = new ExerciseCatalogSqliteRepository(database);
  const mutationRunner = new SqliteTransactionRunner(
    database,
    (transaction) => ({
      catalog: new ExerciseCatalogSqliteRepository(transaction),
      references: new WorkoutPlannerSqliteRepository(transaction),
    }),
  );
  return Object.freeze({
    browse: new BrowseExercisesUseCase(repository),
    create: new CreateExerciseUseCase(repository, randomUUID),
    delete: new DeleteExerciseUseCase(repository, mutationRunner),
    get: new GetExerciseUseCase(repository),
    setFavorite: new SetExerciseFavoriteUseCase(repository),
    update: new UpdateExerciseUseCase(repository, mutationRunner),
  });
}
