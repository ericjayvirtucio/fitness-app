import {
  UserProfile,
  isErr,
  type BodyWeightEntry,
  type DomainError,
  type Result,
} from '@fitness/domain';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type { BodyWeightCheckInTransactionContext } from './body-weight-check-in-context';
import {
  buildBodyWeightEntry,
  type SaveBodyWeightEntryInput,
} from './build-body-weight-entry';
import { isAfterBodyWeightEntry } from './body-weight-history-models';

export type BodyWeightCheckInOptions = Readonly<{
  shouldUpdateProfileWeight: boolean;
}>;

export type BodyWeightCheckIn = Readonly<{
  entry: BodyWeightEntry;
  isProfileWeightUpdated: boolean;
}>;

export type BodyWeightCheckInResult = Result<
  BodyWeightCheckIn,
  readonly DomainError[]
>;

export class CreateBodyWeightCheckInUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<BodyWeightCheckInTransactionContext>,
    private readonly generateId: () => string,
    private readonly getCurrentDate: () => Date,
  ) {}

  async execute(
    input: SaveBodyWeightEntryInput,
    options: BodyWeightCheckInOptions = { shouldUpdateProfileWeight: false },
  ): Promise<BodyWeightCheckInResult> {
    const now = this.getCurrentDate();
    const built = buildBodyWeightEntry(this.generateId(), input, now.getTime());
    if (!built.isSuccess) return built;
    const entry = built.value;

    const isProfileWeightUpdated = await this.transactionRunner.run(
      async (context) => {
        const latest = await context.bodyWeightEntryRepository.getLatest();
        const isNewest =
          latest === null || isAfterBodyWeightEntry(entry, latest);
        await context.bodyWeightEntryRepository.insert(entry);
        if (!options.shouldUpdateProfileWeight || !isNewest) return false;

        const profile = await context.personalProfileRepository.get();
        if (profile === null) return false;
        await context.personalProfileRepository.save(
          withWeight(profile, entry, formatLocalCalendarDate(now)),
        );
        return true;
      },
    );

    return { isSuccess: true, value: { entry, isProfileWeightUpdated } };
  }
}

function withWeight(
  profile: UserProfile,
  entry: BodyWeightEntry,
  currentDate: string,
): UserProfile {
  const updated = UserProfile.create(
    {
      activityLevel: profile.activityLevel,
      biologicalSex: profile.biologicalSex,
      dateOfBirth: profile.dateOfBirth,
      heightMillimeters: profile.height.millimeters,
      preferredUnitSystem: profile.preferredUnitSystem,
      weightGrams: entry.mass.grams,
    },
    currentDate,
  );
  // A stored profile plus an accepted check-in weight are both already valid,
  // so this cannot fail. Throwing rolls the whole check-in back rather than
  // leaving history and the profile disagreeing.
  if (isErr(updated))
    throw new Error('Profile weight could not be updated from the check-in.');
  return updated.value;
}
