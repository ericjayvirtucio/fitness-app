import type { LocalCalendarDateRange } from '../../../application/date/local-calendar-date';

export type HydrationProgressDay = Readonly<{
  entryCount: number;
  localCalendarDate: string;
  otherFluidMilliliters: number;
  plainWaterMilliliters: number;
  totalFluidMilliliters: number;
}>;

export interface HydrationProgressReader {
  summarizeRange(
    range: LocalCalendarDateRange,
  ): Promise<readonly HydrationProgressDay[]>;
}
