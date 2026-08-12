import type { DomainId, WorkoutSession } from '@fitness/domain';
import type {
  ExercisePerformancePage,
  PerformedExerciseSummary,
  WorkoutHistoryPage,
  WorkoutHistoryPageQuery,
  WorkoutHistoryRange,
  WorkoutProgressSummary,
  WorkoutProgressDay,
} from './workout-history-models';

export interface WorkoutHistoryRepository {
  getCompletedById(id: DomainId): Promise<WorkoutSession | null>;
  listCompletedPage(
    query: WorkoutHistoryPageQuery,
  ): Promise<WorkoutHistoryPage>;
  listExercisePerformancePage(
    exerciseDefinitionId: DomainId,
    query: WorkoutHistoryPageQuery,
  ): Promise<ExercisePerformancePage>;
  listPerformedExercises(
    limit: number,
  ): Promise<readonly PerformedExerciseSummary[]>;
  listRecentlyPerformedExerciseIds(limit: number): Promise<readonly DomainId[]>;
  summarizeCompletedRange(
    range: WorkoutHistoryRange,
  ): Promise<WorkoutProgressSummary>;
  summarizeCompletedByDay(
    range: WorkoutHistoryRange,
  ): Promise<readonly WorkoutProgressDay[]>;
}
