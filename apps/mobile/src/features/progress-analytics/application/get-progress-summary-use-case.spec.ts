import { UserProfile, isErr } from '@fitness/domain';
import type { LocalCalendarDateRange } from '../../../application/date/local-calendar-date';
import type {
  BodyWeightProgressReader,
  BodyWeightProgressSummary,
} from '../../body-measurement-history/application/body-weight-progress-reader';
import type { PersonalProfileRepository } from '../../personal-profile/application/personal-profile-repository';
import type {
  HydrationProgressDay,
  HydrationProgressReader,
} from '../../hydration-tracking/application/hydration-progress-reader';
import type {
  NutritionProgressDay,
  NutritionProgressReader,
} from '../../nutrition-logging/application/nutrition-progress-reader';
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
    // Every field is pinned rather than sampled, so a later change to what
    // the summary presents cannot quietly change what it computes.
    expect(summary.nutrition).toEqual({
      averageEnergyKilojoulesPerLoggedDay: 1_000,
      carbohydrate: { averagePerLoggedDay: 20, total: 20 },
      energyKilojoules: 1_000,
      entryCount: 2,
      fat: { averagePerLoggedDay: 8, total: 8 },
      fiber: { averagePerLoggedDay: 5, total: 5 },
      loggedDayCount: 1,
      protein: { averagePerLoggedDay: 12, total: 12 },
      sodium: { averagePerLoggedDay: 450, total: 450 },
      sugar: { averagePerLoggedDay: 9, total: 9 },
    });
    expect(summary.hydration.averageFluidMillilitersPerLoggedDay).toBe(500);
  });

  it('does not expose partial nutrient totals or averages as exact', async () => {
    const summary = await createUseCase({ nutritionComplete: false }).execute(
      range,
    );
    expect(summary.nutrition.protein).toEqual({
      averagePerLoggedDay: null,
      total: null,
    });
    expect(summary.nutrition.energyKilojoules).toBe(1_000);
  });

  it('averages a nutrient over logged days rather than days in the period', async () => {
    // Three days in range and two logged days, so a per-day denominator would
    // produce 10 g and a per-logged-day denominator produces 15 g. This pins
    // arithmetic the use case already performed; the line that displays it is
    // what is new.
    const summary = await createUseCase({
      nutritionComplete: true,
      nutritionDays: [
        {
          carbohydrate: { total: 40 },
          energyKilojoules: 600,
          entryCount: 1,
          fat: { total: 6 },
          fiber: { total: 8 },
          localCalendarDate: '2026-08-01',
          protein: { total: 20 },
          sodium: { total: 600 },
          sugar: { total: 12 },
        },
        {
          carbohydrate: { total: 20 },
          energyKilojoules: 400,
          entryCount: 1,
          fat: { total: 4 },
          fiber: { total: 4 },
          localCalendarDate: '2026-08-03',
          protein: { total: 10 },
          sodium: { total: 300 },
          sugar: { total: 6 },
        },
      ],
    }).execute({
      endLocalCalendarDate: '2026-08-03',
      startLocalCalendarDate: '2026-08-01',
    });

    expect(summary.nutrition.loggedDayCount).toBe(2);
    expect(summary.nutrition.protein).toEqual({
      averagePerLoggedDay: 15,
      total: 30,
    });
    expect(summary.nutrition.carbohydrate).toEqual({
      averagePerLoggedDay: 30,
      total: 60,
    });
    expect(summary.nutrition.fat).toEqual({
      averagePerLoggedDay: 5,
      total: 10,
    });
    expect(summary.nutrition.fiber).toEqual({
      averagePerLoggedDay: 6,
      total: 12,
    });
    expect(summary.nutrition.sugar).toEqual({
      averagePerLoggedDay: 9,
      total: 18,
    });
    // Sodium's milligrams are summed and divided exactly as the gram nutrients
    // are. The use case never converts a unit; it never learns one.
    expect(summary.nutrition.sodium).toEqual({
      averagePerLoggedDay: 450,
      total: 900,
    });
  });

  it('reports an omitted new nutrient in the same null shape the macronutrients use', async () => {
    const summary = await createUseCase({
      nutritionComplete: true,
      nutritionDays: [
        {
          carbohydrate: { total: 40 },
          energyKilojoules: 600,
          entryCount: 1,
          fat: { total: 6 },
          fiber: { total: 8 },
          localCalendarDate: '2026-08-01',
          protein: { total: 20 },
          sodium: { total: 600 },
          sugar: { total: 12 },
        },
        {
          carbohydrate: { total: 20 },
          energyKilojoules: 400,
          entryCount: 1,
          fat: { total: 4 },
          fiber: { total: 4 },
          localCalendarDate: '2026-08-03',
          protein: { total: 10 },
          // One day omitted sodium, so the whole period's sodium is unknown.
          sodium: { total: null },
          sugar: { total: 6 },
        },
      ],
    }).execute({
      endLocalCalendarDate: '2026-08-03',
      startLocalCalendarDate: '2026-08-01',
    });

    expect(summary.nutrition.sodium).toEqual({
      averagePerLoggedDay: null,
      total: null,
    });
    // Every other nutrient stays exact. One unknown nutrient nullifies itself
    // and nothing beside it.
    expect(summary.nutrition.fiber).toEqual({
      averagePerLoggedDay: 6,
      total: 12,
    });
    expect(summary.nutrition.protein).toEqual({
      averagePerLoggedDay: 15,
      total: 30,
    });
  });

  it('separates plain water from other fluids and averages both over logged days', async () => {
    const summary = await createUseCase({
      hydrationDays: [
        {
          entryCount: 2,
          localCalendarDate: '2026-08-01',
          otherFluidMilliliters: 250,
          plainWaterMilliliters: 500,
          totalFluidMilliliters: 750,
        },
        {
          entryCount: 1,
          localCalendarDate: '2026-08-03',
          otherFluidMilliliters: 0,
          plainWaterMilliliters: 300,
          totalFluidMilliliters: 300,
        },
      ],
      nutritionComplete: true,
    }).execute({
      endLocalCalendarDate: '2026-08-03',
      startLocalCalendarDate: '2026-08-01',
    });

    expect(summary.hydration).toEqual({
      averageFluidMillilitersPerLoggedDay: 525,
      averagePlainWaterMillilitersPerLoggedDay: 400,
      entryCount: 3,
      loggedDayCount: 2,
      otherFluidMilliliters: 250,
      plainWaterMilliliters: 800,
      totalFluidMilliliters: 1_050,
    });
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

  it('reports no body weight data rather than a zero weight', async () => {
    const summary = await createUseCase({ nutritionComplete: true }).execute(
      range,
    );
    expect(summary.bodyWeight).toBeNull();
  });

  it('passes through recorded first, latest, and change values', async () => {
    const bodyWeight: BodyWeightProgressSummary = {
      changeGrams: -1_200,
      entryCount: 2,
      firstGrams: 83_000,
      firstLocalCalendarDate: '2026-08-01',
      latestGrams: 81_800,
      latestLocalCalendarDate: '2026-08-02',
    };
    const summary = await createUseCase({
      bodyWeight,
      nutritionComplete: true,
    }).execute(range);

    expect(summary.bodyWeight).toEqual(bodyWeight);
  });

  it('reads the current profile preference for display only', async () => {
    const withProfile = await createUseCase({
      nutritionComplete: true,
      preferredUnitSystem: 'imperial',
    }).execute(range);
    const withoutProfile = await createUseCase({
      nutritionComplete: true,
    }).execute(range);

    expect(withProfile.preferredUnitSystem).toBe('imperial');
    expect(withoutProfile.preferredUnitSystem).toBe('metric');
  });
});

