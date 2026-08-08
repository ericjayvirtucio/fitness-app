import { DomainId, type WorkoutSession } from '@fitness/domain';
import type {
  WorkoutHistoryPageQuery,
  WorkoutHistoryRange,
} from './workout-history-models';
import { workoutHistoryPagePolicy } from './workout-history-models';
import type { WorkoutHistoryRepository } from './workout-history-repository';

export class ListWorkoutHistoryUseCase {
  constructor(private readonly repository: WorkoutHistoryRepository) {}

  execute(query: WorkoutHistoryPageQuery = {}) {
    return this.repository.listCompletedPage({
      ...query,
      limit: normalizeLimit(query.limit),
    });
  }
}

export class GetCompletedWorkoutSessionUseCase {
  constructor(private readonly repository: WorkoutHistoryRepository) {}

  execute(id: unknown): Promise<WorkoutSession | null> {
    const result = DomainId.create(id);
    return result.isSuccess
      ? this.repository.getCompletedById(result.value)
      : Promise.resolve(null);
  }
}

export class GetWorkoutProgressSummaryUseCase {
  constructor(private readonly repository: WorkoutHistoryRepository) {}

  execute(range: WorkoutHistoryRange) {
    if (
      !isCalendarDate(range.startLocalCalendarDate) ||
      !isCalendarDate(range.endLocalCalendarDate) ||
      range.startLocalCalendarDate > range.endLocalCalendarDate
    )
      throw new Error('Workout history date range is invalid.');
    return this.repository.summarizeCompletedRange(range);
  }
}

export class ListExercisePerformanceHistoryUseCase {
  constructor(private readonly repository: WorkoutHistoryRepository) {}

  execute(exerciseDefinitionId: unknown, query: WorkoutHistoryPageQuery = {}) {
    const id = DomainId.create(exerciseDefinitionId);
    if (!id.isSuccess) return Promise.resolve(null);
    return this.repository.listExercisePerformancePage(id.value, {
      ...query,
      limit: normalizeLimit(query.limit),
    });
  }
}

export class ListRecentlyPerformedExerciseIdsUseCase {
  constructor(private readonly repository: WorkoutHistoryRepository) {}

  execute(limit = 10) {
    return this.repository.listRecentlyPerformedExerciseIds(
      Math.min(Math.max(Math.trunc(limit), 1), 20),
    );
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return workoutHistoryPagePolicy.defaultLimit;
  if (!Number.isInteger(limit) || limit < 1)
    return workoutHistoryPagePolicy.defaultLimit;
  return Math.min(limit, workoutHistoryPagePolicy.maximumLimit);
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
