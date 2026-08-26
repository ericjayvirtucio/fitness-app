import type {
  BodyWeightEntry,
  ConsumptionEntry,
  GoalConfiguration,
  HydrationEntry,
  HydrationTarget,
  NutritionFacts,
  NutritionReference,
  PlannedPrescription,
  PlannedWorkout,
  UserProfile,
  WorkoutResult,
  WorkoutSession,
} from '@fitness/domain';
import type { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import type { NutritionCatalogItem } from '../../nutrition-logging/application/nutrition-catalog-item';
import type {
  ExportedBodyWeightCheckIn,
  ExportedExercise,
  ExportedGoal,
  ExportedHydrationEntry,
  ExportedHydrationTarget,
  ExportedNutrition,
  ExportedNutritionCatalogItem,
  ExportedNutritionEntry,
  ExportedPlannedWorkout,
  ExportedPrescription,
  ExportedProfile,
  ExportedQuantity,
  ExportedResult,
  ExportedWorkoutSession,
} from './data-export-contract';

/**
 * The single place where stored records become the public export contract.
 *
 * Keeping every mapping here means a contract version change is one reviewable
 * file rather than a change spread across every capability, and it keeps the
 * public format decoupled from mutable domain classes. Values are copied as
 * stored: canonical units, captured occurrence semantics, and unknown optional
 * amounts left unknown.
 */

export function toExportedProfile(profile: UserProfile): ExportedProfile {
  return {
    activityLevel: profile.activityLevel,
    biologicalSex: profile.biologicalSex,
    dateOfBirth: profile.dateOfBirth,
    heightMillimeters: profile.height.millimeters,
    preferredUnitSystem: profile.preferredUnitSystem,
    weightGrams: profile.weight.grams,
  };
}

export function toExportedGoal(goal: GoalConfiguration): ExportedGoal {
  return {
    adjustmentKilocalories: goal.adjustmentKilocalories,
    goalType: goal.type,
  };
}

export function toExportedNutritionEntry(
  entry: ConsumptionEntry,
): ExportedNutritionEntry {
  return {
    consumedQuantity: toExportedQuantity(entry.consumedQuantity),
    description: entry.facts.description,
    id: entry.id.value,
    kind: entry.kind,
    localCalendarDate: entry.localCalendarDate,
    occurredAtEpochMilliseconds: entry.occurredAtEpochMilliseconds,
    provenance: entry.facts.provenance,
    reference: toExportedQuantity(entry.facts.reference),
    referenceNutrition: toExportedNutrition(entry.facts),
    utcOffsetMinutes: entry.utcOffsetMinutes,
  };
}

export function toExportedNutritionCatalogItem(
  item: NutritionCatalogItem,
): ExportedNutritionCatalogItem {
  return {
    description: item.facts.description,
    id: item.id.value,
    isFavorite: item.isFavorite,
    kind: item.kind,
    lastUsedAtEpochMilliseconds: item.usage.lastUsedAtEpochMilliseconds,
    provenance: item.facts.provenance,
    reference: toExportedQuantity(item.facts.reference),
    referenceNutrition: toExportedNutrition(item.facts),
    useCount: item.usage.useCount,
  };
}

export function toExportedHydrationEntry(
  entry: HydrationEntry,
): ExportedHydrationEntry {
  return {
    description: entry.description,
    fluidType: entry.fluidType,
    id: entry.id.value,
    localCalendarDate: entry.localCalendarDate,
    occurredAtEpochMilliseconds: entry.occurredAtEpochMilliseconds,
    utcOffsetMinutes: entry.utcOffsetMinutes,
    volumeMilliliters: entry.volume.milliliters,
  };
}

export function toExportedHydrationTarget(
  target: HydrationTarget,
): ExportedHydrationTarget {
  return { targetMilliliters: target.volume.milliliters };
}

export function toExportedExercise(
  item: ExerciseCatalogItem,
): ExportedExercise {
  const { definition } = item;
  return {
    equipment: definition.equipment,
    id: definition.id.value,
    isFavorite: item.isFavorite,
    loggingMode: definition.loggingMode,
    name: definition.name,
    notes: definition.notes,
    primaryMuscleGroup: definition.primaryMuscleGroup,
  };
}

export function toExportedPlannedWorkout(
  workout: PlannedWorkout,
): ExportedPlannedWorkout {
  return {
    exercises: workout.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseDefinitionId.value,
      id: exercise.id.value,
      position: exercise.position,
      prescription: toExportedPrescription(exercise.prescription),
    })),
    id: workout.id.value,
    name: workout.name,
    weekday: workout.weekday.value,
  };
}

