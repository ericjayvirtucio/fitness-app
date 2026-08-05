import type {
  ExerciseDefinition,
  PlannedWorkout,
  Weekday,
} from '@fitness/domain';
import type { ExercisePlanReferenceReader } from '../../exercise-catalog/application/exercise-plan-reference-reader';

export type PlannedExerciseDetails = Readonly<{
  definition: ExerciseDefinition;
  plannedExercise: PlannedWorkout['exercises'][number];
}>;

export type PlannedWorkoutDetails = Readonly<{
  exercises: readonly PlannedExerciseDetails[];
  workout: PlannedWorkout;
}>;

export interface WorkoutPlannerRepository extends ExercisePlanReferenceReader {
  deleteByWeekday(weekday: Weekday): Promise<boolean>;
  getByWeekday(weekday: Weekday): Promise<PlannedWorkoutDetails | null>;
  getWeeklyWorkouts(): Promise<readonly PlannedWorkoutDetails[]>;
  replace(workout: PlannedWorkout): Promise<void>;
}

export type WorkoutPlannerTransactionContext = Readonly<{
  planner: WorkoutPlannerRepository;
}>;
