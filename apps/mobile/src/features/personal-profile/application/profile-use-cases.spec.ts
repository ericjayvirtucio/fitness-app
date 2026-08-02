import { isErr, isOk, type UserProfile } from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { GetProfileUseCase } from './get-profile-use-case';
import type {
  PersonalProfileRepository,
  PersonalProfileTransactionContext,
} from './personal-profile-repository';
import { SaveProfileUseCase } from './save-profile-use-case';

describe('personal profile use cases', () => {
  const repository: jest.Mocked<PersonalProfileRepository> = {
    get: jest.fn(),
    save: jest.fn(),
  };
  const runner: TransactionRunner<PersonalProfileTransactionContext> = {
    run: (operation) => operation({ personalProfileRepository: repository }),
  };

  beforeEach(() => jest.clearAllMocks());

  it('reads the profile through its repository', async () => {
    repository.get.mockResolvedValue(null);
    await expect(
      new GetProfileUseCase(repository).execute(),
    ).resolves.toBeNull();
    expect(repository.get.mock.calls).toHaveLength(1);
  });

  it('validates and saves a profile through a transaction', async () => {
    const result = await new SaveProfileUseCase(
      runner,
      () => new Date('2026-08-02T00:00:00.000Z'),
    ).execute({
      activityLevel: 'moderately-active',
      biologicalSex: 'female',
      dateOfBirth: '1990-06-15',
      height: '165',
      preferredUnitSystem: 'metric',
      weight: '62',
    });

    expect(isOk(result)).toBe(true);
    expect(repository.save.mock.calls).toHaveLength(1);
  });

  it('returns validation errors without touching persistence', async () => {
    const result = await new SaveProfileUseCase(
      runner,
      () => new Date('2026-08-02T00:00:00.000Z'),
    ).execute({
      activityLevel: '',
      biologicalSex: '',
      dateOfBirth: '',
      height: '',
      preferredUnitSystem: 'metric',
      weight: '',
    });

    expect(isErr(result)).toBe(true);
    expect(repository.save.mock.calls).toHaveLength(0);
  });

  it('returns a previously stored profile', async () => {
    const stored = {} as UserProfile;
    repository.get.mockResolvedValue(stored);
    await expect(new GetProfileUseCase(repository).execute()).resolves.toBe(
      stored,
    );
  });
});
