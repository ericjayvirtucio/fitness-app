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
import { getDatabase, initializePersistence } from './persistence';

export async function createExerciseCatalogUseCases() {
  await initializePersistence();
  const repository = new ExerciseCatalogSqliteRepository(await getDatabase());
  return Object.freeze({
    browse: new BrowseExercisesUseCase(repository),
    create: new CreateExerciseUseCase(repository, randomUUID),
    delete: new DeleteExerciseUseCase(repository),
    get: new GetExerciseUseCase(repository),
    setFavorite: new SetExerciseFavoriteUseCase(repository),
    update: new UpdateExerciseUseCase(repository),
  });
}
