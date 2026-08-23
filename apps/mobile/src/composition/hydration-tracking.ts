import { randomUUID } from 'expo-crypto';
import { CreateHydrationEntryUseCase } from '../features/hydration-tracking/application/create-hydration-entry-use-case';
import { DeleteHydrationEntryUseCase } from '../features/hydration-tracking/application/delete-hydration-entry-use-case';
import { GetDailyHydrationUseCase } from '../features/hydration-tracking/application/get-daily-hydration-use-case';
import { GetHydrationEntryUseCase } from '../features/hydration-tracking/application/get-hydration-entry-use-case';
import { GetHydrationTargetUseCase } from '../features/hydration-tracking/application/get-hydration-target-use-case';
import { SaveHydrationTargetUseCase } from '../features/hydration-tracking/application/save-hydration-target-use-case';
import { UpdateHydrationEntryUseCase } from '../features/hydration-tracking/application/update-hydration-entry-use-case';
import { HydrationEntrySqliteRepository } from '../features/hydration-tracking/infrastructure/hydration-entry-sqlite-repository';
import { HydrationTargetSqliteRepository } from '../features/hydration-tracking/infrastructure/hydration-target-sqlite-repository';
import { getDatabase, getDeviceId, initializePersistence } from './persistence';

export async function createHydrationTrackingUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const deviceId = await getDeviceId();
  const now = () => new Date();
  const entryRepository = new HydrationEntrySqliteRepository(
    database,
    deviceId,
    now,
  );
  const targetRepository = new HydrationTargetSqliteRepository(
    database,
    deviceId,
    now,
  );
  const getCurrentTime = () => Date.now();

  return Object.freeze({
    createEntry: new CreateHydrationEntryUseCase(
      entryRepository,
      randomUUID,
      getCurrentTime,
    ),
    deleteEntry: new DeleteHydrationEntryUseCase(entryRepository),
    getDailyHydration: new GetDailyHydrationUseCase(
      entryRepository,
      targetRepository,
    ),
    getEntry: new GetHydrationEntryUseCase(entryRepository),
    getTarget: new GetHydrationTargetUseCase(targetRepository),
    saveTarget: new SaveHydrationTargetUseCase(targetRepository),
    updateEntry: new UpdateHydrationEntryUseCase(
      entryRepository,
      getCurrentTime,
    ),
  });
}
