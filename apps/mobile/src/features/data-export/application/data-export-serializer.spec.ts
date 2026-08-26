import {
  BodyWeightEntry,
  ConsumptionEntry,
  DomainId,
  Energy,
  ExerciseDefinition,
  GoalConfiguration,
  HydrationEntry,
  HydrationTarget,
  Mass,
  NutritionFacts,
  PlannedExercise,
  PlannedWorkout,
  UserProfile,
  Volume,
  Weekday,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  createPlannedPrescription,
  createWorkoutResult,
} from '@fitness/domain';
import { migrations } from '../../../infrastructure/persistence/migrations';
import { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import { NutritionCatalogItem } from '../../nutrition-logging/application/nutrition-catalog-item';
import {
  dataExportFormat,
  dataExportFormatVersion,
} from './data-export-contract';
import { DataExportSerializer } from './data-export-serializer';

const metadata = {
  applicationName: 'Fitness App',
  applicationVersion: '0.0.0',
  generatedAt: new Date('2026-08-11T09:15:04.123Z'),
};

function id(prefix: string): DomainId {
  const result = DomainId.create(
    `${prefix}23e4567-e89b-42d3-a456-426614174000`,
  );
  if (!result.isSuccess) throw new Error('invalid test identifier');
  return result.value;
}

function required<TValue>(
  result:
    | Readonly<{ isSuccess: true; value: TValue }>
    | Readonly<{
        isSuccess: false;
      }>,
): TValue {
  if (!result.isSuccess) throw new Error('invalid test fixture');
  return result.value;
}

const occurredAt = Date.UTC(2026, 7, 4, 4);

function profile(): UserProfile {
  return required(
    UserProfile.create(
      {
        activityLevel: 'moderately-active',
        biologicalSex: 'male',
        dateOfBirth: '1996-04-02',
        heightMillimeters: 1_780,
        preferredUnitSystem: 'metric',
        weightGrams: 82_400,
      },
      '2026-08-11',
    ),
  );
}

function facts(): NutritionFacts {
  return required(
    NutritionFacts.create({
      description: 'E2E oats',
      energy: required(Energy.create(1_570, 'kilojoule')),
      nutrients: {
        carbohydrateGrams: 60.1,
        fatGrams: 0,
        fiberGrams: null,
        proteinGrams: 13.2,
        sodiumMilligrams: null,
        sugarGrams: null,
      },
      provenance: 'provided',
      reference: { amount: required(Mass.create(100, 'gram')), kind: 'mass' },
    }),
  );
}

function nutritionEntry(): ConsumptionEntry {
  return required(
    ConsumptionEntry.create({
      consumedQuantity: {
        amount: required(Mass.create(60, 'gram')),
        kind: 'mass',
      },
      facts: facts(),
      id: id('1'),
      kind: 'food',
      localCalendarDate: '2026-08-04',
      occurredAtEpochMilliseconds: occurredAt,
      utcOffsetMinutes: 480,
    }),
  );
}

function catalogItem(): NutritionCatalogItem {
  return required(
    NutritionCatalogItem.create({
      facts: facts(),
      id: id('2'),
      isFavorite: true,
      kind: 'food',
      lastUsedAtEpochMilliseconds: occurredAt,
      useCount: 3,
    }),
  );
}

function hydrationEntry(): HydrationEntry {
  return required(
    HydrationEntry.create({
      description: null,
      fluidType: 'plain-water',
      id: id('3'),
      localCalendarDate: '2026-08-04',
      occurredAtEpochMilliseconds: occurredAt,
      utcOffsetMinutes: 480,
      volume: required(Volume.create(500, 'milliliter')),
    }),
  );
}

function definition(): ExerciseDefinition {
  return required(
    ExerciseDefinition.create({
      equipment: 'barbell',
      id: id('4'),
      loggingMode: 'external-load-and-repetitions',
      name: 'E2E Back Squat',
      notes: null,
      primaryMuscleGroup: 'quadriceps',
    }),
  );
}

function exerciseItem(): ExerciseCatalogItem {
  return required(
    ExerciseCatalogItem.create({ definition: definition(), isFavorite: true }),
  );
}

function plannedWorkout(): PlannedWorkout {
  const prescription = required(
    createPlannedPrescription({
      loggingMode: 'external-load-and-repetitions',
      repetitions: 5,
      resistance: required(Mass.create(100_000, 'gram')),
      sets: 5,
    }),
  );
  const exercise = required(
    PlannedExercise.create({
      exerciseDefinitionId: id('4'),
      id: id('5'),
      position: 0,
      prescription,
    }),
  );
  return required(
    PlannedWorkout.create({
      exercises: [exercise],
      id: id('6'),
      name: 'E2E Lower Body',
      weekday: required(Weekday.create(1)),
    }),
  );
}

function session(status: 'active' | 'completed'): WorkoutSession {
  const result = required(
    createWorkoutResult({
      loggingMode: 'external-load-and-repetitions',
      repetitions: 5,
      resistance: required(Mass.create(100_000, 'gram')),
    }),
  );
  const set = required(
    WorkoutSet.create({ id: id('7'), position: 0, repsInReserve: 3, result }),
  );
  const exercise = required(
    WorkoutSessionExercise.create({
      exerciseNameSnapshot: 'E2E Back Squat',
      id: id('8'),
      loggingModeSnapshot: 'external-load-and-repetitions',
      plannedPrescriptionSnapshot: null,
      position: 0,
      sets: [set],
      sourceExerciseDefinitionId: id('4'),
      sourcePlannedExerciseId: null,
    }),
  );
  return required(
    WorkoutSession.create({
      completedAtEpochMilliseconds:
        status === 'completed' ? occurredAt + 3_600_000 : null,
      exercises: [exercise],
      id: id(status === 'completed' ? '9' : 'a'),
      name: 'E2E Lower Body',
      sourcePlannedWorkoutId: null,
      sourceWeekday: null,
      startedAtEpochMilliseconds: occurredAt,
      startedLocalCalendarDate: '2026-08-04',
      startedUtcOffsetMinutes: 480,
      status,
    }),
  );
}

function checkIn(): BodyWeightEntry {
  return required(
    BodyWeightEntry.create({
      id: id('b'),
      localCalendarDate: '2026-08-04',
      mass: required(Mass.create(82_400, 'gram')),
      note: null,
      occurredAtEpochMilliseconds: occurredAt,
      utcOffsetMinutes: 480,
    }),
  );
}

function serializeEmpty() {
  const serializer = new DataExportSerializer();
  serializer.begin(metadata);
  serializer.writeProfileSection(null);
  serializer.writeGoalsSection(null);
  serializer.openNutritionSection();
  serializer.openNutritionCatalog();
  serializer.closeNutritionSection();
  serializer.openHydrationSection();
  serializer.closeHydrationSection(null);
  serializer.openExerciseCatalogSection();
  serializer.closeExerciseCatalogSection();
  serializer.openWorkoutPlannerSection();
  serializer.closeWorkoutPlannerSection();
  serializer.openWorkoutSessionsSection(null);
  serializer.closeWorkoutSessionsSection();
  serializer.openBodyMeasurementsSection();
  serializer.closeBodyMeasurementsSection();
  return serializer.finish();
}

function serializeComplete() {
  const serializer = new DataExportSerializer();
  serializer.begin(metadata);
  serializer.writeProfileSection(profile());
  serializer.writeGoalsSection(
    required(GoalConfiguration.create('lose-weight', 300)),
  );
  serializer.openNutritionSection();
  serializer.writeNutritionEntry(nutritionEntry());
  serializer.openNutritionCatalog();
  serializer.writeNutritionCatalogItem(catalogItem());
  serializer.closeNutritionSection();
  serializer.openHydrationSection();
  serializer.writeHydrationEntry(hydrationEntry());
  serializer.closeHydrationSection(
    required(
      HydrationTarget.create(required(Volume.create(2_500, 'milliliter'))),
    ),
  );
  serializer.openExerciseCatalogSection();
  serializer.writeExercise(exerciseItem());
  serializer.closeExerciseCatalogSection();
  serializer.openWorkoutPlannerSection();
  serializer.writePlannedWorkout(plannedWorkout());
  serializer.closeWorkoutPlannerSection();
  serializer.openWorkoutSessionsSection(session('active'));
  serializer.writeCompletedSession(session('completed'));
  serializer.closeWorkoutSessionsSection();
  serializer.openBodyMeasurementsSection();
  serializer.writeBodyWeightCheckIn(checkIn());
  serializer.closeBodyMeasurementsSection();
  return serializer.finish();
}

describe('DataExportSerializer', () => {
  it('identifies the format and version independently of the schema version', () => {
    const document = JSON.parse(serializeEmpty().text) as Record<
      string,
      unknown
    >;

    expect(document.format).toBe(dataExportFormat);
    expect(document.formatVersion).toBe(2);
    expect(dataExportFormatVersion).not.toBe(migrations.length);
  });

  it('writes every section for an empty repository', () => {
    expect(serializeEmpty().text).toBe(
      `{
  "format": "fitness-app-data-export",
  "formatVersion": 2,
  "generatedAt": "2026-08-11T09:15:04.123Z",
  "application": {
    "name": "Fitness App",
    "version": "0.0.0"
  },
  "profile": null,
  "goalsAndEnergy": {
    "goal": null
  },
  "nutrition": {
    "entries": [],
    "catalogItems": []
  },
  "hydration": {
    "entries": [],
    "currentTarget": null
  },
  "exerciseCatalog": {
    "exercises": []
  },
  "workoutPlanner": {
    "plannedWorkouts": []
  },
  "workoutSessions": {
    "activeSession": null,
    "completedSessions": []
  },
  "bodyMeasurements": {
    "weightCheckIns": []
  }
}
`,
    );
  });

  it('counts nothing for an empty repository', () => {
    expect(serializeEmpty().counts).toEqual({
      bodyWeightCheckIns: 0,
      completedWorkouts: 0,
      exercises: 0,
      hydrationEntries: 0,
      nutritionCatalogItems: 0,
      nutritionEntries: 0,
      plannedWorkouts: 0,
    });
  });

  it('emits the declared top-level section order', () => {
    const document = JSON.parse(serializeComplete().text) as Record<
      string,
      unknown
    >;

    expect(Object.keys(document)).toEqual([
      'format',
      'formatVersion',
      'generatedAt',
      'application',
      'profile',
      'goalsAndEnergy',
      'nutrition',
      'hydration',
      'exerciseCatalog',
      'workoutPlanner',
      'workoutSessions',
      'bodyMeasurements',
    ]);
  });

  it('exports canonical units for every measurement', () => {
    const document = JSON.parse(serializeComplete().text) as never;
    const at = (path: string) => valueAt(document, path);

    expect(at('profile.heightMillimeters')).toBe(1_780);
    expect(at('profile.weightGrams')).toBe(82_400);
    expect(at('nutrition.entries.0.referenceNutrition.energyKilojoules')).toBe(
      1_570,
    );
    expect(at('nutrition.entries.0.reference.amountGrams')).toBe(100);
    expect(at('nutrition.entries.0.consumedQuantity.amountGrams')).toBe(60);
    expect(at('hydration.entries.0.volumeMilliliters')).toBe(500);
    expect(at('hydration.currentTarget.targetMilliliters')).toBe(2_500);
    expect(
      at(
        'workoutPlanner.plannedWorkouts.0.exercises.0.prescription.resistanceGrams',
      ),
    ).toBe(100_000);
    expect(
      at(
        'workoutSessions.completedSessions.0.exercises.0.sets.0.result.resistanceGrams',
      ),
    ).toBe(100_000);
    expect(
      at(
        'workoutSessions.completedSessions.0.exercises.0.sets.0.repsInReserve',
      ),
    ).toBe(3);
    expect(at('bodyMeasurements.weightCheckIns.0.massGrams')).toBe(82_400);
  });

  it('keeps unknown nutrients unknown and known zero known', () => {
    const document = JSON.parse(serializeComplete().text) as never;

    expect(
      valueAt(document, 'nutrition.entries.0.referenceNutrition.fiberGrams'),
    ).toBeNull();
    expect(
      valueAt(
        document,
        'nutrition.entries.0.referenceNutrition.sodiumMilligrams',
      ),
    ).toBeNull();
    expect(
      valueAt(document, 'nutrition.entries.0.referenceNutrition.fatGrams'),
    ).toBe(0);
  });

  it('preserves the captured occurrence semantics of every historical record', () => {
    const document = JSON.parse(serializeComplete().text) as never;

    for (const path of [
      'nutrition.entries.0',
      'hydration.entries.0',
      'bodyMeasurements.weightCheckIns.0',
    ]) {
      expect(valueAt(document, `${path}.occurredAtEpochMilliseconds`)).toBe(
        occurredAt,
      );
      expect(valueAt(document, `${path}.localCalendarDate`)).toBe('2026-08-04');
      expect(valueAt(document, `${path}.utcOffsetMinutes`)).toBe(480);
    }
    expect(
      valueAt(
        document,
        'workoutSessions.completedSessions.0.startedLocalCalendarDate',
      ),
    ).toBe('2026-08-04');
    expect(
      valueAt(
        document,
        'workoutSessions.completedSessions.0.startedUtcOffsetMinutes',
      ),
    ).toBe(480);
  });

  it('separates the active session from completed history', () => {
    const document = JSON.parse(serializeComplete().text) as never;

    expect(valueAt(document, 'workoutSessions.activeSession.status')).toBe(
      'active',
    );
    expect(
      valueAt(
        document,
        'workoutSessions.activeSession.completedAtEpochMilliseconds',
      ),
    ).toBeNull();
    expect(
      valueAt(document, 'workoutSessions.completedSessions.0.status'),
    ).toBe('completed');
    expect(serializeComplete().counts.completedWorkouts).toBe(1);
  });

  it('keeps planner intent and profile weight out of recorded history', () => {
    const document = JSON.parse(serializeComplete().text) as never;

    expect(valueAt(document, 'workoutPlanner.plannedWorkouts.0.weekday')).toBe(
      1,
    );
    expect(
      valueAt(
        document,
        'workoutSessions.completedSessions.0.exercises.0.plannedPrescriptionSnapshot',
      ),
    ).toBeNull();
    expect(
      valueAt(document, 'bodyMeasurements.weightCheckIns.0.massGrams'),
    ).toBe(82_400);
    expect(
      valueAt(document, 'bodyMeasurements.weightCheckIns.0.note'),
    ).toBeNull();
  });

  it('exports no derived or presentation value', () => {
    const text = serializeComplete().text;

    for (const forbidden of [
      'bmi',
      'restingEnergy',
      'maintenanceEnergy',
      'dailyCalorieTarget',
      'consumedNutrition',
      'elapsedSeconds',
      'performedExerciseCount',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('exports no internal database or search identifier', () => {
    const text = serializeComplete().text;

    for (const forbidden of [
      'normalized_name',
      'normalizedName',
      'display_name',
      'singleton_id',
      'nutrition_consumption_entry',
      'workout_session',
      'body_weight_entry',
      'entry_kind',
      'is_favorite',
      'epoch_ms',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('counts every exported record group', () => {
    expect(serializeComplete().counts).toEqual({
      bodyWeightCheckIns: 1,
      completedWorkouts: 1,
      exercises: 1,
      hydrationEntries: 1,
      nutritionCatalogItems: 1,
      nutritionEntries: 1,
      plannedWorkouts: 1,
    });
  });

  it('produces byte-identical output for identical state and metadata', () => {
    expect(serializeComplete().text).toBe(serializeComplete().text);
  });
});

function valueAt(document: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)[key]
          : undefined,
      document,
    );
}
