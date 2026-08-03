import { summarizeConsumptionEntries } from '@fitness/domain';
import type { ConsumptionEntryRepository } from './consumption-entry-repository';

export class GetDailyNutritionUseCase {
  constructor(private readonly repository: ConsumptionEntryRepository) {}

  async execute(localCalendarDate: string) {
    const entries = await this.repository.listByLocalDate(localCalendarDate);
    const summary = summarizeConsumptionEntries(entries);
    if (!summary.isSuccess) throw new Error(summary.error.message);
    return Object.freeze({ entries, summary: summary.value });
  }
}
