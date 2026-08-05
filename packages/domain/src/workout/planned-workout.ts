import { DomainError } from '../shared/domain-error';
import { DomainId } from '../shared/domain-id';
import { err, ok, type Result } from '../shared/result';
import {
  isPlannedPrescription,
  type PlannedPrescription,
} from './planned-prescription';
import { Weekday, weekdayValues } from './weekday';

export const plannedWorkoutPolicy = Object.freeze({
  maximumExercises: 100,
  maximumNameLength: 80,
});

export class PlannedExercise {
  private constructor(
    readonly id: DomainId,
    readonly exerciseDefinitionId: DomainId,
    readonly position: number,
    readonly prescription: PlannedPrescription,
  ) {
    Object.freeze(this);
  }

  static create(
    input: Readonly<{
      exerciseDefinitionId: unknown;
      id: unknown;
      position: unknown;
      prescription: unknown;
    }>,
  ): Result<PlannedExercise, DomainError> {
    if (!(input.id instanceof DomainId)) return invalidId('id');
    if (!(input.exerciseDefinitionId instanceof DomainId))
      return invalidId('exerciseDefinitionId');
    if (
      typeof input.position !== 'number' ||
      !Number.isInteger(input.position) ||
      input.position < 0
    )
      return err(
        DomainError.create(
          'out-of-range',
          'Exercise position is invalid.',
          'position',
        ),
      );
    if (!isPlannedPrescription(input.prescription))
      return err(
        DomainError.create(
          'unsupported-option',
          'Planned prescription is invalid.',
          'prescription',
        ),
      );
    return ok(
      new PlannedExercise(
        input.id,
        input.exerciseDefinitionId,
        input.position,
        input.prescription,
      ),
    );
  }
}

export class PlannedWorkout {
  private constructor(
    readonly id: DomainId,
    readonly weekday: Weekday,
    readonly name: string,
    readonly exercises: readonly PlannedExercise[],
  ) {
    Object.freeze(this);
  }

  static create(
    input: Readonly<{
      exercises: unknown;
      id: unknown;
      name: unknown;
      weekday: unknown;
    }>,
  ): Result<PlannedWorkout, DomainError> {
    if (!(input.id instanceof DomainId)) return invalidId('id');
    if (!(input.weekday instanceof Weekday))
      return err(
        DomainError.create(
          'unsupported-option',
          'Workout day is invalid.',
          'weekday',
        ),
      );
    if (typeof input.name !== 'string' || input.name.trim() === '')
      return err(
        DomainError.create(
          'required-field',
          'Workout name is required.',
          'name',
        ),
      );
    const name = input.name.trim();
    if (name.length > plannedWorkoutPolicy.maximumNameLength)
      return err(
        DomainError.create('out-of-range', 'Workout name is too long.', 'name'),
      );
    if (!Array.isArray(input.exercises)) return invalidExercises();
    if (input.exercises.length > plannedWorkoutPolicy.maximumExercises)
      return invalidExercises();
    if (
      !input.exercises.every((exercise) => exercise instanceof PlannedExercise)
    )
      return invalidExercises();
    const exercises = input.exercises as readonly PlannedExercise[];
    if (
      exercises.some((exercise, index) => exercise.position !== index) ||
      new Set(exercises.map((exercise) => exercise.id.value)).size !==
        exercises.length
    )
      return invalidExercises();
    return ok(
      new PlannedWorkout(
        input.id,
        input.weekday,
        name,
        Object.freeze([...exercises]),
      ),
    );
  }
}

export type PlannedDay =
  | Readonly<{ kind: 'rest'; weekday: Weekday }>
  | Readonly<{
      kind: 'workout';
      weekday: Weekday;
      workout: PlannedWorkout;
    }>;

export class WeeklyWorkoutPlan {
  private constructor(readonly days: readonly PlannedDay[]) {
    Object.freeze(this);
  }

  static create(
    workouts: readonly PlannedWorkout[],
  ): Result<WeeklyWorkoutPlan, DomainError> {
    if (!workouts.every((workout) => workout instanceof PlannedWorkout))
      return invalidExercises();
    const byDay = new Map(
      workouts.map((workout) => [workout.weekday.value, workout]),
    );
    if (byDay.size !== workouts.length)
      return err(
        DomainError.create(
          'unsupported-option',
          'Only one workout is allowed per day.',
          'weekday',
        ),
      );
    const days = weekdayValues.map((value): PlannedDay => {
      const weekday = Weekday.create(value);
      if (!weekday.isSuccess) throw new Error('Invalid weekday constant.');
      const workout = byDay.get(value);
      return Object.freeze(
        workout
          ? { kind: 'workout' as const, weekday: weekday.value, workout }
          : { kind: 'rest' as const, weekday: weekday.value },
      );
    });
    return ok(new WeeklyWorkoutPlan(Object.freeze(days)));
  }
}

function invalidId(field: string): Result<never, DomainError> {
  return err(
    DomainError.create('invalid-identifier', 'Identifier is invalid.', field),
  );
}

function invalidExercises(): Result<never, DomainError> {
  return err(
    DomainError.create(
      'unsupported-option',
      'Planned exercises are invalid.',
      'exercises',
    ),
  );
}
