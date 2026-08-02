import {
  DomainError,
  GoalConfiguration,
  err,
  isErr,
  type Result,
} from '@fitness/domain';
import type { PersonalProfileRepository } from '../../personal-profile/application/personal-profile-repository';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import { deriveEnergySummary, validateGoalForSummary } from './energy-summary';
import type { GoalRepository } from './goal-repository';

export type SaveGoalInput = Readonly<{
  adjustmentKilocalories: unknown;
  goalType: unknown;
}>;

function parseAdjustment(value: unknown): number {
  if (typeof value !== 'string' || value.trim().length === 0) return Number.NaN;
  return Number(value.trim());
}

export class SaveGoalUseCase {
  constructor(
    private readonly profileRepository: PersonalProfileRepository,
    private readonly goalRepository: GoalRepository,
    private readonly getCurrentDate: () => Date,
  ) {}

  async execute(
    input: SaveGoalInput,
  ): Promise<Result<GoalConfiguration, readonly DomainError[]>> {
    const goal = GoalConfiguration.create(
      input.goalType,
      input.goalType === 'maintain-weight'
        ? 0
        : parseAdjustment(input.adjustmentKilocalories),
    );
    if (isErr(goal)) return err(Object.freeze([goal.error]));

    const profile = await this.profileRepository.get();
    if (profile === null) {
      return err(
        Object.freeze([
          DomainError.create(
            'required-field',
            'Complete your profile before saving a goal.',
            'profile',
          ),
        ]),
      );
    }
    const outcome = deriveEnergySummary(
      profile,
      null,
      formatLocalCalendarDate(this.getCurrentDate()),
    );
    const validated = validateGoalForSummary(outcome, goal.value);
    if (isErr(validated)) return validated;

    await this.goalRepository.save(goal.value);
    return validated;
  }
}
