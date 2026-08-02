import { randomUUID } from 'expo-crypto';
import type { ConsumptionEntryTransactionContext } from '../features/nutrition-logging/application/consumption-entry-repository';
import { CreateConsumptionEntryUseCase } from '../features/nutrition-logging/application/create-consumption-entry-use-case';
import { DeleteConsumptionEntryUseCase } from '../features/nutrition-logging/application/delete-consumption-entry-use-case';
import { GetConsumptionEntryUseCase } from '../features/nutrition-logging/application/get-consumption-entry-use-case';
import { GetDailyNutritionUseCase } from '../features/nutrition-logging/application/get-daily-nutrition-use-case';
import { UpdateConsumptionEntryUseCase } from '../features/nutrition-logging/application/update-consumption-entry-use-case';
import { ConsumptionEntrySqliteRepository } from '../features/nutrition-logging/infrastructure/consumption-entry-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, initializePersistence } from './persistence';

export async function createNutritionLoggingUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const repository = new ConsumptionEntrySqliteRepository(database);
  const transactionRunner =
    new SqliteTransactionRunner<ConsumptionEntryTransactionContext>(
      database,
      (transaction) => ({
        consumptionEntryRepository: new ConsumptionEntrySqliteRepository(
          transaction,
        ),
      }),
    );
  const getCurrentTime = () => Date.now();

  return Object.freeze({
    createEntry: new CreateConsumptionEntryUseCase(
      transactionRunner,
      randomUUID,
      getCurrentTime,
    ),
    deleteEntry: new DeleteConsumptionEntryUseCase(transactionRunner),
    getDailyNutrition: new GetDailyNutritionUseCase(repository),
    getEntry: new GetConsumptionEntryUseCase(repository),
    updateEntry: new UpdateConsumptionEntryUseCase(
      transactionRunner,
      getCurrentTime,
    ),
  });
}
