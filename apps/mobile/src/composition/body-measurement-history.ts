import { randomUUID } from 'expo-crypto';
import type { BodyWeightCheckInTransactionContext } from '../features/body-measurement-history/application/body-weight-check-in-context';
import {
  DeleteBodyWeightEntryUseCase,
  GetBodyWeightEntryUseCase,
  ListBodyWeightHistoryUseCase,
  UpdateBodyWeightEntryUseCase,
} from '../features/body-measurement-history/application/body-weight-entry-use-cases';
import { CreateBodyWeightCheckInUseCase } from '../features/body-measurement-history/application/create-body-weight-check-in-use-case';
import { BodyWeightEntrySqliteRepository } from '../features/body-measurement-history/infrastructure/body-weight-entry-sqlite-repository';
import { GetProfileUseCase } from '../features/personal-profile/application/get-profile-use-case';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, getDeviceId, initializePersistence } from './persistence';

export async function createBodyMeasurementHistoryUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const deviceId = await getDeviceId();
  const now = () => new Date();
  const entryRepository = new BodyWeightEntrySqliteRepository(
    database,
    deviceId,
    now,
  );
  // A check-in that also updates the profile weight composes both capability
  // repositories from the same transaction.
  const transactionRunner =
    new SqliteTransactionRunner<BodyWeightCheckInTransactionContext>(
      database,
      (transaction) => ({
        bodyWeightEntryRepository: new BodyWeightEntrySqliteRepository(
          transaction,
          deviceId,
          now,
        ),
        personalProfileRepository: new PersonalProfileSqliteRepository(
          transaction,
          deviceId,
          now,
        ),
      }),
    );

  return Object.freeze({
    createCheckIn: new CreateBodyWeightCheckInUseCase(
      transactionRunner,
      randomUUID,
      () => new Date(),
    ),
    deleteEntry: new DeleteBodyWeightEntryUseCase(entryRepository),
    getEntry: new GetBodyWeightEntryUseCase(entryRepository),
    getProfile: new GetProfileUseCase(
      new PersonalProfileSqliteRepository(database, deviceId, now),
    ),
    listHistory: new ListBodyWeightHistoryUseCase(entryRepository),
    updateEntry: new UpdateBodyWeightEntryUseCase(entryRepository, () =>
      Date.now(),
    ),
  });
}
