import type { DataRestoreErrorCode } from './data-restore-error';
import { parseDataExport } from './parse-data-export';
import type { ParsedDataExport } from './restore-data';

/**
 * Synthetic records only. Nothing here is a real person, a real measurement, or
 * a real meal, and nothing is copied from a device.
 */
const today = '2026-08-11';
const occurredAt = Date.UTC(2026, 7, 4, 4);
const utcOffsetMinutes = 480;
const localCalendarDate = '2026-08-04';

const ids = Object.freeze({
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

type Json = Record<string, unknown>;

const occurrence = (): Json => ({
  localCalendarDate,
  occurredAtEpochMilliseconds: occurredAt,
  utcOffsetMinutes,
});

const buildProfile = (overrides: Json = {}): Json => ({
  activityLevel: 'moderately-active',
  biologicalSex: 'female',
  dateOfBirth: '1990-05-04',
  heightMillimeters: 1750,
  preferredUnitSystem: 'metric',
  weightGrams: 72_000,
  ...overrides,
});

/** A known zero and an unknown amount, side by side, on purpose. */
const buildNutrition = (overrides: Json = {}): Json => ({
  carbohydrateGrams: 0,
  energyKilojoules: 1_500,
  fatGrams: null,
  fiberGrams: null,
  proteinGrams: 12.5,
  sodiumMilligrams: null,
  sugarGrams: null,
  ...overrides,
});

const buildNutritionEntry = (overrides: Json = {}): Json => ({
  ...occurrence(),
  consumedQuantity: { amountGrams: 150, kind: 'mass' },
  description: 'E2E Oats',
  id: ids.nutritionEntry,
  kind: 'food',
  provenance: 'provided',
  reference: { amountGrams: 100, kind: 'mass' },
  referenceNutrition: buildNutrition(),
  ...overrides,
});

const buildCatalogItem = (overrides: Json = {}): Json => ({
  description: 'E2E Oat Drink',
  id: ids.catalogItem,
  isFavorite: true,
  kind: 'beverage',
  lastUsedAtEpochMilliseconds: occurredAt,
  provenance: 'estimated',
  reference: { amountMilliliters: 250, kind: 'volume' },
  referenceNutrition: buildNutrition(),
  useCount: 2,
  ...overrides,
});

const buildHydrationEntry = (overrides: Json = {}): Json => ({
  ...occurrence(),
  description: null,
  fluidType: 'plain-water',
  id: ids.hydrationEntry,
  volumeMilliliters: 500,
  ...overrides,
});

const buildExercise = (overrides: Json = {}): Json => ({
  equipment: 'barbell',
  id: ids.squat,
  isFavorite: false,
  loggingMode: 'external-load-and-repetitions',
  name: 'E2E Squat',
  notes: null,
  primaryMuscleGroup: 'quadriceps',
  ...overrides,
});

const buildPrescription = (overrides: Json = {}): Json => ({
  kind: 'resistance-and-repetitions',
  repetitions: 5,
  resistanceGrams: 60_000,
  sets: 3,
  ...overrides,
});

const buildResult = (overrides: Json = {}): Json => ({
  kind: 'resistance-and-repetitions',
  repetitions: 5,
  resistanceGrams: 60_000,
  ...overrides,
});

const buildPlannedWorkout = (overrides: Json = {}): Json => ({
  exercises: [
    {
      exerciseId: ids.squat,
      id: ids.plannedExercise,
      position: 0,
      prescription: buildPrescription(),
    },
  ],
  id: ids.plannedWorkout,
  name: 'E2E Monday',
  weekday: 1,
  ...overrides,
});

const buildSessionExercise = (overrides: Json = {}): Json => ({
  id: ids.sessionExercise,
  loggingModeSnapshot: 'external-load-and-repetitions',
  nameSnapshot: 'E2E Squat',
  plannedPrescriptionSnapshot: buildPrescription(),
  position: 0,
  sets: [{ id: ids.sessionSet, position: 0, result: buildResult() }],
  sourceExerciseId: ids.squat,
  sourcePlannedExerciseId: ids.plannedExercise,
  ...overrides,
});

const buildCompletedSession = (overrides: Json = {}): Json => ({
  completedAtEpochMilliseconds: occurredAt + 3_600_000,
  exercises: [buildSessionExercise()],
  id: ids.session,
  name: 'E2E Leg Day',
  sourcePlannedWorkoutId: ids.plannedWorkout,
  sourceWeekday: 1,
  startedAtEpochMilliseconds: occurredAt,
  startedLocalCalendarDate: localCalendarDate,
  startedUtcOffsetMinutes: utcOffsetMinutes,
  status: 'completed',
  ...overrides,
});

const buildActiveSession = (overrides: Json = {}): Json => ({
  completedAtEpochMilliseconds: null,
  exercises: [
    buildSessionExercise({
      id: ids.activeSessionExercise,
      sets: [{ id: ids.activeSessionSet, position: 0, result: buildResult() }],
    }),
  ],
  id: ids.activeSession,
  name: 'E2E Today',
  sourcePlannedWorkoutId: null,
  sourceWeekday: null,
  startedAtEpochMilliseconds: occurredAt,
  startedLocalCalendarDate: localCalendarDate,
  startedUtcOffsetMinutes: utcOffsetMinutes,
  status: 'active',
  ...overrides,
});

const buildCheckIn = (overrides: Json = {}): Json => ({
  ...occurrence(),
  id: ids.checkIn,
  massGrams: 71_500,
  note: null,
  ...overrides,
});

const buildExport = (overrides: Json = {}): Json => ({
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

const emptyExport = (): Json =>
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

function parse(document: Json): ParsedDataExport {
  const result = parseDataExport(JSON.stringify(document), today);
  if (!result.isSuccess)
    throw new Error(`expected a valid export but got ${result.error.code}`);
  return result.value;
}

function expectRejection(document: Json, code: DataRestoreErrorCode): void {
  expectTextRejection(JSON.stringify(document), code);
}

function expectTextRejection(text: string, code: DataRestoreErrorCode): void {
  const result = parseDataExport(text, today);
  if (result.isSuccess) throw new Error('expected the export to be rejected');
  expect(result.error.code).toBe(code);
}

describe('parseDataExport', () => {
  it('reads a complete version 1 export', () => {
    const { data, preview } = parse(buildExport());

    expect(preview).toEqual({
      bodyWeightCheckIns: 1,
      completedWorkouts: 1,
      exercises: 1,
      generatedAt: '2026-08-11T09:15:04.123Z',
      hasActiveWorkout: false,
      hasGoal: true,
      hasHydrationTarget: true,
      hasProfile: true,
      hydrationEntries: 1,
      nutritionCatalogItems: 1,
      nutritionEntries: 1,
      plannedWorkouts: 1,
    });
    expect(data.profile?.weight.grams).toBe(72_000);
    expect(data.goal?.adjustmentKilocalories).toBe(300);
  });

  it('reads a valid empty export as a success', () => {
    const { data, preview } = parse(emptyExport());

    expect(preview.hasProfile).toBe(false);
    expect(preview.nutritionEntries).toBe(0);
    expect(data.completedSessions).toHaveLength(0);
  });

  it('preserves exported identifiers exactly', () => {
    const { data } = parse(buildExport());

    expect(data.nutritionEntries[0]?.id.value).toBe(ids.nutritionEntry);
    expect(data.exercises[0]?.definition.id.value).toBe(ids.squat);
    expect(data.completedSessions[0]?.exercises[0]?.sets[0]?.id.value).toBe(
      ids.sessionSet,
    );
  });

  it('preserves canonical amounts without conversion', () => {
    const { data } = parse(buildExport());

    expect(data.bodyWeightCheckIns[0]?.mass.grams).toBe(71_500);
    expect(data.hydrationEntries[0]?.volume.milliliters).toBe(500);
    expect(data.hydrationTarget?.volume.milliliters).toBe(2_000);
    expect(data.nutritionEntries[0]?.facts.energy.kilojoules).toBe(1_500);
  });

  it('preserves the stored occurrence triple', () => {
    const { data } = parse(buildExport());
    const entry = data.hydrationEntries[0];

    expect(entry?.occurredAtEpochMilliseconds).toBe(occurredAt);
    expect(entry?.localCalendarDate).toBe(localCalendarDate);
    expect(entry?.utcOffsetMinutes).toBe(utcOffsetMinutes);
  });

  it('keeps an unknown nutrient unknown and a known zero zero', () => {
    const { data } = parse(buildExport());
    const nutrients = data.nutritionEntries[0]?.facts.nutrients;

    expect(nutrients?.fatGrams).toBeNull();
    expect(nutrients?.carbohydrateGrams).toBe(0);
  });

  it('ignores an unknown key', () => {
    expect(() =>
      parse(buildExport({ futureSection: { anything: true } })),
    ).not.toThrow();
  });

  it('rejects a file that is not a Fitness App export', () => {
    expectRejection(
      buildExport({ format: 'something-else' }),
      'unsupported-format',
    );
    expectTextRejection('{"hello":"world"}', 'unsupported-format');
  });

  it('rejects an unsupported format version', () => {
    expectRejection(
      buildExport({ formatVersion: 2 }),
      'unsupported-format-version',
    );
  });

  it('rejects invalid JSON', () => {
    expectTextRejection('{ not json', 'invalid-json');
  });

  it('rejects a wrong primitive type', () => {
    expectRejection(
      buildExport({ profile: buildProfile({ weightGrams: '72000' }) }),
      'invalid-structure',
    );
  });

  it('rejects a missing required key', () => {
    const document = buildExport();
    delete document['hydration'];

    expectRejection(document, 'invalid-structure');
  });

  it('rejects a null where the contract has no option', () => {
    expectRejection(
      buildExport({ hydration: { currentTarget: null, entries: null } }),
      'invalid-structure',
    );
  });

  it('rejects an unknown enumeration value', () => {
    expectRejection(
      buildExport({
        hydration: {
          currentTarget: null,
          entries: [buildHydrationEntry({ fluidType: 'lemonade' })],
        },
      }),
      'invalid-structure',
    );
  });

  it('rejects a nonfinite number', () => {
    const text = JSON.stringify(buildExport()).replace(
      '"volumeMilliliters":500',
      '"volumeMilliliters":1e999',
    );

    expectTextRejection(text, 'invalid-structure');
  });

  it('rejects an out-of-range value', () => {
    expectRejection(
      buildExport({
        bodyMeasurements: { weightCheckIns: [buildCheckIn({ massGrams: 1 })] },
      }),
      'invalid-record',
    );
  });

  it('rejects a malformed identifier', () => {
    expectRejection(
      buildExport({
        bodyMeasurements: {
          weightCheckIns: [buildCheckIn({ id: 'not-a-uuid' })],
        },
      }),
      'invalid-structure',
    );
  });

  it('rejects a duplicate identifier', () => {
    expectRejection(
      buildExport({
        bodyMeasurements: { weightCheckIns: [buildCheckIn(), buildCheckIn()] },
      }),
      'duplicate-identifier',
    );
  });

  it('rejects a local date that disagrees with the stored instant', () => {
    expectRejection(
      buildExport({
        bodyMeasurements: {
          weightCheckIns: [buildCheckIn({ localCalendarDate: '2026-08-05' })],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects an impossible UTC offset', () => {
    expectRejection(
      buildExport({
        bodyMeasurements: {
          weightCheckIns: [buildCheckIn({ utcOffsetMinutes: 900 })],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects a collection above its ceiling', () => {
    const plannedWorkouts = Array.from({ length: 8 }, (_unused, index) =>
      buildPlannedWorkout({ weekday: index % 7 }),
    );

    expectRejection(
      buildExport({ workoutPlanner: { plannedWorkouts } }),
      'too-many-records',
    );
  });
});

describe('parseDataExport referential integrity', () => {
  it('rejects a planned exercise whose definition is missing', () => {
    expectRejection(
      buildExport({ exerciseCatalog: { exercises: [] } }),
      'unresolved-reference',
    );
  });

  it('allows a completed workout to reference a deleted definition', () => {
    const { data } = parse(
      buildExport({
        exerciseCatalog: { exercises: [] },
        workoutPlanner: { plannedWorkouts: [] },
      }),
    );

    expect(
      data.completedSessions[0]?.exercises[0]?.sourceExerciseDefinitionId.value,
    ).toBe(ids.squat);
    expect(data.exercises).toHaveLength(0);
  });

  it('rejects a repeated weekday in the planner', () => {
    expectRejection(
      buildExport({
        workoutPlanner: {
          plannedWorkouts: [
            buildPlannedWorkout(),
            buildPlannedWorkout({ id: ids.session }),
          ],
        },
      }),
      'duplicate-identifier',
    );
  });

  it('rejects duplicate exercise positions in a session', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              exercises: [
                buildSessionExercise(),
                buildSessionExercise({
                  id: ids.activeSessionExercise,
                  sets: [
                    {
                      id: ids.activeSessionSet,
                      position: 0,
                      result: buildResult(),
                    },
                  ],
                }),
              ],
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects duplicate set positions', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              exercises: [
                buildSessionExercise({
                  sets: [
                    { id: ids.sessionSet, position: 0, result: buildResult() },
                    {
                      id: ids.activeSessionSet,
                      position: 0,
                      result: buildResult(),
                    },
                  ],
                }),
              ],
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects a result the logging mode cannot produce', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              exercises: [
                buildSessionExercise({
                  sets: [
                    {
                      id: ids.sessionSet,
                      position: 0,
                      result: { kind: 'duration', durationSeconds: 60 },
                    },
                  ],
                }),
              ],
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects a planned prescription the logging mode cannot produce', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              exercises: [
                buildSessionExercise({
                  plannedPrescriptionSnapshot: {
                    durationSeconds: 60,
                    kind: 'duration',
                    sets: 3,
                  },
                }),
              ],
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects an active session listed among completed workouts', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              completedAtEpochMilliseconds: null,
              status: 'active',
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('rejects a completion instant before the start', () => {
    expectRejection(
      buildExport({
        workoutSessions: {
          activeSession: null,
          completedSessions: [
            buildCompletedSession({
              completedAtEpochMilliseconds: occurredAt - 1,
            }),
          ],
        },
      }),
      'invalid-record',
    );
  });

  it('keeps the active session out of completed history', () => {
    const { data, preview } = parse(
      buildExport({
        workoutSessions: {
          activeSession: buildActiveSession(),
          completedSessions: [buildCompletedSession()],
        },
      }),
    );

    expect(preview.hasActiveWorkout).toBe(true);
    expect(preview.completedWorkouts).toBe(1);
    expect(data.activeSession?.status).toBe('active');
    expect(data.activeSession?.completedAtEpochMilliseconds).toBeNull();
  });
});
