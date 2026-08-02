import { GetEnergySummaryUseCase } from '../features/goals-energy/application/get-energy-summary-use-case';
import { GetGoalUseCase } from '../features/goals-energy/application/get-goal-use-case';
import { SaveGoalUseCase } from '../features/goals-energy/application/save-goal-use-case';
import { GoalSqliteRepository } from '../features/goals-energy/infrastructure/goal-sqlite-repository';
import { PersonalProfileSqliteRepository } from '../features/personal-profile/infrastructure/personal-profile-sqlite-repository';
import { getDatabase, initializePersistence } from './persistence';

export async function createGoalsEnergyUseCases() {
  await initializePersistence();
  const database = await getDatabase();
  const goalRepository = new GoalSqliteRepository(database);
  const profileRepository = new PersonalProfileSqliteRepository(database);
  const getCurrentDate = () => new Date();

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
