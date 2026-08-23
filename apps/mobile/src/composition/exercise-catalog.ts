import { randomUUID } from 'expo-crypto';
import { AddStarterExercisesUseCase } from '../features/exercise-catalog/application/add-starter-exercises-use-case';
import {
  BrowseExercisesUseCase,
  CreateExerciseUseCase,
  DeleteExerciseUseCase,
  GetExerciseUseCase,
  SetExerciseFavoriteUseCase,
  UpdateExerciseUseCase,
} from '../features/exercise-catalog/application/exercise-catalog-use-cases';
import type { StarterExerciseImportContext } from '../features/exercise-catalog/application/starter-exercise-import-context';
import { ExerciseCatalogSqliteRepository } from '../features/exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { WorkoutPlannerSqliteRepository } from '../features/workout-planner/infrastructure/workout-planner-sqlite-repository';
import { WorkoutHistorySqliteRepository } from '../features/workout-history/infrastructure/workout-history-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, getDeviceId, initializePersistence } from './persistence';

export async function createExerciseCatalogUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const deviceId = await getDeviceId();
  const now = () => new Date();
  const repository = new ExerciseCatalogSqliteRepository(
    database,
    deviceId,
    now,
  );
  const mutationRunner = new SqliteTransactionRunner(
    database,
    (transaction) => ({
      catalog: new ExerciseCatalogSqliteRepository(transaction, deviceId, now),
      references: new WorkoutPlannerSqliteRepository(
        transaction,
        deviceId,
        now,
      ),
    }),
  );
  // The starter import only ever adds, so no plan can reference what it writes
  // and it needs the catalog alone rather than the mutation context that also
  // carries the planner reference reader.
  const starterImportRunner =
    new SqliteTransactionRunner<StarterExerciseImportContext>(
      database,
      (transaction) => ({
        catalog: new ExerciseCatalogSqliteRepository(
          transaction,
          deviceId,
          now,
        ),
      }),
    );

  return Object.freeze({
    addStarterExercises: new AddStarterExercisesUseCase(starterImportRunner),
    browse: new BrowseExercisesUseCase(
      repository,
      new WorkoutHistorySqliteRepository(database),
    ),
    create: new CreateExerciseUseCase(repository, randomUUID),
    delete: new DeleteExerciseUseCase(repository, mutationRunner),
    get: new GetExerciseUseCase(repository),
    setFavorite: new SetExerciseFavoriteUseCase(repository),
    update: new UpdateExerciseUseCase(repository, mutationRunner),
  });
}
