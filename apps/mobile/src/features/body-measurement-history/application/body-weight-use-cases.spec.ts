import {
  BodyWeightEntry,
  DomainId,
  Mass,
  UserProfile,
  isErr,
  isOk,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type { PersonalProfileRepository } from '../../personal-profile/application/personal-profile-repository';
import type { BodyWeightCheckInTransactionContext } from './body-weight-check-in-context';
import type { BodyWeightEntryRepository } from './body-weight-entry-repository';
import {
  DeleteBodyWeightEntryUseCase,
  GetBodyWeightEntryUseCase,
  ListBodyWeightHistoryUseCase,
  UpdateBodyWeightEntryUseCase,
} from './body-weight-entry-use-cases';
import { CreateBodyWeightCheckInUseCase } from './create-body-weight-check-in-use-case';

const occurredAt = Date.UTC(2026, 7, 4, 4);
const now = new Date(Date.UTC(2026, 7, 4, 12));

const validInput = {
  localCalendarDate: '2026-08-04',
  massUnit: 'kilogram',
  massValue: '82.4',
  note: '  Morning  ',
  occurredAtEpochMilliseconds: occurredAt,
  utcOffsetMinutes: 480,
} as const;

function storedProfile(): UserProfile {
  const profile = UserProfile.create(
    {
      activityLevel: 'moderately-active',
      biologicalSex: 'female',
      dateOfBirth: '1990-06-15',
      heightMillimeters: 1_650,
      preferredUnitSystem: 'metric',
      weightGrams: 83_000,
    },
    '2026-08-04',
  );
  if (isErr(profile)) throw new Error('Invalid fixture');
  return profile.value;
}

function storedEntry(
  id: string,
  kilograms: number,
  localCalendarDate: string,
  epochMilliseconds: number,
): BodyWeightEntry {
  const domainId = DomainId.create(id);
  const mass = Mass.create(kilograms, 'kilogram');
  if (isErr(domainId) || isErr(mass)) throw new Error('Invalid fixture');
  const entry = BodyWeightEntry.create({
    id: domainId.value,
    localCalendarDate,
    mass: mass.value,
    note: null,
    occurredAtEpochMilliseconds: epochMilliseconds,
    utcOffsetMinutes: 480,
  });
  if (isErr(entry)) throw new Error('Invalid fixture');
  return entry.value;
}

describe('body measurement history use cases', () => {
  const entryRepository: jest.Mocked<BodyWeightEntryRepository> = {
    delete: jest.fn(),
    getById: jest.fn(),
    getLatest: jest.fn(),
    insert: jest.fn(),
    listPage: jest.fn(),
    update: jest.fn(),
  };
  const profileRepository: jest.Mocked<PersonalProfileRepository> = {
    get: jest.fn(),
    save: jest.fn(),
  };
  const context: BodyWeightCheckInTransactionContext = {
    bodyWeightEntryRepository: entryRepository,
    personalProfileRepository: profileRepository,
  };
  const runner: TransactionRunner<BodyWeightCheckInTransactionContext> = {
    run: (operation) => operation(context),
  };
  const generateId = () => '123e4567-e89b-42d3-a456-426614174000';

  function createUseCase() {
    return new CreateBodyWeightCheckInUseCase(runner, generateId, () => now);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    entryRepository.getLatest.mockResolvedValue(null);
    entryRepository.insert.mockResolvedValue(undefined);
    entryRepository.update.mockResolvedValue(true);
    entryRepository.delete.mockResolvedValue(true);
    profileRepository.get.mockResolvedValue(storedProfile());
    profileRepository.save.mockResolvedValue(undefined);
  });

  it('records a canonical check-in without touching the profile by default', async () => {
    const result = await createUseCase().execute(validInput);

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.entry.mass.grams).toBeCloseTo(82_400, 6);
    expect(result.value.entry.note).toBe('Morning');
    expect(result.value.isProfileWeightUpdated).toBe(false);
    expect(entryRepository.insert.mock.calls).toHaveLength(1);
    expect(profileRepository.save.mock.calls).toHaveLength(0);
  });

  it('converts an imperial entry to canonical grams', async () => {
    const result = await createUseCase().execute({
      ...validInput,
      massUnit: 'pound',
      massValue: '181.66',
    });

    expect(isOk(result) && result.value.entry.mass.in('kilogram')).toBeCloseTo(
      82.4,
      2,
    );
  });

  it('updates the profile weight in the same transaction when requested', async () => {
    const result = await createUseCase().execute(validInput, {
      shouldUpdateProfileWeight: true,
    });

    expect(isOk(result) && result.value.isProfileWeightUpdated).toBe(true);
    expect(profileRepository.save.mock.calls).toHaveLength(1);
    const saved = profileRepository.save.mock.calls[0]?.[0];
    expect(saved?.weight.grams).toBeCloseTo(82_400, 6);
    expect(saved?.height.millimeters).toBe(1_650);
    expect(saved?.dateOfBirth).toBe('1990-06-15');
  });

  it('does not update the profile from a backdated check-in', async () => {
    entryRepository.getLatest.mockResolvedValue(
      storedEntry(
        '223e4567-e89b-42d3-a456-426614174000',
        81,
        '2026-08-06',
        Date.UTC(2026, 7, 6, 4),
      ),
    );

    const result = await createUseCase().execute(validInput, {
      shouldUpdateProfileWeight: true,
    });

    expect(isOk(result) && result.value.isProfileWeightUpdated).toBe(false);
    expect(entryRepository.insert.mock.calls).toHaveLength(1);
    expect(profileRepository.save.mock.calls).toHaveLength(0);
  });

  it('records history when no profile exists yet', async () => {
    profileRepository.get.mockResolvedValue(null);

    const result = await createUseCase().execute(validInput, {
      shouldUpdateProfileWeight: true,
    });

    expect(isOk(result) && result.value.isProfileWeightUpdated).toBe(false);
    expect(entryRepository.insert.mock.calls).toHaveLength(1);
    expect(profileRepository.save.mock.calls).toHaveLength(0);
  });

  it('propagates a transaction failure without reporting success', async () => {
    const failing: TransactionRunner<BodyWeightCheckInTransactionContext> = {
      run: () => Promise.reject(new Error('transaction-failed')),
    };

    await expect(
      new CreateBodyWeightCheckInUseCase(
        failing,
        generateId,
        () => now,
      ).execute(validInput, { shouldUpdateProfileWeight: true }),
    ).rejects.toThrow('transaction-failed');
  });

  it.each([
    [{ ...validInput, massValue: '' }, 'mass'],
    [{ ...validInput, massValue: '1.5' }, 'mass'],
    [{ ...validInput, massValue: '501' }, 'mass'],
    [{ ...validInput, massUnit: 'stone' }, 'mass'],
    [{ ...validInput, localCalendarDate: '2026-08-05' }, 'localCalendarDate'],
    [
      { ...validInput, occurredAtEpochMilliseconds: Date.UTC(2026, 7, 5) },
      'occurredAtEpochMilliseconds',
    ],
  ])('rejects invalid input without writing', async (input, field) => {
    const result = await createUseCase().execute(input);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error[0]?.field).toBe(field);
    expect(entryRepository.insert.mock.calls).toHaveLength(0);
    expect(profileRepository.save.mock.calls).toHaveLength(0);
  });

  it('reads one entry and ignores an invalid identifier', async () => {
    const entry = storedEntry(
      '123e4567-e89b-42d3-a456-426614174000',
      82.4,
      '2026-08-04',
      occurredAt,
    );
    entryRepository.getById.mockResolvedValue(entry);
    const useCase = new GetBodyWeightEntryUseCase(entryRepository);

    await expect(useCase.execute(entry.id.value)).resolves.toBe(entry);
    await expect(useCase.execute('nope')).resolves.toBeNull();
    expect(entryRepository.getById.mock.calls).toHaveLength(1);
  });

  it('bounds history paging', async () => {
    entryRepository.listPage.mockResolvedValue({ items: [], nextCursor: null });
    const useCase = new ListBodyWeightHistoryUseCase(entryRepository);

    await useCase.execute();
    await useCase.execute({ limit: 500 });
    await useCase.execute({ limit: 0 });

    expect(
      entryRepository.listPage.mock.calls.map(([query]) => query.limit),
    ).toEqual([20, 50, 20]);
  });

  it('updates a check-in without writing the profile', async () => {
    const result = await new UpdateBodyWeightEntryUseCase(entryRepository, () =>
      now.getTime(),
    ).execute('123e4567-e89b-42d3-a456-426614174000', {
      ...validInput,
      massValue: '81.8',
    });

    expect(isOk(result) && result.value.mass.in('kilogram')).toBeCloseTo(
      81.8,
      6,
    );
    expect(profileRepository.save.mock.calls).toHaveLength(0);
  });

  it('reports a missing check-in on update', async () => {
    entryRepository.update.mockResolvedValue(false);

    const result = await new UpdateBodyWeightEntryUseCase(entryRepository, () =>
      now.getTime(),
    ).execute('123e4567-e89b-42d3-a456-426614174000', validInput);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error[0]?.code).toBe('invalid-identifier');
  });

  it('deletes a check-in and refuses an invalid identifier', async () => {
    const useCase = new DeleteBodyWeightEntryUseCase(entryRepository);

    await expect(
      useCase.execute('123e4567-e89b-42d3-a456-426614174000'),
    ).resolves.toBe(true);
    await expect(useCase.execute('nope')).resolves.toBe(false);
    expect(entryRepository.delete.mock.calls).toHaveLength(1);
  });
});
