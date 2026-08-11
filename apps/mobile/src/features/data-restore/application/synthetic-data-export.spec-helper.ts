/**
 * Synthetic version 1 export documents shared by the restore test suites.
 *
 * Nothing here is a real person, a real measurement, or a real meal, and
 * nothing is copied from a device. The file is named `.spec-helper.ts` so the
 * test runner does not treat it as a suite and so nothing in the application
 * can import it by accident.
 */

export type Json = Record<string, unknown>;

export const syntheticToday = '2026-08-11';
export const syntheticOccurredAt = Date.UTC(2026, 7, 4, 4);
export const syntheticUtcOffsetMinutes = 480;
export const syntheticLocalCalendarDate = '2026-08-04';

export const syntheticIds = Object.freeze({
  activeSession: '123e4567-e89b-42d3-a456-426614174010',
  activeSessionExercise: '123e4567-e89b-42d3-a456-426614174011',
  activeSessionSet: '123e4567-e89b-42d3-a456-426614174012',
  catalogItem: '123e4567-e89b-42d3-a456-426614174002',
  checkIn: '123e4567-e89b-42d3-a456-426614174009',
  hydrationEntry: '123e4567-e89b-42d3-a456-426614174003',
  nutritionEntry: '123e4567-e89b-42d3-a456-426614174001',
  plannedExercise: '123e4567-e89b-42d3-a456-426614174006',
  plannedWorkout: '123e4567-e89b-42d3-a456-426614174005',
  session: '123e4567-e89b-42d3-a456-426614174007',
  sessionExercise: '123e4567-e89b-42d3-a456-426614174008',
  sessionSet: '123e4567-e89b-42d3-a456-42661417400a',
  squat: '123e4567-e89b-42d3-a456-426614174004',
});

const occurrence = (): Json => ({
  localCalendarDate: syntheticLocalCalendarDate,
  occurredAtEpochMilliseconds: syntheticOccurredAt,
  utcOffsetMinutes: syntheticUtcOffsetMinutes,
});

export const buildProfile = (overrides: Json = {}): Json => ({
  activityLevel: 'moderately-active',
  biologicalSex: 'female',
  dateOfBirth: '1990-05-04',
  heightMillimeters: 1750,
  preferredUnitSystem: 'metric',
  weightGrams: 72_000,
  ...overrides,
});

/** A known zero and an unknown amount, side by side, on purpose. */
export const buildNutrition = (overrides: Json = {}): Json => ({
  carbohydrateGrams: 0,
  energyKilojoules: 1_500,
  fatGrams: null,
  fiberGrams: null,
  proteinGrams: 12.5,
  sodiumMilligrams: null,
  sugarGrams: null,
  ...overrides,
});

export const buildNutritionEntry = (overrides: Json = {}): Json => ({
  ...occurrence(),
  consumedQuantity: { amountGrams: 150, kind: 'mass' },
  description: 'E2E Oats',
  id: syntheticIds.nutritionEntry,
  kind: 'food',
  provenance: 'provided',
  reference: { amountGrams: 100, kind: 'mass' },
  referenceNutrition: buildNutrition(),
  ...overrides,
});

export const buildCatalogItem = (overrides: Json = {}): Json => ({
  description: 'E2E Oat Drink',
  id: syntheticIds.catalogItem,
  isFavorite: true,
  kind: 'beverage',
  lastUsedAtEpochMilliseconds: syntheticOccurredAt,
  provenance: 'estimated',
  reference: { amountMilliliters: 250, kind: 'volume' },
  referenceNutrition: buildNutrition(),
  useCount: 2,
  ...overrides,
});

export const buildHydrationEntry = (overrides: Json = {}): Json => ({
  ...occurrence(),
  description: null,
  fluidType: 'plain-water',
  id: syntheticIds.hydrationEntry,
  volumeMilliliters: 500,
  ...overrides,
});

export const buildExercise = (overrides: Json = {}): Json => ({
  equipment: 'barbell',
  id: syntheticIds.squat,
  isFavorite: false,
  loggingMode: 'external-load-and-repetitions',
  name: 'E2E Squat',
  notes: null,
  primaryMuscleGroup: 'quadriceps',
  ...overrides,
});

export const buildPrescription = (overrides: Json = {}): Json => ({
  kind: 'resistance-and-repetitions',
  repetitions: 5,
  resistanceGrams: 60_000,
  sets: 3,
  ...overrides,
});

