import {
  UserProfile,
  isErr,
  isOk,
  type GoalConfiguration,
} from '@fitness/domain';
import type { PersonalProfileRepository } from '../../personal-profile/application/personal-profile-repository';
import { GetEnergySummaryUseCase } from './get-energy-summary-use-case';
import { GetGoalUseCase } from './get-goal-use-case';
import type { GoalRepository } from './goal-repository';
import { SaveGoalUseCase } from './save-goal-use-case';

function validProfile(
  overrides: Partial<Parameters<typeof UserProfile.create>[0]> = {},
) {
  const profile = UserProfile.create(
    {
      activityLevel: 'moderately-active',
      biologicalSex: 'female',
      dateOfBirth: '1990-06-15',
      heightMillimeters: 1_650,
      preferredUnitSystem: 'metric',
      weightGrams: 62_000,
      ...overrides,
    },
    '2026-08-02',
  );
  if (!isOk(profile)) throw new Error('Invalid test fixture.');
  return profile.value;
}

describe('goals and energy use cases', () => {
  const goalRepository: jest.Mocked<GoalRepository> = {
    get: jest.fn(),
    save: jest.fn(),
  };
  const profileRepository: jest.Mocked<PersonalProfileRepository> = {
    get: jest.fn(),
    save: jest.fn(),
  };
  const currentDate = () => new Date(2026, 7, 2, 12);

  beforeEach(() => {
    jest.clearAllMocks();
    goalRepository.get.mockResolvedValue(null);
    profileRepository.get.mockResolvedValue(validProfile());
  });

  it('returns an energy summary from a complete profile', async () => {
    const outcome = await new GetEnergySummaryUseCase(
      profileRepository,
      goalRepository,
      currentDate,
    ).execute();
    expect(outcome.status).toBe('ready');
    if (outcome.status === 'ready') {
      expect(outcome.summary.bmi.value).toBeCloseTo(22.7732, 4);
      expect(
        outcome.summary.maintenanceEnergy.in('kilocalorie'),
      ).toBeGreaterThan(0);
    }
  });

  it('handles a missing profile without inventing values', async () => {
    profileRepository.get.mockResolvedValue(null);
    await expect(
      new GetEnergySummaryUseCase(
        profileRepository,
        goalRepository,
        currentDate,
      ).execute(),
    ).resolves.toEqual({ status: 'profile-required' });
  });

  it('returns BMI while withholding unsupported energy estimates', async () => {
    profileRepository.get.mockResolvedValue(
      validProfile({ biologicalSex: 'prefer-not-to-say' }),
    );
    const outcome = await new GetEnergySummaryUseCase(
      profileRepository,
      goalRepository,
      currentDate,
    ).execute();
    expect(outcome).toMatchObject({
      bmi: { category: 'healthy-weight' },
      reason: { field: 'biologicalSex' },
      status: 'calculation-unavailable',
    });
  });

  it('reads the goal through its capability repository', async () => {
    const stored = {} as GoalConfiguration;
    goalRepository.get.mockResolvedValue(stored);
    await expect(new GetGoalUseCase(goalRepository).execute()).resolves.toBe(
      stored,
    );
  });

  it('validates the target before saving the goal', async () => {
    const result = await new SaveGoalUseCase(
      profileRepository,
      goalRepository,
      currentDate,
    ).execute({ adjustmentKilocalories: '300', goalType: 'lose-weight' });
    expect(isOk(result)).toBe(true);
    expect(goalRepository.save.mock.calls).toHaveLength(1);
  });

  it('rejects invalid goals without writing', async () => {
    const result = await new SaveGoalUseCase(
      profileRepository,
      goalRepository,
      currentDate,
    ).execute({ adjustmentKilocalories: '900', goalType: 'lose-weight' });
    expect(isErr(result)).toBe(true);
    expect(goalRepository.save.mock.calls).toHaveLength(0);
  });

  it('rejects a complete but unsupported profile without writing', async () => {
    profileRepository.get.mockResolvedValue(
      validProfile({ biologicalSex: 'intersex' }),
    );
    const result = await new SaveGoalUseCase(
      profileRepository,
      goalRepository,
      currentDate,
    ).execute({ adjustmentKilocalories: '200', goalType: 'gain-weight' });
    expect(isErr(result)).toBe(true);
    expect(goalRepository.save.mock.calls).toHaveLength(0);
  });
});
