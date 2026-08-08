import type { DomainId, WorkoutSession } from '@fitness/domain';
import type {
  ExercisePerformancePage,
  WorkoutHistoryPage,
  WorkoutHistoryPageQuery,
  WorkoutHistoryRange,
  WorkoutProgressSummary,
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
  listRecentlyPerformedExerciseIds(limit: number): Promise<readonly DomainId[]>;
  summarizeCompletedRange(
    range: WorkoutHistoryRange,
  ): Promise<WorkoutProgressSummary>;
}
