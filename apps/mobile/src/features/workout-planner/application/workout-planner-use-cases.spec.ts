import {
  DomainId,
  ExerciseDefinition,
  PlannedExercise,
  PlannedWorkout,
  Weekday,
  createPlannedPrescription,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import type { ExerciseCatalogRepository } from '../../exercise-catalog/application/exercise-catalog-repository';
import {
  GetWeeklyPlanUseCase,
  SavePlannedWorkoutUseCase,
  SetRestDayUseCase,
} from './workout-planner-use-cases';
import type {
  PlannedWorkoutDetails,
  WorkoutPlannerRepository,
  WorkoutPlannerTransactionContext,
} from './workout-planner-repository';

const ids = [
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
];
function value<T>(result: { isSuccess: boolean; value?: T }): T {
  if (!result.isSuccess || result.value === undefined)
    throw new Error('Invalid fixture');
  return result.value;
}
function fixture() {
  const definition = value(
    ExerciseDefinition.create({
      equipment: 'bodyweight',
      id: value(DomainId.create(ids[2])),
      loggingMode: 'bodyweight-and-repetitions',
      name: 'Push-up',
      primaryMuscleGroup: 'chest',
    }),
  );
  const plannedExercise = value(
    PlannedExercise.create({
      exerciseDefinitionId: definition.id,
      id: value(DomainId.create(ids[1])),
      position: 0,
      prescription: value(
        createPlannedPrescription({
          loggingMode: definition.loggingMode,
          repetitions: 12,
          sets: 3,
        }),
      ),
    }),
  );
  const workout = value(
    PlannedWorkout.create({
      exercises: [plannedExercise],
      id: value(DomainId.create(ids[0])),
      name: 'Push Day',
      weekday: value(Weekday.create(1)),
    }),
  );
  const item = value(
    ExerciseCatalogItem.create({ definition, isFavorite: false }),
  );
  return { definition, item, plannedExercise, workout };
}

class MemoryPlanner implements WorkoutPlannerRepository {
  workouts: PlannedWorkoutDetails[] = [];
  replace = jest.fn((workout: PlannedWorkout) => {
    const current = fixture();
    this.workouts = [
      {
        exercises: [
          {
            definition: current.definition,
            plannedExercise: workout.exercises[0] ?? current.plannedExercise,
          },
        ],
        workout,
      },
    ];
    return Promise.resolve();
  });
  deleteByWeekday = jest.fn(() => Promise.resolve(true));
  getByWeekday = jest.fn((weekday: Weekday) =>
    Promise.resolve(
      this.workouts.find((item) => item.workout.weekday.equals(weekday)) ??
        null,
    ),
  );
  getWeeklyWorkouts = jest.fn(() => Promise.resolve(this.workouts));
  listUsages = jest.fn(() => Promise.resolve([]));
}

function catalog(item: ExerciseCatalogItem): ExerciseCatalogRepository {
  return {
    delete: jest.fn(),
    findByNormalizedName: jest.fn(),
    getById: jest.fn(),
    getByIds: jest.fn(() => Promise.resolve([item])),
    insert: jest.fn(),
    listAll: jest.fn(),
    listFavorites: jest.fn(),
    search: jest.fn(),
    setFavorite: jest.fn(),
    update: jest.fn(),
  };
}

function runner(
  planner: WorkoutPlannerRepository,
  item = fixture().item,
): TransactionRunner<WorkoutPlannerTransactionContext> {
  return { run: (operation) => operation({ catalog: catalog(item), planner }) };
}

describe('workout planner application', () => {
  it('materializes a Sunday-to-Saturday plan with Rest defaults', async () => {
    const planner = new MemoryPlanner();
    const current = fixture();
    planner.workouts = [
      {
        exercises: [
          {
            definition: current.definition,
            plannedExercise: current.plannedExercise,
          },
        ],
        workout: current.workout,
      },
    ];
    const days = await new GetWeeklyPlanUseCase(planner).execute();
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ kind: 'rest', weekday: { value: 0 } });
    expect(days[1]).toMatchObject({ kind: 'workout', weekday: { value: 1 } });
  });

  it('validates current catalog mode then atomically saves', async () => {
    const current = fixture();
    const planner = new MemoryPlanner();
    await expect(
      new SavePlannedWorkoutUseCase(runner(planner, current.item)).execute(
        current.workout,
      ),
    ).resolves.toEqual({ status: 'saved' });
    expect(planner.replace).toHaveBeenCalledWith(current.workout);
  });

  it('rejects a missing or incompatible Exercise Definition without writing', async () => {
    const current = fixture();
    const planner = new MemoryPlanner();
    const missingRunner: TransactionRunner<WorkoutPlannerTransactionContext> = {
      run: (operation) => {
        const missing = catalog(current.item);
        missing.getByIds = jest.fn(() => Promise.resolve([]));
        return operation({ catalog: missing, planner });
      },
    };
    await expect(
      new SavePlannedWorkoutUseCase(missingRunner).execute(current.workout),
    ).resolves.toMatchObject({
      status: 'invalid',
      error: { field: 'exercises' },
    });
    expect(planner.replace).not.toHaveBeenCalled();
  });

  it('sets a valid day to Rest through the transaction context', async () => {
    const planner = new MemoryPlanner();
    await expect(
      new SetRestDayUseCase(runner(planner)).execute(1),
    ).resolves.toBe(true);
    expect(planner.deleteByWeekday).toHaveBeenCalledWith(
      expect.objectContaining({ value: 1 }),
    );
    await expect(
      new SetRestDayUseCase(runner(planner)).execute(9),
    ).resolves.toBe(false);
  });
});
