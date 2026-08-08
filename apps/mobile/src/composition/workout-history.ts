import {
  GetCompletedWorkoutSessionUseCase,
  GetWorkoutProgressSummaryUseCase,
  ListExercisePerformanceHistoryUseCase,
  ListRecentlyPerformedExerciseIdsUseCase,
  ListWorkoutHistoryUseCase,
} from '../features/workout-history/application/workout-history-use-cases';
import { WorkoutHistorySqliteRepository } from '../features/workout-history/infrastructure/workout-history-sqlite-repository';
import { getDatabase, initializePersistence } from './persistence';

export async function createWorkoutHistoryUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const repository = new WorkoutHistorySqliteRepository(database);
  return Object.freeze({
    getCompleted: new GetCompletedWorkoutSessionUseCase(repository),
    getSummary: new GetWorkoutProgressSummaryUseCase(repository),
    list: new ListWorkoutHistoryUseCase(repository),
    listExercisePerformance: new ListExercisePerformanceHistoryUseCase(
      repository,
    ),
    listRecentExerciseIds: new ListRecentlyPerformedExerciseIdsUseCase(
      repository,
    ),
  });
}
