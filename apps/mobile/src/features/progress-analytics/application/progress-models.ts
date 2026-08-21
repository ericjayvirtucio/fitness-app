import type { UnitSystem } from '@fitness/domain';
import type { LocalCalendarDateRange } from '../../../application/date/local-calendar-date';
import type { BodyWeightProgressSummary } from '../../body-measurement-history/application/body-weight-progress-reader';
import type { HydrationProgressDay } from '../../hydration-tracking/application/hydration-progress-reader';
import type { NutritionProgressDay } from '../../nutrition-logging/application/nutrition-progress-reader';
import type {
  WorkoutProgressDay,
  WorkoutProgressSummary,
} from '../../workout-history/application/workout-history-models';

/**
 * A nutrient is incomplete when any included entry omitted it, and both the
 * total and the average are then unknown together. Absence carries that fact,
 * so no separate completeness flag says it a second time.
 *
 * Both values are in the unit that nutrient is recorded in — grams for five of
 * the six, milligrams for sodium — so neither field name states a unit that
 * would be false for one of them. The caller supplies the unit it renders.
 */
export type ProgressNutrientSummary = Readonly<{
  averagePerLoggedDay: number | null;
  total: number | null;
}>;

export type ProgressNutritionSummary = Readonly<{
  averageEnergyKilojoulesPerLoggedDay: number | null;
  carbohydrate: ProgressNutrientSummary;
  energyKilojoules: number;
  entryCount: number;
  fat: ProgressNutrientSummary;
  loggedDayCount: number;
  protein: ProgressNutrientSummary;
}>;

export type ProgressHydrationSummary = Readonly<{
  averageFluidMillilitersPerLoggedDay: number | null;
  averagePlainWaterMillilitersPerLoggedDay: number | null;
  entryCount: number;
  loggedDayCount: number;
  otherFluidMilliliters: number;
  plainWaterMilliliters: number;
  totalFluidMilliliters: number;
}>;

export type ProgressDay = Readonly<{
  hydration: HydrationProgressDay | null;
  localCalendarDate: string;
  nutrition: NutritionProgressDay | null;
  workout: WorkoutProgressDay | null;
}>;

export type ProgressSummary = Readonly<{
  /** Null when no weight was recorded in the period; never a zero weight. */
  bodyWeight: BodyWeightProgressSummary | null;
  days: readonly ProgressDay[];
  hydration: ProgressHydrationSummary;
  nutrition: ProgressNutritionSummary;
  /** Current profile preference. Affects display only, never stored values. */
  preferredUnitSystem: UnitSystem;
  range: LocalCalendarDateRange;
  workout: WorkoutProgressSummary;
}>;
