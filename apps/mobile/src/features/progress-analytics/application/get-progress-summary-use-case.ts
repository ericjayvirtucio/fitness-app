import {
  enumerateLocalCalendarDates,
  isLocalCalendarDateRange,
  type LocalCalendarDateRange,
} from '../../../application/date/local-calendar-date';
import type { BodyWeightProgressReader } from '../../body-measurement-history/application/body-weight-progress-reader';
import type { PersonalProfileRepository } from '../../personal-profile/application/personal-profile-repository';
import type {
  HydrationProgressDay,
  HydrationProgressReader,
} from '../../hydration-tracking/application/hydration-progress-reader';
import type {
  NutrientProgressValue,
  NutritionProgressDay,
  NutritionProgressReader,
} from '../../nutrition-logging/application/nutrition-progress-reader';
import type {
  WorkoutProgressDay,
  WorkoutProgressSummary,
} from '../../workout-history/application/workout-history-models';
import type {
  ProgressDay,
  ProgressHydrationSummary,
  ProgressNutrientSummary,
  ProgressNutritionSummary,
  ProgressSummary,
} from './progress-models';

export interface ProgressWorkoutReader {
  summarizeCompletedByDay(
    range: LocalCalendarDateRange,
  ): Promise<readonly WorkoutProgressDay[]>;
  summarizeCompletedRange(
    range: LocalCalendarDateRange,
  ): Promise<WorkoutProgressSummary>;
}

export class GetProgressSummaryUseCase {
  constructor(
    private readonly nutrition: NutritionProgressReader,
    private readonly hydration: HydrationProgressReader,
    private readonly workout: ProgressWorkoutReader,
    private readonly bodyWeight: BodyWeightProgressReader,
    // Read for the display unit only. Progress never treats a mutable
    // singleton as historical truth.
    private readonly profile: PersonalProfileRepository,
  ) {}

  async execute(range: LocalCalendarDateRange): Promise<ProgressSummary> {
    if (!isLocalCalendarDateRange(range))
      throw new Error('Progress date range is invalid.');
    const [
      nutritionDays,
      hydrationDays,
      workout,
      workoutDays,
      bodyWeight,
      profile,
    ] = await Promise.all([
      this.nutrition.summarizeRange(range),
      this.hydration.summarizeRange(range),
      this.workout.summarizeCompletedRange(range),
      this.workout.summarizeCompletedByDay(range),
      this.bodyWeight.summarizeRange(range),
      this.profile.get(),
    ]);
    return Object.freeze({
      bodyWeight,
      days: combineDays(range, nutritionDays, hydrationDays, workoutDays),
      hydration: summarizeHydration(hydrationDays),
      nutrition: summarizeNutrition(nutritionDays),
      preferredUnitSystem: profile?.preferredUnitSystem ?? 'metric',
      range,
      workout,
    });
  }
}

function summarizeNutrition(
  days: readonly NutritionProgressDay[],
): ProgressNutritionSummary {
  const loggedDayCount = days.length;
  const energyKilojoules = sum(days.map((day) => day.energyKilojoules));
  return Object.freeze({
    averageEnergyKilojoulesPerLoggedDay:
      loggedDayCount === 0 ? null : energyKilojoules / loggedDayCount,
    carbohydrate: summarizeNutrient(days.map((day) => day.carbohydrate)),
    energyKilojoules,
    entryCount: sum(days.map((day) => day.entryCount)),
    fat: summarizeNutrient(days.map((day) => day.fat)),
    loggedDayCount,
    protein: summarizeNutrient(days.map((day) => day.protein)),
  });
}

function summarizeNutrient(
  values: readonly NutrientProgressValue[],
): ProgressNutrientSummary {
  const isComplete = values.every((value) => value.total !== null);
  const total = isComplete
    ? sum(values.map((value) => value.total ?? 0))
    : null;
  return Object.freeze({
    averagePerLoggedDay:
      total === null || values.length === 0 ? null : total / values.length,
    total,
  });
}

function summarizeHydration(
  days: readonly HydrationProgressDay[],
): ProgressHydrationSummary {
  const loggedDayCount = days.length;
  const totalFluidMilliliters = sum(
    days.map((day) => day.totalFluidMilliliters),
  );
  const plainWaterMilliliters = sum(
    days.map((day) => day.plainWaterMilliliters),
  );
  return Object.freeze({
    averageFluidMillilitersPerLoggedDay:
      loggedDayCount === 0 ? null : totalFluidMilliliters / loggedDayCount,
    averagePlainWaterMillilitersPerLoggedDay:
      loggedDayCount === 0 ? null : plainWaterMilliliters / loggedDayCount,
    entryCount: sum(days.map((day) => day.entryCount)),
    loggedDayCount,
    otherFluidMilliliters: sum(days.map((day) => day.otherFluidMilliliters)),
    plainWaterMilliliters,
    totalFluidMilliliters,
  });
}

function combineDays(
  range: LocalCalendarDateRange,
  nutrition: readonly NutritionProgressDay[],
  hydration: readonly HydrationProgressDay[],
  workout: readonly WorkoutProgressDay[],
): readonly ProgressDay[] {
  const nutritionByDate = new Map(
    nutrition.map((day) => [day.localCalendarDate, day]),
  );
  const hydrationByDate = new Map(
    hydration.map((day) => [day.localCalendarDate, day]),
  );
  const workoutByDate = new Map(
    workout.map((day) => [day.localCalendarDate, day]),
  );
  return Object.freeze(
    enumerateLocalCalendarDates(range).map((localCalendarDate) =>
      Object.freeze({
        hydration: hydrationByDate.get(localCalendarDate) ?? null,
        localCalendarDate,
        nutrition: nutritionByDate.get(localCalendarDate) ?? null,
        workout: workoutByDate.get(localCalendarDate) ?? null,
      }),
    ),
  );
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
