import {
  DomainId,
  Duration,
  ExerciseDefinition,
  Length,
  Mass,
  PlannedExercise,
  PlannedWorkout,
  Weekday,
  createPlannedPrescription,
  type PlannedPrescription,
} from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import type { PlannedExerciseUsage } from '../../exercise-catalog/application/exercise-plan-reference-reader';
import type {
  PlannedExerciseDetails,
  PlannedWorkoutDetails,
  WorkoutPlannerRepository,
} from '../application/workout-planner-repository';

type PlannerRow = Readonly<{
  exercise_definition_id: string | null;
  exercise_display_name: string | null;
  exercise_equipment: string | null;
  exercise_logging_mode: string | null;
  exercise_notes: string | null;
  exercise_primary_muscle_group: string | null;
  planned_distance_millimeters: number | null;
  planned_duration_seconds: number | null;
  planned_exercise_id: string | null;
  planned_repetitions: number | null;
  planned_resistance_grams: number | null;
  planned_sets: number | null;
  position: number | null;
  prescription_kind: string | null;
  weekday: number;
  workout_id: string;
  workout_name: string;
}>;

const weeklyQuery = `
  SELECT
    workout.id AS workout_id,
    workout.weekday,
    workout.display_name AS workout_name,
    planned.id AS planned_exercise_id,
    planned.exercise_definition_id,
    planned.position,
    planned.prescription_kind,
    planned.planned_sets,
    planned.planned_repetitions,
    planned.planned_resistance_grams,
    planned.planned_duration_seconds,
    planned.planned_distance_millimeters,
    exercise.display_name AS exercise_display_name,
    exercise.equipment AS exercise_equipment,
    exercise.primary_muscle_group AS exercise_primary_muscle_group,
    exercise.logging_mode AS exercise_logging_mode,
    exercise.notes AS exercise_notes
  FROM planned_workout workout
  LEFT JOIN planned_exercise planned ON planned.planned_workout_id = workout.id
  LEFT JOIN exercise_catalog_item exercise
    ON exercise.id = planned.exercise_definition_id
  ORDER BY workout.weekday ASC, planned.position ASC`;

