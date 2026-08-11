import { BodyWeightProgressSqliteReader } from '../features/body-measurement-history/infrastructure/body-weight-progress-sqlite-reader';
import { GetProgressSummaryUseCase } from '../features/progress-analytics/application/get-progress-summary-use-case';
import { HydrationProgressSqliteReader } from '../features/hydration-tracking/infrastructure/hydration-progress-sqlite-reader';
import { NutritionProgressSqliteReader } from '../features/nutrition-logging/infrastructure/nutrition-progress-sqlite-reader';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { WorkoutHistorySqliteRepository } from '../features/workout-history/infrastructure/workout-history-sqlite-repository';
import { getDatabase, initializePersistence } from './persistence';

export async function createProgressAnalyticsUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  return Object.freeze({
    getSummary: new GetProgressSummaryUseCase(
      new NutritionProgressSqliteReader(database),
      new HydrationProgressSqliteReader(database),
      new WorkoutHistorySqliteRepository(database),
      new BodyWeightProgressSqliteReader(database),
      new PersonalProfileSqliteRepository(database),
    ),
  });
}
