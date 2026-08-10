import type { LocalCalendarDateRange } from '../../../application/date/local-calendar-date';
import type { HydrationProgressReader } from '../../hydration-tracking/application/hydration-progress-reader';
import type { NutritionProgressReader } from '../../nutrition-logging/application/nutrition-progress-reader';
import {
  GetProgressSummaryUseCase,
  type ProgressWorkoutReader,
} from './get-progress-summary-use-case';

const range: LocalCalendarDateRange = {
  endLocalCalendarDate: '2026-08-02',
  startLocalCalendarDate: '2026-08-01',
};

describe('GetProgressSummaryUseCase', () => {
  it('distinguishes unlogged days and averages only over logged days', async () => {
    const summary = await createUseCase({ nutritionComplete: true }).execute(
      range,
    );
    expect(summary.days).toHaveLength(2);
    expect(summary.days[0]).toMatchObject({ hydration: null, nutrition: null });
    expect(summary.nutrition).toMatchObject({
      averageEnergyKilojoulesPerLoggedDay: 1_000,
      energyKilojoules: 1_000,
      loggedDayCount: 1,
    });
    expect(summary.hydration.averageFluidMillilitersPerLoggedDay).toBe(500);
  });

  it('does not expose partial nutrient totals or averages as exact', async () => {
    const summary = await createUseCase({ nutritionComplete: false }).execute(
      range,
    );
    expect(summary.nutrition.protein).toEqual({
      averageGramsPerLoggedDay: null,
      isComplete: false,
      totalGrams: null,
    });
    expect(summary.nutrition.energyKilojoules).toBe(1_000);
  });

  it('rejects invalid ranges before reading any capability', async () => {
    const useCase = createUseCase({ nutritionComplete: true });
    await expect(
      useCase.execute({
        endLocalCalendarDate: '2026-02-30',
        startLocalCalendarDate: '2026-02-01',
      }),
    ).rejects.toThrow('Progress date range is invalid.');
  });
});

function createUseCase({ nutritionComplete }: { nutritionComplete: boolean }) {
  const nutrition: NutritionProgressReader = {
    summarizeRange: () =>
      Promise.resolve([
        {
          carbohydrate: { isComplete: true, totalGrams: 20 },
          energyKilojoules: 1_000,
          entryCount: 2,
          fat: { isComplete: true, totalGrams: 8 },
          localCalendarDate: '2026-08-02',
          protein: {
            isComplete: nutritionComplete,
            totalGrams: nutritionComplete ? 12 : null,
          },
        },
      ]),
  };
  const hydration: HydrationProgressReader = {
    summarizeRange: () =>
      Promise.resolve([
        {
          entryCount: 1,
          localCalendarDate: '2026-08-02',
          otherFluidMilliliters: 0,
          plainWaterMilliliters: 500,
          totalFluidMilliliters: 500,
        },
      ]),
  };
  const workout: ProgressWorkoutReader = {
    summarizeCompletedByDay: () => Promise.resolve([]),
    summarizeCompletedRange: () =>
      Promise.resolve({
        actualSetCount: 0,
        completedWorkoutCount: 0,
        distanceMillimeters: null,
        durationSeconds: null,
        elapsedWorkoutSeconds: 0,
        performedExerciseCount: 0,
        recordedLoadVolumeGramRepetitions: null,
        repetitions: null,
      }),
  };
  return new GetProgressSummaryUseCase(nutrition, hydration, workout);
}
