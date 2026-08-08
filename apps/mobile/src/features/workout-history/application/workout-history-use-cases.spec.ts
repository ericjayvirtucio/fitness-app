import { DomainId, type WorkoutSession } from '@fitness/domain';
import type {
  WorkoutHistoryPageQuery,
  WorkoutHistoryRange,
} from './workout-history-models';
import type { WorkoutHistoryRepository } from './workout-history-repository';
import {
  GetCompletedWorkoutSessionUseCase,
  GetWorkoutProgressSummaryUseCase,
  ListRecentlyPerformedExerciseIdsUseCase,
  ListWorkoutHistoryUseCase,
} from './workout-history-use-cases';

class Repository implements WorkoutHistoryRepository {
  lastLimit = 0;
  range?: WorkoutHistoryRange;

  getCompletedById(): Promise<WorkoutSession | null> {
    return Promise.resolve(null);
  }
  listCompletedPage(query: WorkoutHistoryPageQuery) {
    this.lastLimit = query.limit ?? 0;
    return Promise.resolve({ items: [], nextCursor: null });
  }
  listExercisePerformancePage() {
    return Promise.resolve({ items: [], nextCursor: null });
  }
  listRecentlyPerformedExerciseIds(limit: number) {
    this.lastLimit = limit;
    return Promise.resolve([]);
  }
  summarizeCompletedRange(range: WorkoutHistoryRange) {
    this.range = range;
    return Promise.resolve({
      actualSetCount: 0,
      completedWorkoutCount: 0,
      distanceMillimeters: null,
      durationSeconds: null,
      elapsedWorkoutSeconds: 0,
      performedExerciseCount: 0,
      recordedLoadVolumeGramRepetitions: null,
      repetitions: null,
    });
  }
  summarizeCompletedByDay(): Promise<readonly []> {
    return Promise.resolve([]);
  }
}

describe('workout history use cases', () => {
  it('bounds page and recent limits', async () => {
    const repository = new Repository();
    await new ListWorkoutHistoryUseCase(repository).execute({ limit: 500 });
    expect(repository.lastLimit).toBe(50);
    await new ListRecentlyPerformedExerciseIdsUseCase(repository).execute(500);
    expect(repository.lastLimit).toBe(20);
  });

  it('accepts valid inclusive captured-local-date ranges', async () => {
    const repository = new Repository();
    const range = {
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    };
    await new GetWorkoutProgressSummaryUseCase(repository).execute(range);
    expect(repository.range).toEqual(range);
  });

  it('rejects invalid or reversed ranges before persistence', () => {
    const useCase = new GetWorkoutProgressSummaryUseCase(new Repository());
    expect(() =>
      useCase.execute({
        endLocalCalendarDate: '2026-08-01',
        startLocalCalendarDate: '2026-08-02',
      }),
    ).toThrow('Workout history date range is invalid.');
    expect(() =>
      useCase.execute({
        endLocalCalendarDate: '2026-02-30',
        startLocalCalendarDate: '2026-02-30',
      }),
    ).toThrow('Workout history date range is invalid.');
  });

  it('does not query storage for an invalid completed-session identifier', async () => {
    const repository = new Repository();
    await expect(
      new GetCompletedWorkoutSessionUseCase(repository).execute('invalid'),
    ).resolves.toBeNull();
  });

  it('accepts the established UUID format', () => {
    expect(
      DomainId.create('550e8400-e29b-41d4-a716-446655440000').isSuccess,
    ).toBe(true);
  });
});