export class WorkoutPlannerSqliteRepository implements WorkoutPlannerRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getWeeklyWorkouts(): Promise<readonly PlannedWorkoutDetails[]> {
    try {
      return mapRows(await this.database.getAll<PlannerRow>(weeklyQuery));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async getByWeekday(weekday: Weekday): Promise<PlannedWorkoutDetails | null> {
    try {
      const rows = await this.database.getAll<PlannerRow>(
        `${weeklyQuery.replace('ORDER BY workout.weekday ASC, planned.position ASC', '')}
         WHERE workout.weekday = ? ORDER BY planned.position ASC`,
        [weekday.value],
      );
      return mapRows(rows)[0] ?? null;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async replace(workout: PlannedWorkout): Promise<void> {
    try {
      await this.deleteWeekday(workout.weekday);
      await this.database.run(
        'INSERT INTO planned_workout (id, weekday, display_name) VALUES (?, ?, ?)',
        [workout.id.value, workout.weekday.value, workout.name],
      );
      for (const exercise of workout.exercises) {
        await this.database.run(
          `INSERT INTO planned_exercise (
            id, planned_workout_id, exercise_definition_id, position,
            prescription_kind, planned_sets, planned_repetitions,
            planned_resistance_grams, planned_duration_seconds,
            planned_distance_millimeters
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          exerciseParameters(workout.id, exercise),
        );
      }
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async deleteByWeekday(weekday: Weekday): Promise<boolean> {
    try {
      const existing = await this.database.getFirst<{ id: string }>(
        'SELECT id FROM planned_workout WHERE weekday = ?',
        [weekday.value],
      );
      if (existing === null) return false;
      await this.deleteWeekday(weekday);
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async listUsages(
    exerciseDefinitionId: DomainId,
  ): Promise<readonly PlannedExerciseUsage[]> {
    try {
      const rows = await this.database.getAll<{
        display_name: string;
        weekday: number;
      }>(
        `SELECT workout.weekday, workout.display_name
         FROM planned_exercise planned
         JOIN planned_workout workout ON workout.id = planned.planned_workout_id
         WHERE planned.exercise_definition_id = ?
         GROUP BY workout.id, workout.weekday, workout.display_name
         ORDER BY workout.weekday ASC`,
        [exerciseDefinitionId.value],
      );
      return Object.freeze(
        rows.map((row) => {
          const weekday = Weekday.create(row.weekday);
          if (!weekday.isSuccess)
            throw new PersistenceError('operation-failed');
          return Object.freeze({
            weekday: weekday.value,
            workoutName: validWorkoutName(row.display_name),
          });
        }),
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  /**
   * Removes a weekday's plan child-first. Expo opens an exclusive transaction
   * on a connection of its own, where `PRAGMA foreign_keys` is off and cannot
   * be turned on once the transaction has begun, so `ON DELETE CASCADE` would
   * leave orphan `planned_exercise` rows that no read path can see.
   */
  private async deleteWeekday(weekday: Weekday): Promise<void> {
    await this.database.run(
      `DELETE FROM planned_exercise WHERE planned_workout_id IN (
         SELECT id FROM planned_workout WHERE weekday = ?
       )`,
      [weekday.value],
    );
    await this.database.run('DELETE FROM planned_workout WHERE weekday = ?', [
      weekday.value,
    ]);
  }
}

function mapRows(
  rows: readonly PlannerRow[],
): readonly PlannedWorkoutDetails[] {
  const groups = new Map<string, PlannerRow[]>();
  for (const row of rows) {
    const group = groups.get(row.workout_id) ?? [];
    group.push(row);
    groups.set(row.workout_id, group);
  }
  return Object.freeze([...groups.values()].map(mapWorkout));
}

function mapWorkout(rows: readonly PlannerRow[]): PlannedWorkoutDetails {
  const first = rows[0];
  if (!first) throw new PersistenceError('operation-failed');
  const workoutId = requiredId(first.workout_id);
  const weekday = Weekday.create(first.weekday);
  if (!weekday.isSuccess) throw new PersistenceError('operation-failed');
  const exerciseDetails = rows
    .filter((row) => row.planned_exercise_id !== null)
    .map(mapExercise);
  const workout = PlannedWorkout.create({
    exercises: exerciseDetails.map((details) => details.plannedExercise),
    id: workoutId,
    name: first.workout_name,
    weekday: weekday.value,
  });
  if (!workout.isSuccess) throw new PersistenceError('operation-failed');
  return Object.freeze({
    exercises: Object.freeze(exerciseDetails),
    workout: workout.value,
  });
}

function mapExercise(row: PlannerRow): PlannedExerciseDetails {
  if (
    row.planned_exercise_id === null ||
    row.exercise_definition_id === null ||
    row.exercise_display_name === null ||
    row.exercise_equipment === null ||
    row.exercise_primary_muscle_group === null ||
    row.exercise_logging_mode === null ||
    row.planned_sets === null ||
    row.position === null
  )
    throw new PersistenceError('operation-failed');
  const definitionId = requiredId(row.exercise_definition_id);
  const definition = ExerciseDefinition.create({
    equipment: row.exercise_equipment,
    id: definitionId,
    loggingMode: row.exercise_logging_mode,
    name: row.exercise_display_name,
    notes: row.exercise_notes,
    primaryMuscleGroup: row.exercise_primary_muscle_group,
  });
  if (!definition.isSuccess) throw new PersistenceError('operation-failed');
  const prescription = mapPrescription(row, definition.value.loggingMode);
  const plannedExercise = PlannedExercise.create({
    exerciseDefinitionId: definitionId,
    id: requiredId(row.planned_exercise_id),
    position: row.position,
    prescription,
  });
  if (!plannedExercise.isSuccess)
    throw new PersistenceError('operation-failed');
  return Object.freeze({
    definition: definition.value,
    plannedExercise: plannedExercise.value,
  });
}

function mapPrescription(
  row: PlannerRow,
  loggingMode: ExerciseDefinition['loggingMode'],
): PlannedPrescription {
  const resistance =
    row.planned_resistance_grams === null
      ? null
      : Mass.create(row.planned_resistance_grams, 'gram');
  const duration =
    row.planned_duration_seconds === null
      ? null
      : Duration.create(row.planned_duration_seconds, 'second');
  const distance =
    row.planned_distance_millimeters === null
      ? null
      : Length.create(row.planned_distance_millimeters, 'millimeter');
  if (
    (resistance !== null && !resistance.isSuccess) ||
    (duration !== null && !duration.isSuccess) ||
    (distance !== null && !distance.isSuccess)
  )
    throw new PersistenceError('operation-failed');
  const result = createPlannedPrescription({
    ...(distance?.isSuccess ? { distance: distance.value } : {}),
    ...(duration?.isSuccess ? { duration: duration.value } : {}),
    loggingMode,
    repetitions: row.planned_repetitions,
    ...(resistance?.isSuccess ? { resistance: resistance.value } : {}),
    sets: row.planned_sets,
  });
  if (!result.isSuccess || result.value.kind !== row.prescription_kind)
    throw new PersistenceError('operation-failed');
  return result.value;
}

function exerciseParameters(
  workoutId: DomainId,
  exercise: PlannedWorkout['exercises'][number],
): DatabaseParameters {
  const target = exercise.prescription;
  return [
    exercise.id.value,
    workoutId.value,
    exercise.exerciseDefinitionId.value,
    exercise.position,
    target.kind,
    target.sets,
    'repetitions' in target ? target.repetitions : null,
    'resistance' in target ? (target.resistance?.grams ?? null) : null,
    'duration' in target ? target.duration.seconds : null,
    'distance' in target ? target.distance.millimeters : null,
  ];
}

function requiredId(value: string): DomainId {
  const id = DomainId.create(value);
  if (!id.isSuccess) throw new PersistenceError('operation-failed');
  return id.value;
}

function validWorkoutName(value: string): string {
  if (value.trim() === '' || value.trim().length > 80)
    throw new PersistenceError('operation-failed');
  return value.trim();
}
