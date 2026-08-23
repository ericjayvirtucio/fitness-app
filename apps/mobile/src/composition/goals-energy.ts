import { GetEnergySummaryUseCase } from '../features/goals-energy/application/get-energy-summary-use-case';
import { GetGoalUseCase } from '../features/goals-energy/application/get-goal-use-case';
import { SaveGoalUseCase } from '../features/goals-energy/application/save-goal-use-case';
import { GoalSqliteRepository } from '../features/goals-energy/infrastructure/goal-sqlite-repository';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { getDatabase, getDeviceId, initializePersistence } from './persistence';

export async function createGoalsEnergyUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const deviceId = await getDeviceId();
  const getCurrentDate = () => new Date();
  const goalRepository = new GoalSqliteRepository(
    database,
    deviceId,
    getCurrentDate,
  );
  const profileRepository = new PersonalProfileSqliteRepository(
    database,
    deviceId,
    getCurrentDate,
  );

  return Object.freeze({
    getEnergySummary: new GetEnergySummaryUseCase(
      profileRepository,
      goalRepository,
      getCurrentDate,
    ),
    getGoal: new GetGoalUseCase(goalRepository),
    saveGoal: new SaveGoalUseCase(
      profileRepository,
      goalRepository,
      getCurrentDate,
    ),
  });
}