export function toExportedWorkoutSession(
  session: WorkoutSession,
): ExportedWorkoutSession {
  return {
    completedAtEpochMilliseconds: session.completedAtEpochMilliseconds,
    exercises: session.exercises.map((exercise) => ({
      id: exercise.id.value,
      loggingModeSnapshot: exercise.loggingModeSnapshot,
      nameSnapshot: exercise.exerciseNameSnapshot,
      plannedPrescriptionSnapshot:
        exercise.plannedPrescriptionSnapshot === null
          ? null
          : toExportedPrescription(exercise.plannedPrescriptionSnapshot),
      position: exercise.position,
      sets: exercise.sets.map((set) => ({
        id: set.id.value,
        position: set.position,
        repsInReserve: set.repsInReserve,
        result: toExportedResult(set.result),
      })),
      sourceExerciseId: exercise.sourceExerciseDefinitionId.value,
      sourcePlannedExerciseId: exercise.sourcePlannedExerciseId?.value ?? null,
    })),
    id: session.id.value,
    name: session.name,
    sourcePlannedWorkoutId: session.sourcePlannedWorkoutId?.value ?? null,
    sourceWeekday: session.sourceWeekday?.value ?? null,
    startedAtEpochMilliseconds: session.startedAtEpochMilliseconds,
    startedLocalCalendarDate: session.startedLocalCalendarDate,
    startedUtcOffsetMinutes: session.startedUtcOffsetMinutes,
    status: session.status,
  };
}

export function toExportedBodyWeightCheckIn(
  entry: BodyWeightEntry,
): ExportedBodyWeightCheckIn {
  return {
    id: entry.id.value,
    localCalendarDate: entry.localCalendarDate,
    massGrams: entry.mass.grams,
    note: entry.note,
    occurredAtEpochMilliseconds: entry.occurredAtEpochMilliseconds,
    utcOffsetMinutes: entry.utcOffsetMinutes,
  };
}

function toExportedQuantity(reference: NutritionReference): ExportedQuantity {
  return reference.kind === 'mass'
    ? { amountGrams: reference.amount.grams, kind: 'mass' }
    : { amountMilliliters: reference.amount.milliliters, kind: 'volume' };
}

function toExportedNutrition(facts: NutritionFacts): ExportedNutrition {
  return {
    carbohydrateGrams: facts.nutrients.carbohydrateGrams,
    energyKilojoules: facts.energy.kilojoules,
    fatGrams: facts.nutrients.fatGrams,
    fiberGrams: facts.nutrients.fiberGrams,
    proteinGrams: facts.nutrients.proteinGrams,
    sodiumMilligrams: facts.nutrients.sodiumMilligrams,
    sugarGrams: facts.nutrients.sugarGrams,
  };
}

function toExportedPrescription(
  prescription: PlannedPrescription,
): ExportedPrescription {
  switch (prescription.kind) {
    case 'repetitions':
      return {
        kind: 'repetitions',
        repetitions: prescription.repetitions,
        sets: prescription.sets,
      };
    case 'resistance-and-repetitions':
      return {
        kind: 'resistance-and-repetitions',
        repetitions: prescription.repetitions,
        resistanceGrams: prescription.resistance?.grams ?? null,
        sets: prescription.sets,
      };
    case 'duration':
      return {
        durationSeconds: prescription.duration.seconds,
        kind: 'duration',
        sets: prescription.sets,
      };
    case 'distance':
      return {
        distanceMillimeters: prescription.distance.millimeters,
        kind: 'distance',
        sets: prescription.sets,
      };
    case 'distance-and-duration':
      return {
        distanceMillimeters: prescription.distance.millimeters,
        durationSeconds: prescription.duration.seconds,
        kind: 'distance-and-duration',
        sets: prescription.sets,
      };
  }
}

function toExportedResult(result: WorkoutResult): ExportedResult {
  switch (result.kind) {
    case 'repetitions':
      return { kind: 'repetitions', repetitions: result.repetitions };
    case 'resistance-and-repetitions':
      return {
        kind: 'resistance-and-repetitions',
        repetitions: result.repetitions,
        resistanceGrams: result.resistance.grams,
      };
    case 'duration':
      return { durationSeconds: result.duration.seconds, kind: 'duration' };
    case 'distance':
      return {
        distanceMillimeters: result.distance.millimeters,
        kind: 'distance',
      };
    case 'distance-and-duration':
      return {
        distanceMillimeters: result.distance.millimeters,
        durationSeconds: result.duration.seconds,
        kind: 'distance-and-duration',
      };
  }
}
