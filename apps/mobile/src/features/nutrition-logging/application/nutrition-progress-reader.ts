import type { LocalCalendarDateRange } from '../../../application/date/local-calendar-date';

export type NutrientProgressValue = Readonly<{
  isComplete: boolean;
  totalGrams: number | null;
}>;

export type NutritionProgressDay = Readonly<{
  carbohydrate: NutrientProgressValue;
  energyKilojoules: number;
  entryCount: number;
  fat: NutrientProgressValue;
  localCalendarDate: string;
  protein: NutrientProgressValue;
}>;

export interface NutritionProgressReader {
  summarizeRange(
    range: LocalCalendarDateRange,
  ): Promise<readonly NutritionProgressDay[]>;
}
