import { RenameWorkoutSessionUseCase } from '../features/workout-session/application/rename-workout-session-use-case';
import type { WorkoutSessionRenameContext } from '../features/workout-session/application/rename-workout-session-use-case';
import { GetWorkoutSessionUseCase } from '../features/workout-session/application/workout-session-use-cases';
import { WorkoutSessionSqliteRepository } from '../features/workout-session/infrastructure/workout-session-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, initializePersistence } from './persistence';

/**
 * Naming reaches a workout of either status, so it composes the session
 * repository alone. It is deliberately not folded into the Workout Session or
 * Workout History roots: neither of those can load the other's workout, and
 * widening either one to do so would hand an unrelated screen a reader it has
 * no reason to hold.
 */
export async function createWorkoutNameUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const runner = new SqliteTransactionRunner<WorkoutSessionRenameContext>(
    database,
    (transaction) => ({
      sessions: new WorkoutSessionSqliteRepository(transaction),
    }),
  );
  return Object.freeze({
    getSession: new GetWorkoutSessionUseCase(
      new WorkoutSessionSqliteRepository(database),
    ),
    rename: new RenameWorkoutSessionUseCase(runner),
  });
}