export const buildResult = (overrides: Json = {}): Json => ({
  kind: 'resistance-and-repetitions',
  repetitions: 5,
  resistanceGrams: 60_000,
  ...overrides,
});

export const buildPlannedWorkout = (overrides: Json = {}): Json => ({
  exercises: [
    {
      exerciseId: syntheticIds.squat,
      id: syntheticIds.plannedExercise,
      position: 0,
      prescription: buildPrescription(),
    },
  ],
  id: syntheticIds.plannedWorkout,
  name: 'E2E Monday',
  weekday: 1,
  ...overrides,
});

export const buildSessionExercise = (overrides: Json = {}): Json => ({
  id: syntheticIds.sessionExercise,
  loggingModeSnapshot: 'external-load-and-repetitions',
  nameSnapshot: 'E2E Squat',
  plannedPrescriptionSnapshot: buildPrescription(),
  position: 0,
  sets: [{ id: syntheticIds.sessionSet, position: 0, result: buildResult() }],
  sourceExerciseId: syntheticIds.squat,
  sourcePlannedExerciseId: syntheticIds.plannedExercise,
  ...overrides,
});

export const buildCompletedSession = (overrides: Json = {}): Json => ({
  completedAtEpochMilliseconds: syntheticOccurredAt + 3_600_000,
  exercises: [buildSessionExercise()],
  id: syntheticIds.session,
  name: 'E2E Leg Day',
  sourcePlannedWorkoutId: syntheticIds.plannedWorkout,
  sourceWeekday: 1,
  startedAtEpochMilliseconds: syntheticOccurredAt,
  startedLocalCalendarDate: syntheticLocalCalendarDate,
  startedUtcOffsetMinutes: syntheticUtcOffsetMinutes,
  status: 'completed',
  ...overrides,
});

export const buildActiveSession = (overrides: Json = {}): Json => ({
  completedAtEpochMilliseconds: null,
  exercises: [
    buildSessionExercise({
      id: syntheticIds.activeSessionExercise,
      sets: [
        {
          id: syntheticIds.activeSessionSet,
          position: 0,
          result: buildResult(),
        },
      ],
    }),
  ],
  id: syntheticIds.activeSession,
  name: 'E2E Today',
  sourcePlannedWorkoutId: null,
  sourceWeekday: null,
  startedAtEpochMilliseconds: syntheticOccurredAt,
  startedLocalCalendarDate: syntheticLocalCalendarDate,
  startedUtcOffsetMinutes: syntheticUtcOffsetMinutes,
  status: 'active',
  ...overrides,
});

export const buildCheckIn = (overrides: Json = {}): Json => ({
  ...occurrence(),
  id: syntheticIds.checkIn,
  massGrams: 71_500,
  note: null,
  ...overrides,
});

export const buildExport = (overrides: Json = {}): Json => ({
  application: { name: 'Fitness App', version: '0.0.0' },
  bodyMeasurements: { weightCheckIns: [buildCheckIn()] },
  exerciseCatalog: { exercises: [buildExercise()] },
  format: 'fitness-app-data-export',
  formatVersion: 1,
  generatedAt: '2026-08-11T09:15:04.123Z',
  goalsAndEnergy: {
    goal: { adjustmentKilocalories: 300, goalType: 'lose-weight' },
  },
  hydration: {
    currentTarget: { targetMilliliters: 2_000 },
    entries: [buildHydrationEntry()],
  },
  nutrition: {
    catalogItems: [buildCatalogItem()],
    entries: [buildNutritionEntry()],
  },
  profile: buildProfile(),
  workoutPlanner: { plannedWorkouts: [buildPlannedWorkout()] },
  workoutSessions: {
    activeSession: null,
    completedSessions: [buildCompletedSession()],
  },
  ...overrides,
});

export const buildEmptyExport = (): Json =>
  buildExport({
    bodyMeasurements: { weightCheckIns: [] },
    exerciseCatalog: { exercises: [] },
    goalsAndEnergy: { goal: null },
    hydration: { currentTarget: null, entries: [] },
    nutrition: { catalogItems: [], entries: [] },
    profile: null,
    workoutPlanner: { plannedWorkouts: [] },
    workoutSessions: { activeSession: null, completedSessions: [] },
  });
