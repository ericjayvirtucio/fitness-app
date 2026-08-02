import {
  UserProfile,
  isErr,
  type Result,
  type UserProfileValidationErrors,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import type { PersonalProfileTransactionContext } from './personal-profile-repository';

export type SaveProfileInput = Readonly<{
  activityLevel: unknown;
  biologicalSex: unknown;
  dateOfBirth: unknown;
  height: unknown;
  preferredUnitSystem: unknown;
  weight: unknown;
}>;

function parseNumber(value: unknown): number {
  if (typeof value !== 'string' || value.trim().length === 0) return Number.NaN;
  return Number(value.trim());
}

export class SaveProfileUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<PersonalProfileTransactionContext>,
    private readonly getCurrentDate: () => Date,
  ) {}

  async execute(
    input: SaveProfileInput,
  ): Promise<Result<UserProfile, UserProfileValidationErrors>> {
    const height = parseNumber(input.height);
    const weight = parseNumber(input.weight);
    const isImperial = input.preferredUnitSystem === 'imperial';
    const profile = UserProfile.create(
      {
        activityLevel: input.activityLevel,
        biologicalSex: input.biologicalSex,
        dateOfBirth: input.dateOfBirth,
        heightMillimeters: height * (isImperial ? 25.4 : 10),
        preferredUnitSystem: input.preferredUnitSystem,
        weightGrams: weight * (isImperial ? 453.59237 : 1_000),
      },
      formatLocalCalendarDate(this.getCurrentDate()),
    );

    if (isErr(profile)) return profile;

    await this.transactionRunner.run((context) =>
      context.personalProfileRepository.save(profile.value),
    );
    return profile;
  }
}
