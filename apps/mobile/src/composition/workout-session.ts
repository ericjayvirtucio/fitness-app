import { randomUUID } from 'expo-crypto';
import { ExerciseCatalogSqliteRepository } from '../features/exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { BrowseExercisesUseCase } from '../features/exercise-catalog/application/exercise-catalog-use-cases';
import {
  DiscardWorkoutSessionUseCase,
  FinishWorkoutSessionUseCase,
  GetActiveWorkoutSessionUseCase,
  StartWorkoutSessionUseCase,
  WorkoutSessionMutationUseCases,
} from '../features/workout-session/application/workout-session-use-cases';
import { WorkoutSessionSqliteRepository } from '../features/workout-session/infrastructure/workout-session-sqlite-repository';
import { WorkoutPlannerSqliteRepository } from '../features/workout-planner/infrastructure/workout-planner-sqlite-repository';
import { GetProfileUseCase } from '../features/personal-profile/application/get-profile-use-case';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, initializePersistence } from './persistence';

export async function createWorkoutSessionUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const sessions = new WorkoutSessionSqliteRepository(database);
  const runner = new SqliteTransactionRunner(database, (transaction) => ({
    catalog: new ExerciseCatalogSqliteRepository(transaction),
    planner: new WorkoutPlannerSqliteRepository(transaction),
    sessions: new WorkoutSessionSqliteRepository(transaction),
  }));
  const now = () => Date.now();
  return Object.freeze({
    browseExercises: new BrowseExercisesUseCase(
      new ExerciseCatalogSqliteRepository(database),
    ),
    discard: new DiscardWorkoutSessionUseCase(sessions),
    finish: new FinishWorkoutSessionUseCase(runner, now),
    getActive: new GetActiveWorkoutSessionUseCase(sessions),
    getProfile: new GetProfileUseCase(
      new PersonalProfileSqliteRepository(database),
    ),
    mutations: new WorkoutSessionMutationUseCases(runner, randomUUID),
    start: new StartWorkoutSessionUseCase(runner, randomUUID, now),
  });
}
