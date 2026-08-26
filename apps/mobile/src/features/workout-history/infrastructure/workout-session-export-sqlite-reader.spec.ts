import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { WorkoutSessionExportSqliteReader } from './workout-session-export-sqlite-reader';

type Query = { parameters: DatabaseParameters; statement: string };

class FakeDatabase implements DatabaseConnection {
  responses: readonly (readonly unknown[])[] = [];
  readonly queries: Query[] = [];

  exec(): Promise<void> {
    return Promise.resolve();
  }
  getFirst<TResult>(): Promise<TResult | null> {
    return Promise.resolve(null);
  }
  getAll<TResult>(
    statement: string,
    parameters: DatabaseParameters = [],
  ): Promise<readonly TResult[]> {
    const index = this.queries.length;
    this.queries.push({ parameters, statement });
    return Promise.resolve((this.responses[index] ?? []) as readonly TResult[]);
  }
  getVersion(): Promise<number> {
    return Promise.resolve(11);
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

const sessionId = '123e4567-e89b-42d3-a456-426614174000';
const exerciseId = '223e4567-e89b-42d3-a456-426614174000';
const setId = '323e4567-e89b-42d3-a456-426614174000';
const definitionId = '423e4567-e89b-42d3-a456-426614174000';

const sessionRow = {
  completed_at_epoch_ms: Date.UTC(2026, 7, 4, 6),
  display_name: 'E2E Lower Body',
  id: sessionId,
  source_planned_workout_id: null,
  source_weekday: null,
  started_at_epoch_ms: Date.UTC(2026, 7, 4, 5),
  started_local_calendar_date: '2026-08-04',
  started_utc_offset_minutes: 480,
  status: 'completed',
};

const exerciseRow = {
  exercise_name_snapshot: 'E2E Back Squat',
  id: exerciseId,
  logging_mode_snapshot: 'external-load-and-repetitions',
  planned_distance_millimeters: null,
  planned_duration_seconds: null,
  planned_kind: null,
  planned_repetitions: null,
  planned_resistance_grams: null,
  planned_sets: null,
  position: 0,
  source_exercise_definition_id: definitionId,
  source_planned_exercise_id: null,
  workout_session_id: sessionId,
};

const setRow = {
  distance_millimeters: null,
  duration_seconds: null,
  id: setId,
  position: 0,
  repetitions: 5,
  reps_in_reserve: null,
  resistance_grams: 100_000,
  result_kind: 'resistance-and-repetitions',
  workout_session_exercise_id: exerciseId,
};

describe('WorkoutSessionExportSqliteReader', () => {
  it('reads completed sessions with their stored snapshots and sets', async () => {
    const database = new FakeDatabase();
    database.responses = [[sessionRow], [exerciseRow], [setRow]];
    const reader = new WorkoutSessionExportSqliteReader(database);

    const page = await reader.listCompletedSessionsPage({ limit: 200 });

    const session = page.items[0];
    expect(session?.status).toBe('completed');
    expect(session?.name).toBe('E2E Lower Body');
    expect(session?.exercises[0]?.exerciseNameSnapshot).toBe('E2E Back Squat');
    expect(session?.exercises[0]?.sourceExerciseDefinitionId.value).toBe(
      definitionId,
    );
    expect(session?.exercises[0]?.sets).toHaveLength(1);
    expect(session?.startedLocalCalendarDate).toBe('2026-08-04');
    expect(session?.startedUtcOffsetMinutes).toBe(480);
  });

  it('reads snapshots without joining the current exercise catalog or planner', async () => {
    const database = new FakeDatabase();
    database.responses = [[sessionRow], [exerciseRow], [setRow]];
    const reader = new WorkoutSessionExportSqliteReader(database);

    await reader.listCompletedSessionsPage({ limit: 200 });

    const statements = database.queries
      .map((query) => query.statement)
      .join(' ');
    expect(statements).not.toContain('exercise_catalog_item');
    expect(statements).not.toContain('planned_workout');
    expect(statements).not.toContain('planned_exercise');
  });

  it('excludes active sessions and orders by the started triple', async () => {
    const database = new FakeDatabase();
    const reader = new WorkoutSessionExportSqliteReader(database);

    await reader.listCompletedSessionsPage({ limit: 200 });

    const query = database.queries[0];
    expect(query?.statement).toContain('WHERE status = ?');
    expect(query?.statement).toContain(
      'ORDER BY started_local_calendar_date ASC, started_at_epoch_ms ASC, id ASC',
    );
    expect(query?.parameters).toEqual(['completed', 201]);
  });

  it('resumes from the cursor with bound parameters', async () => {
    const database = new FakeDatabase();
    const reader = new WorkoutSessionExportSqliteReader(database);

    await reader.listCompletedSessionsPage({
      cursor: {
        id: sessionId,
        localCalendarDate: '2026-08-04',
        occurredAtEpochMilliseconds: 42,
      },
      limit: 2,
    });

    expect(database.queries[0]?.parameters).toEqual([
      'completed',
      '2026-08-04',
      '2026-08-04',
      42,
      '2026-08-04',
      42,
      sessionId,
      3,
    ]);
  });

  it('does not read children when the page is empty', async () => {
    const database = new FakeDatabase();
    const reader = new WorkoutSessionExportSqliteReader(database);

    const page = await reader.listCompletedSessionsPage({ limit: 200 });

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(database.queries).toHaveLength(1);
  });

  it('reports a further page from the last returned session only', async () => {
    const database = new FakeDatabase();
    const lookAhead = { ...sessionRow, id: 'look-ahead' };
    database.responses = [[sessionRow, lookAhead], [exerciseRow], [setRow]];
    const reader = new WorkoutSessionExportSqliteReader(database);

    const page = await reader.listCompletedSessionsPage({ limit: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor?.id).toBe(sessionId);
    expect(database.queries[1]?.parameters).toEqual([sessionId]);
  });
});
