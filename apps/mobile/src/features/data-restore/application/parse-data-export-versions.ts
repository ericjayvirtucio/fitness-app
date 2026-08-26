import {
  BodyWeightEntry,
  ConsumptionEntry,
  Duration,
  Energy,
  ExerciseDefinition,
  GoalConfiguration,
  HydrationEntry,
  HydrationTarget,
  Length,
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
  activityLevels,
  biologicalSexes,
  consumptionEntryKinds,
  createPlannedPrescription,
  createWorkoutResult,
  exerciseEquipment,
  exerciseLoggingModes,
  exerciseMuscleGroups,
  goalTypes,
  hydrationFluidTypes,
  nutritionProvenances,
  unitSystems,
  weekdayValues,
  type ConsumptionEntryKind,
  type ExerciseLoggingMode,
  type NutritionReference,
  type PlannedPrescription,
  type PlannedPrescriptionInput,
  type WorkoutResult,
  type WorkoutSessionStatus,
} from '@fitness/domain';
import { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import { NutritionCatalogItem } from '../../nutrition-logging/application/nutrition-catalog-item';
import {
  asArray,
  asBoolean,
  asEnum,
  asFiniteNumber,
  asId,
  asInteger,
  asNullable,
  asObject,
  asString,
  claimId,
  fail,
  member,
  objectMember,
  required,
  type JsonObject,
} from './data-restore-parsing';
import { dataRestorePolicy } from './data-restore-policy';
import {
  toDataRestorePreview,
  type ParsedDataExport,
  type RestoreData,
} from './restore-data';

/**
 * The version 1 and version 2 parsers.
 *
 * They read the public export contract section by section and produce domain
 * records. Nothing is copied straight through: canonical amounts become
 * measurements, occurrence triples are checked against each other by the domain
 * constructors that already own that rule, and an unknown optional nutrient
 * stays `null` instead of quietly becoming zero.
 *
 * Section order matters in one place only: the exercise catalog is read before
 * the planner, because a planned exercise must resolve to a restored definition
 * and takes its prescription shape from that definition's logging mode.
 *
 * Version 2 differs from version 1 in exactly one place: a recorded set may
 * carry `repsInReserve`. Every other section is identical, so both versions
 * share this module's section readers and differ only in the
 * `readRepsInReserve` function each entry point supplies to `readSet`. This is
 * a parameter for one field, not a migration framework — see
 * `parse-data-export.ts` for the version dispatch that selects between them.
 */

const prescriptionKinds = Object.freeze([
  'repetitions',
  'resistance-and-repetitions',
  'duration',
  'distance',
  'distance-and-duration',
] as const);

const quantityKinds = Object.freeze(['mass', 'volume'] as const);

const sessionStatuses = Object.freeze(['active', 'completed'] as const);

/** Version 1 files never recorded reps in reserve. */
export function parseDataExportV1(
  document: JsonObject,
  currentLocalCalendarDate: string,
): ParsedDataExport {
  return parseWorkoutCompatibleDocument(
    document,
    currentLocalCalendarDate,
    () => null,
  );
}

/** Version 2 adds `repsInReserve` to a recorded set, still optional. */
export function parseDataExportV2(
  document: JsonObject,
  currentLocalCalendarDate: string,
): ParsedDataExport {
  return parseWorkoutCompatibleDocument(
    document,
    currentLocalCalendarDate,
    readRepsInReserve,
  );
}

function parseWorkoutCompatibleDocument(
  document: JsonObject,
  currentLocalCalendarDate: string,
  readSetRepsInReserve: (source: JsonObject) => number | null,
): ParsedDataExport {
  const generatedAt = readGeneratedAt(member(document, 'generatedAt'));
  readApplicationMetadata(objectMember(document, 'application'));

  const exercises = readExerciseCatalogSection(
    objectMember(document, 'exerciseCatalog'),
  );
  const nutrition = readNutritionSection(objectMember(document, 'nutrition'));
  const hydration = readHydrationSection(objectMember(document, 'hydration'));
  const sessions = readWorkoutSessionsSection(
    objectMember(document, 'workoutSessions'),
    readSetRepsInReserve,
  );

  const data: RestoreData = Object.freeze({
    activeSession: sessions.activeSession,
    bodyWeightCheckIns: readBodyMeasurementsSection(
      objectMember(document, 'bodyMeasurements'),
    ),
    completedSessions: sessions.completedSessions,
    exercises,
    goal: readGoalSection(objectMember(document, 'goalsAndEnergy')),
    hydrationEntries: hydration.entries,
    hydrationTarget: hydration.currentTarget,
    nutritionCatalogItems: nutrition.catalogItems,
    nutritionEntries: nutrition.entries,
    plannedWorkouts: readWorkoutPlannerSection(
      objectMember(document, 'workoutPlanner'),
      exercises,
    ),
    profile: asNullable(member(document, 'profile'), (value) =>
      readProfile(asObject(value), currentLocalCalendarDate),
    ),
  });

  return Object.freeze({
    data,
    preview: toDataRestorePreview(data, generatedAt),
  });
}

/** File metadata. It is checked for shape and never becomes record history. */
function readGeneratedAt(value: unknown): string {
  const generatedAt = asString(value);
  if (!Number.isFinite(Date.parse(generatedAt))) fail('invalid-structure');
  return generatedAt;
}

/** Present in every export and deliberately unused: it carries no meaning. */
function readApplicationMetadata(source: JsonObject): void {
  asString(member(source, 'name'));
  asNullable(member(source, 'version'), asString);
}

function readProfile(
  source: JsonObject,
  currentLocalCalendarDate: string,
): UserProfile {
  return required(
    UserProfile.create(
      {
        activityLevel: asEnum(member(source, 'activityLevel'), activityLevels),
        biologicalSex: asEnum(member(source, 'biologicalSex'), biologicalSexes),
        dateOfBirth: asString(member(source, 'dateOfBirth')),
        heightMillimeters: asFiniteNumber(member(source, 'heightMillimeters')),
        preferredUnitSystem: asEnum(
          member(source, 'preferredUnitSystem'),
          unitSystems,
        ),
        weightGrams: asFiniteNumber(member(source, 'weightGrams')),
      },
      currentLocalCalendarDate,
    ),
  );
}

function readGoalSection(source: JsonObject): GoalConfiguration | null {
  return asNullable(member(source, 'goal'), (value) => {
    const goal = asObject(value);
    return required(
      GoalConfiguration.create(
        asEnum(member(goal, 'goalType'), goalTypes),
        asInteger(member(goal, 'adjustmentKilocalories')),
      ),
    );
  });
}

function readNutritionSection(source: JsonObject): Readonly<{
  catalogItems: readonly NutritionCatalogItem[];
  entries: readonly ConsumptionEntry[];
}> {
  const entryIds = new Set<string>();
  const itemIds = new Set<string>();
  return Object.freeze({
    catalogItems: Object.freeze(
      asArray(
        member(source, 'catalogItems'),
        dataRestorePolicy.maximumNutritionCatalogItems,
      ).map((value) => readNutritionCatalogItem(value, itemIds)),
    ),
    entries: Object.freeze(
      asArray(
        member(source, 'entries'),
        dataRestorePolicy.maximumNutritionEntries,
      ).map((value) => readNutritionEntry(value, entryIds)),
    ),
  });
}

function readNutritionEntry(
  value: unknown,
  seen: Set<string>,
): ConsumptionEntry {
  const source = asObject(value);
  return required(
    ConsumptionEntry.create({
      consumedQuantity: readQuantity(member(source, 'consumedQuantity')),
      facts: readNutritionFacts(source),
      id: claimId(seen, asId(member(source, 'id'))),
      kind: readConsumptionKind(source),
      localCalendarDate: asString(member(source, 'localCalendarDate')),
      occurredAtEpochMilliseconds: asInteger(
        member(source, 'occurredAtEpochMilliseconds'),
      ),
      utcOffsetMinutes: asInteger(member(source, 'utcOffsetMinutes')),
    }),
  );
}

function readNutritionCatalogItem(
  value: unknown,
  seen: Set<string>,
): NutritionCatalogItem {
  const source = asObject(value);
  return required(
    NutritionCatalogItem.create({
      facts: readNutritionFacts(source),
      id: claimId(seen, asId(member(source, 'id'))),
      isFavorite: asBoolean(member(source, 'isFavorite')),
      kind: readConsumptionKind(source),
      lastUsedAtEpochMilliseconds: asNullable(
        member(source, 'lastUsedAtEpochMilliseconds'),
        asInteger,
      ),
      useCount: asInteger(member(source, 'useCount')),
    }),
  );
}

function readConsumptionKind(source: JsonObject): ConsumptionEntryKind {
  return asEnum(member(source, 'kind'), consumptionEntryKinds);
}

/**
 * An absent optional nutrient stays absent. Converting `null` to `0` would turn
 * "never recorded" into "recorded as none", which is a different claim.
 */
function readNutritionFacts(source: JsonObject): NutritionFacts {
  const nutrition = objectMember(source, 'referenceNutrition');
  return required(
    NutritionFacts.create({
      description: asString(member(source, 'description')),
      energy: required(
        Energy.create(
          asFiniteNumber(member(nutrition, 'energyKilojoules')),
          'kilojoule',
        ),
      ),
      nutrients: {
        carbohydrateGrams: readOptionalAmount(nutrition, 'carbohydrateGrams'),
        fatGrams: readOptionalAmount(nutrition, 'fatGrams'),
        fiberGrams: readOptionalAmount(nutrition, 'fiberGrams'),
        proteinGrams: readOptionalAmount(nutrition, 'proteinGrams'),
        sodiumMilligrams: readOptionalAmount(nutrition, 'sodiumMilligrams'),
        sugarGrams: readOptionalAmount(nutrition, 'sugarGrams'),
      },
      provenance: asEnum(member(source, 'provenance'), nutritionProvenances),
      reference: readQuantity(member(source, 'reference')),
    }),
  );
}

function readOptionalAmount(source: JsonObject, key: string): number | null {
  return asNullable(member(source, key), asFiniteNumber);
}

function readQuantity(value: unknown): NutritionReference {
  const source = asObject(value);
  const kind = asEnum(member(source, 'kind'), quantityKinds);
  if (kind === 'mass') {
    return Object.freeze({
      amount: readMass(member(source, 'amountGrams')),
      kind,
    });
  }
  return Object.freeze({
    amount: readVolume(member(source, 'amountMilliliters')),
    kind,
  });
}

function readHydrationSection(source: JsonObject): Readonly<{
  currentTarget: HydrationTarget | null;
  entries: readonly HydrationEntry[];
}> {
  const entryIds = new Set<string>();
  return Object.freeze({
    // Restored as current configuration. No past day gains a target it never
    // had, so nothing here is attached to an entry.
    currentTarget: asNullable(member(source, 'currentTarget'), (value) =>
      required(
        HydrationTarget.create(
          readVolume(member(asObject(value), 'targetMilliliters')),
        ),
      ),
    ),
    entries: Object.freeze(
      asArray(
        member(source, 'entries'),
        dataRestorePolicy.maximumHydrationEntries,
      ).map((value) => readHydrationEntry(value, entryIds)),
    ),
  });
}

function readHydrationEntry(value: unknown, seen: Set<string>): HydrationEntry {
  const source = asObject(value);
  return required(
    HydrationEntry.create({
      description: asNullable(member(source, 'description'), asString),
      fluidType: asEnum(member(source, 'fluidType'), hydrationFluidTypes),
      id: claimId(seen, asId(member(source, 'id'))),
      localCalendarDate: asString(member(source, 'localCalendarDate')),
      occurredAtEpochMilliseconds: asInteger(
        member(source, 'occurredAtEpochMilliseconds'),
      ),
      utcOffsetMinutes: asInteger(member(source, 'utcOffsetMinutes')),
      volume: readVolume(member(source, 'volumeMilliliters')),
    }),
  );
}

function readExerciseCatalogSection(
  source: JsonObject,
): readonly ExerciseCatalogItem[] {
  const seen = new Set<string>();
  return Object.freeze(
    asArray(
      member(source, 'exercises'),
      dataRestorePolicy.maximumExercises,
    ).map((value) => readExercise(value, seen)),
  );
}

function readExercise(value: unknown, seen: Set<string>): ExerciseCatalogItem {
  const source = asObject(value);
  return required(
    ExerciseCatalogItem.create({
      definition: required(
        ExerciseDefinition.create({
          equipment: asEnum(member(source, 'equipment'), exerciseEquipment),
          id: claimId(seen, asId(member(source, 'id'))),
          loggingMode: asEnum(
            member(source, 'loggingMode'),
            exerciseLoggingModes,
          ),
          name: asString(member(source, 'name')),
          notes: asNullable(member(source, 'notes'), asString),
          primaryMuscleGroup: asEnum(
            member(source, 'primaryMuscleGroup'),
            exerciseMuscleGroups,
          ),
        }),
      ),
      isFavorite: asBoolean(member(source, 'isFavorite')),
    }),
  );
}

/**
 * The planner describes current intent, so its references must resolve. A
 * planned exercise pointing at a definition the file does not contain is
 * rejected rather than dropped: silently restoring six of seven planned
 * exercises would be a merge decision nobody approved.
 */
function readWorkoutPlannerSection(
  source: JsonObject,
  exercises: readonly ExerciseCatalogItem[],
): readonly PlannedWorkout[] {
  const loggingModes = new Map(
    exercises.map((item) => [
      item.definition.id.value,
      item.definition.loggingMode,
    ]),
  );
  const workoutIds = new Set<string>();
  const plannedExerciseIds = new Set<string>();
  const weekdays = new Set<number>();

  return Object.freeze(
    asArray(
      member(source, 'plannedWorkouts'),
      dataRestorePolicy.maximumPlannedWorkouts,
    ).map((value) => {
      const workout = asObject(value);
      const weekday = required(
        Weekday.create(asEnum(member(workout, 'weekday'), weekdayValues)),
      );
      if (weekdays.has(weekday.value)) fail('duplicate-identifier');
      weekdays.add(weekday.value);
      return required(
        PlannedWorkout.create({
          exercises: asArray(
            member(workout, 'exercises'),
            dataRestorePolicy.maximumExercisesPerPlannedWorkout,
          )
            .map((exercise) =>
              readPlannedExercise(exercise, loggingModes, plannedExerciseIds),
            )
            .sort(byPosition),
          id: claimId(workoutIds, asId(member(workout, 'id'))),
          name: asString(member(workout, 'name')),
          weekday,
        }),
      );
    }),
  );
}

function readPlannedExercise(
  value: unknown,
  loggingModes: ReadonlyMap<string, ExerciseLoggingMode>,
  seen: Set<string>,
): PlannedExercise {
  const source = asObject(value);
  const exerciseDefinitionId = asId(member(source, 'exerciseId'));
  const loggingMode = loggingModes.get(exerciseDefinitionId.value);
  if (loggingMode === undefined) fail('unresolved-reference');
  return required(
    PlannedExercise.create({
      exerciseDefinitionId,
      id: claimId(seen, asId(member(source, 'id'))),
      position: asInteger(member(source, 'position')),
      prescription: readPrescription(
        member(source, 'prescription'),
        loggingMode,
      ),
    }),
  );
}

function readWorkoutSessionsSection(
  source: JsonObject,
  readSetRepsInReserve: (source: JsonObject) => number | null,
): Readonly<{
  activeSession: WorkoutSession | null;
  completedSessions: readonly WorkoutSession[];
}> {
  const sessionIds = new Set<string>();
  const exerciseIds = new Set<string>();
  const setIds = new Set<string>();
  const scope = Object.freeze({ exerciseIds, sessionIds, setIds });

  return Object.freeze({
    // The contract holds a single slot, so more than one active session cannot
    // be expressed. A session claiming to be active anywhere else is rejected.
    activeSession: asNullable(member(source, 'activeSession'), (value) =>
      readSession(value, 'active', scope, readSetRepsInReserve),
    ),
    completedSessions: Object.freeze(
      asArray(
        member(source, 'completedSessions'),
        dataRestorePolicy.maximumCompletedSessions,
      ).map((value) =>
        readSession(value, 'completed', scope, readSetRepsInReserve),
      ),
    ),
  });
}

type SessionIdentityScope = Readonly<{
  exerciseIds: Set<string>;
  sessionIds: Set<string>;
  setIds: Set<string>;
}>;

function readSession(
  value: unknown,
  expectedStatus: WorkoutSessionStatus,
  scope: SessionIdentityScope,
  readSetRepsInReserve: (source: JsonObject) => number | null,
): WorkoutSession {
  const source = asObject(value);
  const status = asEnum(member(source, 'status'), sessionStatuses);
  if (status !== expectedStatus) fail('invalid-record');
  return required(
    WorkoutSession.create({
      completedAtEpochMilliseconds: asNullable(
        member(source, 'completedAtEpochMilliseconds'),
        asInteger,
      ),
      exercises: asArray(
        member(source, 'exercises'),
        dataRestorePolicy.maximumExercisesPerSession,
      )
        .map((exercise) =>
          readSessionExercise(exercise, scope, readSetRepsInReserve),
        )
        .sort(byPosition),
      id: claimId(scope.sessionIds, asId(member(source, 'id'))),
      name: asString(member(source, 'name')),
      // Historical provenance. It may point at a plan that no longer exists,
      // so it is never required to resolve.
      sourcePlannedWorkoutId: asNullable(
        member(source, 'sourcePlannedWorkoutId'),
        asId,
      ),
      sourceWeekday: asNullable(member(source, 'sourceWeekday'), (weekday) =>
        required(Weekday.create(asEnum(weekday, weekdayValues))),
      ),
      startedAtEpochMilliseconds: asInteger(
        member(source, 'startedAtEpochMilliseconds'),
      ),
      startedLocalCalendarDate: asString(
        member(source, 'startedLocalCalendarDate'),
      ),
      startedUtcOffsetMinutes: asInteger(
        member(source, 'startedUtcOffsetMinutes'),
      ),
      status,
    }),
  );
}

function readSessionExercise(
  value: unknown,
  scope: SessionIdentityScope,
  readSetRepsInReserve: (source: JsonObject) => number | null,
): WorkoutSessionExercise {
  const source = asObject(value);
  const loggingModeSnapshot = asEnum(
    member(source, 'loggingModeSnapshot'),
    exerciseLoggingModes,
  );
  return required(
    WorkoutSessionExercise.create({
      exerciseNameSnapshot: asString(member(source, 'nameSnapshot')),
      id: claimId(scope.exerciseIds, asId(member(source, 'id'))),
      loggingModeSnapshot,
      // Both snapshots are read against the recorded logging mode, so a file
      // cannot describe a target or a result the exercise could not produce.
      plannedPrescriptionSnapshot: asNullable(
        member(source, 'plannedPrescriptionSnapshot'),
        (snapshot) => readPrescription(snapshot, loggingModeSnapshot),
      ),
      position: asInteger(member(source, 'position')),
      sets: asArray(
        member(source, 'sets'),
        dataRestorePolicy.maximumSetsPerSessionExercise,
      )
        .map((set) =>
          readSet(set, loggingModeSnapshot, scope.setIds, readSetRepsInReserve),
        )
        .sort(byPosition),
      sourceExerciseDefinitionId: asId(member(source, 'sourceExerciseId')),
      sourcePlannedExerciseId: asNullable(
        member(source, 'sourcePlannedExerciseId'),
        asId,
      ),
    }),
  );
}

function readSet(
  value: unknown,
  loggingMode: ExerciseLoggingMode,
  seen: Set<string>,
  readSetRepsInReserve: (source: JsonObject) => number | null,
): WorkoutSet {
  const source = asObject(value);
  return required(
    WorkoutSet.create({
      id: claimId(seen, asId(member(source, 'id'))),
      position: asInteger(member(source, 'position')),
      repsInReserve: readSetRepsInReserve(source),
      result: readResult(member(source, 'result'), loggingMode),
    }),
  );
}

/**
 * Version 2's one addition: an optional integer, structurally checked here
 * and range/eligibility checked by the domain constructor that already owns
 * that rule.
 */
function readRepsInReserve(source: JsonObject): number | null {
  return asNullable(member(source, 'repsInReserve'), asInteger);
}

function readBodyMeasurementsSection(
  source: JsonObject,
): readonly BodyWeightEntry[] {
  const seen = new Set<string>();
  return Object.freeze(
    asArray(
      member(source, 'weightCheckIns'),
      dataRestorePolicy.maximumBodyWeightCheckIns,
    ).map((value) => {
      const entry = asObject(value);
      return required(
        BodyWeightEntry.create({
          id: claimId(seen, asId(member(entry, 'id'))),
          localCalendarDate: asString(member(entry, 'localCalendarDate')),
          mass: readMass(member(entry, 'massGrams')),
          note: asNullable(member(entry, 'note'), asString),
          occurredAtEpochMilliseconds: asInteger(
            member(entry, 'occurredAtEpochMilliseconds'),
          ),
          utcOffsetMinutes: asInteger(member(entry, 'utcOffsetMinutes')),
        }),
      );
    }),
  );
}

/**
 * The domain builds a prescription from a logging mode, not from a declared
 * kind, so comparing the two afterwards is what rejects a target the exercise
 * could never have been given.
 */
function readPrescription(
  value: unknown,
  loggingMode: ExerciseLoggingMode,
): PlannedPrescription {
  const source = asObject(value);
  const kind = asEnum(member(source, 'kind'), prescriptionKinds);
  const prescription = required(
    createPlannedPrescription(readPrescriptionInput(source, kind, loggingMode)),
  );
  if (prescription.kind !== kind) fail('invalid-record');
  return prescription;
}

function readPrescriptionInput(
  source: JsonObject,
  kind: (typeof prescriptionKinds)[number],
  loggingMode: ExerciseLoggingMode,
): PlannedPrescriptionInput {
  const sets = asInteger(member(source, 'sets'));
  switch (kind) {
    case 'repetitions':
      return {
        loggingMode,
        repetitions: asInteger(member(source, 'repetitions')),
        sets,
      };
    case 'resistance-and-repetitions':
      return {
        loggingMode,
        repetitions: asInteger(member(source, 'repetitions')),
        resistance: asNullable(member(source, 'resistanceGrams'), readMass),
        sets,
      };
    case 'duration':
      return {
        duration: readDuration(member(source, 'durationSeconds')),
        loggingMode,
        sets,
      };
    case 'distance':
      return {
        distance: readLength(member(source, 'distanceMillimeters')),
        loggingMode,
        sets,
      };
    case 'distance-and-duration':
      return {
        distance: readLength(member(source, 'distanceMillimeters')),
        duration: readDuration(member(source, 'durationSeconds')),
        loggingMode,
        sets,
      };
  }
}

function readResult(
  value: unknown,
  loggingMode: ExerciseLoggingMode,
): WorkoutResult {
  const source = asObject(value);
  const kind = asEnum(member(source, 'kind'), prescriptionKinds);
  const result = required(
    createWorkoutResult(readResultInput(source, kind, loggingMode)),
  );
  if (result.kind !== kind) fail('invalid-record');
  return result;
}

function readResultInput(
  source: JsonObject,
  kind: (typeof prescriptionKinds)[number],
  loggingMode: ExerciseLoggingMode,
): Parameters<typeof createWorkoutResult>[0] {
  switch (kind) {
    case 'repetitions':
      return {
        loggingMode,
        repetitions: asInteger(member(source, 'repetitions')),
      };
    case 'resistance-and-repetitions':
      return {
        loggingMode,
        repetitions: asInteger(member(source, 'repetitions')),
        resistance: readMass(member(source, 'resistanceGrams')),
      };
    case 'duration':
      return {
        duration: readDuration(member(source, 'durationSeconds')),
        loggingMode,
      };
    case 'distance':
      return {
        distance: readLength(member(source, 'distanceMillimeters')),
        loggingMode,
      };
    case 'distance-and-duration':
      return {
        distance: readLength(member(source, 'distanceMillimeters')),
        duration: readDuration(member(source, 'durationSeconds')),
        loggingMode,
      };
  }
}

function readMass(value: unknown): Mass {
  return required(Mass.create(asFiniteNumber(value), 'gram'));
}

function readVolume(value: unknown): Volume {
  return required(Volume.create(asFiniteNumber(value), 'milliliter'));
}

function readLength(value: unknown): Length {
  return required(Length.create(asFiniteNumber(value), 'millimeter'));
}

function readDuration(value: unknown): Duration {
  return required(Duration.create(asFiniteNumber(value), 'second'));
}

/**
 * Ordering is restored from `position`, never from array order, and the domain
 * then requires positions to run from zero without gaps.
 */
function byPosition(
  left: Readonly<{ position: number }>,
  right: Readonly<{ position: number }>,
): number {
  return left.position - right.position;
}