function storedProfile(
  preferredUnitSystem: 'imperial' | 'metric',
): UserProfile {
  const created = UserProfile.create(
    {
      activityLevel: 'moderately-active',
      biologicalSex: 'female',
      dateOfBirth: '1990-06-15',
      heightMillimeters: 1_650,
      preferredUnitSystem,
      weightGrams: 83_000,
    },
    '2026-08-10',
  );
  if (isErr(created)) throw new Error('Invalid fixture');
  return created.value;
}

function createUseCase({
  bodyWeight: bodyWeightSummary = null,
  hydrationDays,
  nutritionComplete,
  nutritionDays,
  preferredUnitSystem,
}: {
  bodyWeight?: BodyWeightProgressSummary | null;
  hydrationDays?: readonly HydrationProgressDay[];
  nutritionComplete: boolean;
  nutritionDays?: readonly NutritionProgressDay[];
  preferredUnitSystem?: 'imperial' | 'metric';
}) {
  const nutrition: NutritionProgressReader = {
    summarizeRange: () =>
      Promise.resolve(
        nutritionDays ?? [
          {
            carbohydrate: { total: 20 },
            energyKilojoules: 1_000,
            entryCount: 2,
            fat: { total: 8 },
            fiber: { total: 5 },
            localCalendarDate: '2026-08-02',
            protein: { total: nutritionComplete ? 12 : null },
            sodium: { total: 450 },
            sugar: { total: 9 },
          },
        ],
      ),
  };
  const hydration: HydrationProgressReader = {
    summarizeRange: () =>
      Promise.resolve(
        hydrationDays ?? [
          {
            entryCount: 1,
            localCalendarDate: '2026-08-02',
            otherFluidMilliliters: 0,
            plainWaterMilliliters: 500,
            totalFluidMilliliters: 500,
          },
        ],
      ),
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
  const bodyWeight: BodyWeightProgressReader = {
    summarizeRange: () => Promise.resolve(bodyWeightSummary),
  };
  const profile: PersonalProfileRepository = {
    get: () =>
      Promise.resolve(
        preferredUnitSystem ? storedProfile(preferredUnitSystem) : null,
      ),
    save: () => Promise.resolve(),
  };
  return new GetProgressSummaryUseCase(
    nutrition,
    hydration,
    workout,
    bodyWeight,
    profile,
  );
}
