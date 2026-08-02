import type { PersonalProfileRepository } from '../../personal-profile/application/personal-profile-repository';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import {
  deriveEnergySummary,
  type EnergySummaryOutcome,
} from './energy-summary';
import type { GoalRepository } from './goal-repository';

export class GetEnergySummaryUseCase {
  constructor(
    private readonly profileRepository: PersonalProfileRepository,
    private readonly goalRepository: GoalRepository,
    private readonly getCurrentDate: () => Date,
  ) {}

  async execute(): Promise<EnergySummaryOutcome> {
    const [profile, goal] = await Promise.all([
      this.profileRepository.get(),
      this.goalRepository.get(),
    ]);
    if (profile === null) return { status: 'profile-required' };
    return deriveEnergySummary(
      profile,
      goal,
      formatLocalCalendarDate(this.getCurrentDate()),
    );
  }
}
