import { GetProfileUseCase } from '../features/personal-profile/application/get-profile-use-case';
import type { PersonalProfileTransactionContext } from '../features/personal-profile/application/personal-profile-repository';
import { SaveProfileUseCase } from '../features/personal-profile/application/save-profile-use-case';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { SqliteTransactionRunner } from '../infrastructure/persistence/sqlite-transaction-runner';
import { getDatabase, getDeviceId, initializePersistence } from './persistence';

export async function createPersonalProfileUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const deviceId = await getDeviceId();
  const now = () => new Date();
  const repository = new PersonalProfileSqliteRepository(
    database,
    deviceId,
    now,
  );
  const transactionRunner =
    new SqliteTransactionRunner<PersonalProfileTransactionContext>(
      database,
      (transaction) => ({
        personalProfileRepository: new PersonalProfileSqliteRepository(
          transaction,
          deviceId,
          now,
        ),
      }),
    );

  return Object.freeze({
    getProfile: new GetProfileUseCase(repository),
    saveProfile: new SaveProfileUseCase(transactionRunner, () => new Date()),
  });
}
