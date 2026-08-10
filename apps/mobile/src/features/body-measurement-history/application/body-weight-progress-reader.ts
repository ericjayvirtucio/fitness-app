import type { LocalCalendarDateRange } from '../../../application/date/local-calendar-date';

export type BodyWeightProgressSummary = Readonly<{
  /** Present only when at least two check-ins exist in the period. */
  changeGrams: number | null;
  entryCount: number;
  firstGrams: number;
  firstLocalCalendarDate: string;
  latestGrams: number;
  latestLocalCalendarDate: string;
}>;

export interface BodyWeightProgressReader {
  /** Resolves null when nothing was recorded; a period is never zero weight. */
  summarizeRange(
    range: LocalCalendarDateRange,
  ): Promise<BodyWeightProgressSummary | null>;
}
