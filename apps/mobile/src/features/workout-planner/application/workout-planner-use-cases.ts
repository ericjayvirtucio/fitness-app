import {
  DomainError,
  DomainId,
  PlannedWorkout,
  Weekday,
  weekdayValues,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type { ExerciseCatalogRepository } from '../../exercise-catalog/application/exercise-catalog-repository';
import type {
  PlannedWorkoutDetails,
  WorkoutPlannerRepository,
  WorkoutPlannerTransactionContext,
} from './workout-planner-repository';

export type WeeklyPlanDetailsDay =
  | Readonly<{ kind: 'rest'; weekday: Weekday }>
  | Readonly<{
      details: PlannedWorkoutDetails;
      kind: 'workout';
      weekday: Weekday;
    }>;

export class GetWeeklyPlanUseCase {
  constructor(private readonly repository: WorkoutPlannerRepository) {}

  async execute(): Promise<readonly WeeklyPlanDetailsDay[]> {
    const workouts = await this.repository.getWeeklyWorkouts();
    const byDay = new Map(
      workouts.map((details) => [details.workout.weekday.value, details]),
    );
    return Object.freeze(
      weekdayValues.map((value): WeeklyPlanDetailsDay => {
        const weekday = Weekday.create(value);
        if (!weekday.isSuccess) throw new Error('Invalid weekday constant.');
        const details = byDay.get(value);
        return Object.freeze(
          details
            ? { details, kind: 'workout' as const, weekday: weekday.value }
            : { kind: 'rest' as const, weekday: weekday.value },
        );
      }),
    );
  }
}

export class GetPlannedWorkoutUseCase {
  constructor(private readonly repository: WorkoutPlannerRepository) {}
  async execute(weekdayValue: unknown) {
    const weekday = Weekday.create(weekdayValue);
    return weekday.isSuccess
      ? this.repository.getByWeekday(weekday.value)
      : null;
  }
}

export type SavePlannedWorkoutOutcome =
  | Readonly<{ error: DomainError; status: 'invalid' }>
  | Readonly<{ status: 'saved' }>;

export class SavePlannedWorkoutUseCase {
  constructor(
    private readonly catalog: ExerciseCatalogRepository,
    private readonly transactionRunner: TransactionRunner<WorkoutPlannerTransactionContext>,
  ) {}

  async execute(workout: unknown): Promise<SavePlannedWorkoutOutcome> {
    if (!(workout instanceof PlannedWorkout))
      return {
        error: DomainError.create(
          'unsupported-option',
          'Planned workout is invalid.',
          'workout',
        ),
        status: 'invalid',
      };
    const definitionIds = Object.freeze(
      [
        ...new Set(
          workout.exercises.map((item) => item.exerciseDefinitionId.value),
        ),
      ].map((value) => {
        const id = DomainId.create(value);
        if (!id.isSuccess)
          throw new Error('Invalid planned exercise identifier.');
        return id.value;
      }),
    );
    const definitions = await this.catalog.getByIds(definitionIds);
    const modes = new Map(
      definitions.map((item) => [
        item.definition.id.value,
        item.definition.loggingMode,
      ]),
    );
    if (
      definitions.length !== definitionIds.length ||
      workout.exercises.some(
        (item) =>
          !isPrescriptionCompatible(
            modes.get(item.exerciseDefinitionId.value),
            item.prescription.kind,
          ),
      )
    )
      return {
        error: DomainError.create(
          'unsupported-option',
          'A planned exercise no longer supports this target.',
          'exercises',
        ),
        status: 'invalid',
      };
    await this.transactionRunner.run(({ planner }) => planner.replace(workout));
    return { status: 'saved' };
  }
}

export class SetRestDayUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<WorkoutPlannerTransactionContext>,
  ) {}

  async execute(weekdayValue: unknown): Promise<boolean> {
    const weekday = Weekday.create(weekdayValue);
    if (!weekday.isSuccess) return false;
    return this.transactionRunner.run(({ planner }) =>
      planner.deleteByWeekday(weekday.value),
    );
  }
}

function isPrescriptionCompatible(
  mode: string | undefined,
  kind: PlannedWorkout['exercises'][number]['prescription']['kind'],
): boolean {
  if (mode === 'repetitions' || mode === 'bodyweight-and-repetitions')
    return kind === 'repetitions';
  if (
    mode === 'external-load-and-repetitions' ||
    mode === 'bodyweight-plus-load-and-repetitions' ||
    mode === 'assistance-and-repetitions'
  )
    return kind === 'resistance-and-repetitions';
  return mode === kind;
}
