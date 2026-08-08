import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { DomainId } from '@fitness/domain';
import { WorkoutHistorySqliteRepository } from './workout-history-sqlite-repository';

class FakeDatabase implements DatabaseConnection {
  allRows: readonly unknown[] = [];
  firstRow: unknown = null;
  lastParameters: DatabaseParameters = [];
  lastStatement = '';

  exec(): Promise<void> {
    return Promise.resolve();
  }
  getAll<TResult>(statement: string, parameters: DatabaseParameters = []) {
    this.lastStatement = statement;
    this.lastParameters = parameters;
    return Promise.resolve(this.allRows as readonly TResult[]);
  }
  getFirst<TResult>(statement: string, parameters: DatabaseParameters = []) {
    this.lastStatement = statement;
    this.lastParameters = parameters;
    return Promise.resolve(this.firstRow as TResult | null);
  }
  getVersion(): Promise<number> {
    return Promise.resolve(10);
  }
  run(): Promise<void> {
    return Promise.resolve();
  }
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

const historyRow = {
  actual_set_count: 3,
  completed_at_epoch_ms: Date.UTC(2026, 7, 8, 4, 30),
  display_name: 'Push Day',
  exercise_count: 2,
  id: '550e8400-e29b-41d4-a716-446655440000',
  performed_exercise_count: 1,
  started_at_epoch_ms: Date.UTC(2026, 7, 8, 4),
  started_local_calendar_date: '2026-08-08',
  started_utc_offset_minutes: 480,
};

describe('WorkoutHistorySqliteRepository', () => {
  it('maps a bounded completed page and emits a stable cursor', async () => {
    const database = new FakeDatabase();
    database.allRows = [
      historyRow,
      { ...historyRow, id: historyRow.id.replace(/0$/, '1') },
    ];

    const page = await new WorkoutHistorySqliteRepository(
      database,
    ).listCompletedPage({ limit: 1 });

    expect(database.lastStatement).toContain('session.status = ?');
    expect(database.lastParameters).toEqual(['completed', 2]);
    expect(page.items[0]).toMatchObject({
      actualSetCount: 3,
      elapsedSeconds: 1_800,
      nameSnapshot: 'Push Day',
      performedExerciseCount: 1,
    });
    expect(page.nextCursor).toEqual({
      id: historyRow.id,
      startedAtEpochMilliseconds: historyRow.started_at_epoch_ms,
      startedLocalCalendarDate: '2026-08-08',
    });
  });

  it('binds captured date ranges and preserves absent dimensions', async () => {
    const database = new FakeDatabase();
    database.firstRow = {
      actual_set_count: 2,
      completed_workout_count: 1,
      distance_millimeters: null,
      duration_seconds: null,
      elapsed_workout_ms: 1_500_000,
      performed_exercise_count: 1,
      recorded_load_volume: 240_000,
      repetitions: 16,
    };

    const summary = await new WorkoutHistorySqliteRepository(
      database,
    ).summarizeCompletedRange({
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    });

    expect(database.lastParameters).toEqual(['2026-08-02', '2026-08-08']);
    expect(database.lastStatement).toContain(
      "'bodyweight-plus-load-and-repetitions'",
    );
    expect(database.lastStatement).not.toContain(
      "'assistance-and-repetitions'\n            ) THEN",
    );
    expect(summary).toEqual({
      actualSetCount: 2,
      completedWorkoutCount: 1,
      distanceMillimeters: null,
      durationSeconds: null,
      elapsedWorkoutSeconds: 1_500,
      performedExerciseCount: 1,
      recordedLoadVolumeGramRepetitions: 240_000,
      repetitions: 16,
    });
  });

  it('derives recents from completed performed sets', async () => {
    const database = new FakeDatabase();
    database.allRows = [{ id: historyRow.id }];
    const ids = await new WorkoutHistorySqliteRepository(
      database,
    ).listRecentlyPerformedExerciseIds(10);
    expect(ids[0]?.value).toBe(historyRow.id);
    expect(database.lastStatement).toContain("session.status = 'completed'");
    expect(database.lastStatement).toContain('JOIN workout_set');
    expect(database.lastParameters).toEqual([10]);
  });

  it('groups completed actual performance by captured local date', async () => {
    const database = new FakeDatabase();
    database.allRows = [
      {
        actual_set_count: 2,
        completed_workout_count: 1,
        local_calendar_date: '2026-08-08',
        performed_exercise_count: 1,
      },
    ];
    const days = await new WorkoutHistorySqliteRepository(
      database,
    ).summarizeCompletedByDay({
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    });
    expect(days).toEqual([
      {
        actualSetCount: 2,
        completedWorkoutCount: 1,
        localCalendarDate: '2026-08-08',
        performedExerciseCount: 1,
      },
    ]);
    expect(database.lastStatement).toContain("session.status = 'completed'");
  });

  it('projects mode-specific exercise performance from actual sets', async () => {
    const database = new FakeDatabase();
    database.allRows = [
      {
        actual_set_count: 2,
        distance_millimeters: null,
        duration_seconds: null,
        exercise_name_snapshot: 'Bench Press',
        id: '550e8400-e29b-41d4-a716-446655440001',
        logging_mode_snapshot: 'external-load-and-repetitions',
        maximum_resistance_grams: 60_000,
        recorded_load_volume: 960_000,
        repetitions: 16,
        session_id: historyRow.id,
        session_name_snapshot: 'Push Day',
        started_at_epoch_ms: historyRow.started_at_epoch_ms,
        started_local_calendar_date: '2026-08-08',
      },
    ];
    const definitionId = DomainId.create(
      '550e8400-e29b-41d4-a716-446655440009',
    );
    if (!definitionId.isSuccess) throw new Error('Invalid fixture');
    const page = await new WorkoutHistorySqliteRepository(
      database,
    ).listExercisePerformancePage(definitionId.value, { limit: 20 });
    expect(page.items[0]).toMatchObject({
      maximumResistanceGrams: 60_000,
      recordedLoadVolumeGramRepetitions: 960_000,
      repetitions: 16,
    });
    expect(database.lastStatement).toContain('SUM(actual.repetitions)');
  });

  it('rejects corrupt projected history safely', async () => {
    const database = new FakeDatabase();
    database.allRows = [
      { ...historyRow, started_local_calendar_date: '2026-02-30' },
    ];
    await expect(
      new WorkoutHistorySqliteRepository(database).listCompletedPage({}),
    ).rejects.toMatchObject({ code: 'operation-failed' });
  });
});
