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
import type { WorkoutSessionTransactionContext } from '../features/workout-session/application/workout-session-repository';
import { WorkoutSessionSqliteRepository } from '../features/workout-session/infrastructure/workout-session-sqlite-repository';
import { WorkoutPlannerSqliteRepository } from '../features/workout-planner/infrastructure/workout-planner-sqlite-repository';
import { GetProfileUseCase } from '../features/personal-profile/application/get-profile-use-case';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, getDeviceId, initializePersistence } from './persistence';
import { WorkoutHistorySqliteRepository } from '../features/workout-history/infrastructure/workout-history-sqlite-repository';

export async function createWorkoutSessionUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const deviceId = await getDeviceId();
  const nowDate = () => new Date();
  const sessions = new WorkoutSessionSqliteRepository(
    database,
    deviceId,
    nowDate,
  );
  const runner = new SqliteTransactionRunner(database, (transaction) => ({
    catalog: new ExerciseCatalogSqliteRepository(
      transaction,
      deviceId,
      nowDate,
    ),
    planner: new WorkoutPlannerSqliteRepository(transaction, deviceId, nowDate),
    sessions: new WorkoutSessionSqliteRepository(
      transaction,
      deviceId,
      nowDate,
    ),
  }));
  // Discarding needs the session repository and nothing else, so it gets its
  // own exclusive transaction rather than one carrying a Catalog and a Planner
  // it must never write through.
  const discardRunner =
    new SqliteTransactionRunner<WorkoutSessionTransactionContext>(
      database,
      (transaction) => ({
        sessions: new WorkoutSessionSqliteRepository(
          transaction,
          deviceId,
          nowDate,
        ),
      }),
    );
  const now = () => Date.now();
  return Object.freeze({
    browseExercises: new BrowseExercisesUseCase(
      new ExerciseCatalogSqliteRepository(database, deviceId, nowDate),
      new WorkoutHistorySqliteRepository(database),
    ),
    discard: new DiscardWorkoutSessionUseCase(discardRunner),
    finish: new FinishWorkoutSessionUseCase(runner, now),
    getActive: new GetActiveWorkoutSessionUseCase(sessions),
    getProfile: new GetProfileUseCase(
      new PersonalProfileSqliteRepository(database, deviceId, nowDate),
    ),
    mutations: new WorkoutSessionMutationUseCases(runner, randomUUID),
    start: new StartWorkoutSessionUseCase(runner, randomUUID, now),
  });
}
