import { randomUUID } from 'expo-crypto';
import type { ConsumptionEntryTransactionContext } from '../features/nutrition-logging/application/consumption-entry-repository';
import { CreateConsumptionEntryUseCase } from '../features/nutrition-logging/application/create-consumption-entry-use-case';
import { DeleteConsumptionEntryUseCase } from '../features/nutrition-logging/application/delete-consumption-entry-use-case';
import { GetConsumptionEntryUseCase } from '../features/nutrition-logging/application/get-consumption-entry-use-case';
import { GetDailyNutritionUseCase } from '../features/nutrition-logging/application/get-daily-nutrition-use-case';
import { UpdateConsumptionEntryUseCase } from '../features/nutrition-logging/application/update-consumption-entry-use-case';
import { ConsumptionEntrySqliteRepository } from '../features/nutrition-logging/infrastructure/consumption-entry-sqlite-repository';
import { LogFromNutritionCatalogUseCase } from '../features/nutrition-logging/application/log-from-nutrition-catalog-use-case';
import {
  BrowseNutritionCatalogUseCase,
  CreateNutritionCatalogItemUseCase,
  DeleteNutritionCatalogItemUseCase,
  GetNutritionCatalogItemUseCase,
  SaveConsumptionEntryAsCatalogItemUseCase,
  SetNutritionCatalogFavoriteUseCase,
  UpdateNutritionCatalogItemUseCase,
  type NutritionCatalogTransactionContext,
} from '../features/nutrition-logging/application/nutrition-catalog-use-cases';
import { NutritionCatalogSqliteRepository } from '../features/nutrition-logging/infrastructure/nutrition-catalog-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, getDeviceId, initializePersistence } from './persistence';

export async function createNutritionLoggingUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const deviceId = await getDeviceId();
  const now = () => new Date();
  const repository = new ConsumptionEntrySqliteRepository(
    database,
    deviceId,
    now,
  );
  const catalogRepository = new NutritionCatalogSqliteRepository(
    database,
    deviceId,
    now,
  );
  const transactionRunner =
    new SqliteTransactionRunner<ConsumptionEntryTransactionContext>(
      database,
      (transaction) => ({
        consumptionEntryRepository: new ConsumptionEntrySqliteRepository(
          transaction,
          deviceId,
          now,
        ),
      }),
    );
  const getCurrentTime = () => Date.now();
  const catalogTransactionRunner =
    new SqliteTransactionRunner<NutritionCatalogTransactionContext>(
      database,
      (transaction) => ({
        consumptionEntryRepository: new ConsumptionEntrySqliteRepository(
          transaction,
          deviceId,
          now,
        ),
        nutritionCatalogRepository: new NutritionCatalogSqliteRepository(
          transaction,
          deviceId,
          now,
        ),
      }),
    );

  return Object.freeze({
    browseCatalog: new BrowseNutritionCatalogUseCase(catalogRepository),
    createCatalogItem: new CreateNutritionCatalogItemUseCase(
      catalogRepository,
      randomUUID,
    ),
    createEntry: new CreateConsumptionEntryUseCase(
      transactionRunner,
      randomUUID,
      getCurrentTime,
    ),
    deleteEntry: new DeleteConsumptionEntryUseCase(transactionRunner),
    deleteCatalogItem: new DeleteNutritionCatalogItemUseCase(catalogRepository),
    getDailyNutrition: new GetDailyNutritionUseCase(repository),
    getEntry: new GetConsumptionEntryUseCase(repository),
    getCatalogItem: new GetNutritionCatalogItemUseCase(catalogRepository),
    logFromCatalog: new LogFromNutritionCatalogUseCase(
      catalogTransactionRunner,
      randomUUID,
      getCurrentTime,
    ),
    saveEntryAsCatalogItem: new SaveConsumptionEntryAsCatalogItemUseCase(
      repository,
      catalogRepository,
      randomUUID,
    ),
    setCatalogFavorite: new SetNutritionCatalogFavoriteUseCase(
      catalogRepository,
    ),
    updateEntry: new UpdateConsumptionEntryUseCase(
      transactionRunner,
      getCurrentTime,
    ),
    updateCatalogItem: new UpdateNutritionCatalogItemUseCase(catalogRepository),
  });
}
