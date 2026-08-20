import { DomainId, type WorkoutSession } from '@fitness/domain';
import {
  emptyExercisePersonalRecords,
  type ExercisePersonalRecords,
} from './exercise-personal-records';
import type {
  CompletedWorkoutPageQuery,
  WorkoutHistoryRange,
} from './workout-history-models';
import type { WorkoutHistoryRepository } from './workout-history-repository';
import type { WorkoutPersonalRecordsReader } from './workout-personal-records-reader';
import {
  GetCompletedWorkoutSessionUseCase,
  GetExercisePersonalRecordsUseCase,
  GetWorkoutProgressSummaryUseCase,
  ListPerformedExercisesUseCase,
  ListRecentlyPerformedExerciseIdsUseCase,
  ListWorkoutHistoryUseCase,
} from './workout-history-use-cases';

class PersonalRecordsReader implements WorkoutPersonalRecordsReader {
  requestedIds: string[] = [];

  readExercisePersonalRecords(
    exerciseDefinitionId: DomainId,
  ): Promise<ExercisePersonalRecords> {
    this.requestedIds.push(exerciseDefinitionId.value);
    return Promise.resolve(emptyExercisePersonalRecords);
  }
}

class Repository implements WorkoutHistoryRepository {
  lastLimit = 0;
  lastPageQuery?: CompletedWorkoutPageQuery;
  range?: WorkoutHistoryRange;

  getCompletedById(): Promise<WorkoutSession | null> {
    return Promise.resolve(null);
  }
  listCompletedPage(query: CompletedWorkoutPageQuery) {
    this.lastLimit = query.limit ?? 0;
    this.lastPageQuery = query;
    return Promise.resolve({ items: [], nextCursor: null });
  }
  listExercisePerformancePage() {
    return Promise.resolve({ items: [], nextCursor: null });
  }
  listPerformedExercises(limit: number) {
    this.lastLimit = limit;
    return Promise.resolve([]);
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
    await new ListPerformedExercisesUseCase(repository).execute(500);
    expect(repository.lastLimit).toBe(20);
  });

  it('forwards a listed range unchanged with the normalized limit', async () => {
    const repository = new Repository();
    const range = {
      endLocalCalendarDate: '2026-07-31',
      startLocalCalendarDate: '2026-07-01',
    };

    await new ListWorkoutHistoryUseCase(repository).execute({ range });

    expect(repository.lastPageQuery).toEqual({ limit: 20, range });
  });

  it('lists all completed history when no range is given', async () => {
    const repository = new Repository();

    await new ListWorkoutHistoryUseCase(repository).execute();

    expect(repository.lastPageQuery).toEqual({ limit: 20 });
    expect(repository.lastPageQuery).not.toHaveProperty('range');
  });

  it('refuses an invalid or reversed listed range before reading', () => {
    const repository = new Repository();
    const useCase = new ListWorkoutHistoryUseCase(repository);

    expect(() =>
      useCase.execute({
        range: {
          endLocalCalendarDate: '2026-07-01',
          startLocalCalendarDate: '2026-07-31',
        },
      }),
    ).toThrow('Workout history date range is invalid.');
    expect(() =>
      useCase.execute({
        range: {
          endLocalCalendarDate: '2026-02-30',
          startLocalCalendarDate: '2026-02-30',
        },
      }),
    ).toThrow('Workout history date range is invalid.');
    expect(repository.lastPageQuery).toBeUndefined();
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

  it('does not read records for an invalid exercise identifier', async () => {
    const reader = new PersonalRecordsReader();

    await expect(
      new GetExercisePersonalRecordsUseCase(reader).execute('invalid'),
    ).resolves.toBeNull();
    expect(reader.requestedIds).toEqual([]);
  });

  it('reads records for a valid exercise identifier', async () => {
    const reader = new PersonalRecordsReader();

    await expect(
      new GetExercisePersonalRecordsUseCase(reader).execute(
        '550e8400-e29b-41d4-a716-446655440000',
      ),
    ).resolves.toEqual(emptyExercisePersonalRecords);
    expect(reader.requestedIds).toEqual([
      '550e8400-e29b-41d4-a716-446655440000',
    ]);
  });

  it('accepts the established UUID format', () => {
    expect(
      DomainId.create('550e8400-e29b-41d4-a716-446655440000').isSuccess,
    ).toBe(true);
  });
});
