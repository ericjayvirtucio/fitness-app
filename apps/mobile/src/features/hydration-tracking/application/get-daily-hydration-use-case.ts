import { summarizeHydrationEntries } from '@fitness/domain';
import type { HydrationEntryRepository } from './hydration-entry-repository';
import type { HydrationTargetRepository } from './hydration-target-repository';

export class GetDailyHydrationUseCase {
  constructor(
    private readonly entryRepository: HydrationEntryRepository,
    private readonly targetRepository: HydrationTargetRepository,
  ) {}

  async execute(localCalendarDate: string) {
    const [entries, target] = await Promise.all([
      this.entryRepository.listByLocalDate(localCalendarDate),
      this.targetRepository.get(),
    ]);
    const summary = summarizeHydrationEntries(entries, target);
    if (!summary.isSuccess) throw new Error(summary.error.message);
    return Object.freeze({ entries, summary: summary.value });
  }
}
