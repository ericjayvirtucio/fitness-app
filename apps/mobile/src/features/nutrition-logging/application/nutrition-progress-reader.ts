import type { LocalCalendarDateRange } from '../../../application/date/local-calendar-date';

/**
 * A nutrient's period value in the unit that nutrient is recorded in — grams
 * for five of the six, milligrams for sodium — so the field names the value
 * rather than a unit that would be false for one of them. Null when any
 * included entry omitted the nutrient; absence carries that fact, so no
 * separate completeness flag says it a second time.
 */
export type NutrientProgressValue = Readonly<{
  total: number | null;
}>;

export type NutritionProgressDay = Readonly<{
  carbohydrate: NutrientProgressValue;
  energyKilojoules: number;
  entryCount: number;
  fat: NutrientProgressValue;
  fiber: NutrientProgressValue;
  localCalendarDate: string;
  protein: NutrientProgressValue;
  sodium: NutrientProgressValue;
  sugar: NutrientProgressValue;
}>;

export interface NutritionProgressReader {
  summarizeRange(
    range: LocalCalendarDateRange,
  ): Promise<readonly NutritionProgressDay[]>;
}
