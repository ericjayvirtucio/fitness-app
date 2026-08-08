import {
  GetCompletedWorkoutSessionUseCase,
  GetWorkoutProgressSummaryUseCase,
  ListExercisePerformanceHistoryUseCase,
  ListRecentlyPerformedExerciseIdsUseCase,
  ListWorkoutHistoryUseCase,
} from '../features/workout-history/application/workout-history-use-cases';
import { WorkoutHistorySqliteRepository } from '../features/workout-history/infrastructure/workout-history-sqlite-repository';
import { GetProfileUseCase } from '../features/personal-profile/application/get-profile-use-case';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { BrowseExercisesUseCase } from '../features/exercise-catalog/application/exercise-catalog-use-cases';
import { ExerciseCatalogSqliteRepository } from '../features/exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { getDatabase, initializePersistence } from './persistence';

export async function createWorkoutHistoryUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const repository = new WorkoutHistorySqliteRepository(database);
  return Object.freeze({
    getCompleted: new GetCompletedWorkoutSessionUseCase(repository),
    getProfile: new GetProfileUseCase(
      new PersonalProfileSqliteRepository(database),
    ),
    getSummary: new GetWorkoutProgressSummaryUseCase(repository),
    list: new ListWorkoutHistoryUseCase(repository),
    listExercisePerformance: new ListExercisePerformanceHistoryUseCase(
      repository,
    ),
    listRecentExerciseIds: new ListRecentlyPerformedExerciseIdsUseCase(
      repository,
    ),
    browseRecentExercises: new BrowseExercisesUseCase(
      new ExerciseCatalogSqliteRepository(database),
      repository,
    ),
  });
}
