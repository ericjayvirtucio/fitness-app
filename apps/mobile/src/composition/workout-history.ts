import { randomUUID } from 'expo-crypto';
import { CorrectCompletedWorkoutSetUseCase } from '../features/workout-history/application/correct-completed-workout-set-use-case';
import { DeleteCompletedWorkoutUseCase } from '../features/workout-history/application/delete-completed-workout-use-case';
import { WorkoutSessionSqliteRepository } from '../features/workout-session/infrastructure/workout-session-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import {
  GetCompletedWorkoutSessionUseCase,
  GetExercisePersonalRecordsUseCase,
  GetWorkoutProgressSummaryUseCase,
  ListExercisePerformanceHistoryUseCase,
  ListPerformedExercisesUseCase,
  ListRecentlyPerformedExerciseIdsUseCase,
  ListWorkoutHistoryUseCase,
} from '../features/workout-history/application/workout-history-use-cases';
import { WorkoutHistorySqliteRepository } from '../features/workout-history/infrastructure/workout-history-sqlite-repository';
import { WorkoutPersonalRecordsSqliteReader } from '../features/workout-history/infrastructure/workout-personal-records-sqlite-reader';
import { GetProfileUseCase } from '../features/personal-profile/application/get-profile-use-case';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { getDatabase, initializePersistence } from './persistence';

export async function createWorkoutHistoryUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const repository = new WorkoutHistorySqliteRepository(database);
  const sessionWrites = () =>
    new SqliteTransactionRunner(database, (transaction) => ({
      sessions: new WorkoutSessionSqliteRepository(transaction),
    }));
  return Object.freeze({
    correctSet: new CorrectCompletedWorkoutSetUseCase(
      sessionWrites(),
      randomUUID,
    ),
    deleteCompleted: new DeleteCompletedWorkoutUseCase(sessionWrites()),
    getCompleted: new GetCompletedWorkoutSessionUseCase(repository),
    getPersonalRecords: new GetExercisePersonalRecordsUseCase(
      new WorkoutPersonalRecordsSqliteReader(database),
    ),
    getProfile: new GetProfileUseCase(
      new PersonalProfileSqliteRepository(database),
    ),
    getSummary: new GetWorkoutProgressSummaryUseCase(repository),
    list: new ListWorkoutHistoryUseCase(repository),
    listExercisePerformance: new ListExercisePerformanceHistoryUseCase(
      repository,
    ),
    listPerformedExercises: new ListPerformedExercisesUseCase(repository),
    listRecentExerciseIds: new ListRecentlyPerformedExerciseIdsUseCase(
      repository,
    ),
  });
}
