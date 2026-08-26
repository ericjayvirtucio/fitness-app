import {
  DomainId,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { WorkoutSessionSqliteRepository } from './workout-session-sqlite-repository';

class FakeDatabase implements DatabaseConnection {
  allResults: (readonly unknown[])[] = [];
  firstResults: unknown[] = [];
  runs: { parameters: DatabaseParameters; statement: string }[] = [];
  /** Reads and writes in the order they were issued. */
  log: string[] = [];
  exec() {
    return Promise.resolve();
  }
  getVersion() {
    return Promise.resolve(9);
  }
  getFirst<TResult>(statement: string) {
    this.log.push(statement);
    return Promise.resolve(
      (this.firstResults.shift() ?? null) as TResult | null,
    );
  }
  getAll<TResult>(statement: string) {
    this.log.push(statement);
    return Promise.resolve(
      (this.allResults.shift() ?? []) as readonly TResult[],
    );
  }
  run(statement: string, parameters: DatabaseParameters = []) {
    this.log.push(statement);
    this.runs.push({ parameters, statement });
    return Promise.resolve();
  }
  runExclusive<TResult>(
    operation: (database: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

const sessionId = '550e8400-e29b-41d4-a716-446655440000';
const exerciseId = '550e8400-e29b-41d4-a716-446655440001';
const setId = '550e8400-e29b-41d4-a716-446655440002';

function id(value: string) {
  const result = DomainId.create(value);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function session() {
  const set = WorkoutSet.create({
    id: id(setId),
    position: 0,
    repsInReserve: null,
    result: RepetitionResult.valid(8),
  });
  if (!set.isSuccess) throw new Error('Invalid fixture');
  const exercise = WorkoutSessionExercise.create({
    exerciseNameSnapshot: 'Push-up',
    id: id(exerciseId),
    loggingModeSnapshot: 'bodyweight-and-repetitions',
    plannedPrescriptionSnapshot: null,
    position: 0,
    sets: [set.value],
    sourceExerciseDefinitionId: id(exerciseId),
    sourcePlannedExerciseId: null,
  });
  if (!exercise.isSuccess) throw new Error('Invalid fixture');
  const result = WorkoutSession.create({
    completedAtEpochMilliseconds: null,
    exercises: [exercise.value],
    id: id(sessionId),
    name: 'Workout',
    sourcePlannedWorkoutId: null,
    sourceWeekday: null,
    startedAtEpochMilliseconds: 1_700_000_000_000,
    startedLocalCalendarDate: '2023-11-15',
    startedUtcOffsetMinutes: 480,
    status: 'active',
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

const completedAt = 1_700_000_003_600;

function completedSession() {
  const result = WorkoutSession.create({
    ...session(),
    completedAtEpochMilliseconds: completedAt,
    status: 'completed',
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

const storedLifecycle = {
  completedAtEpochMilliseconds: completedAt,
  startedAtEpochMilliseconds: 1_700_000_000_000,
};

const deviceId = 'device-a';
const now = () => new Date('2026-08-10T00:00:00.000Z');

/**
 * A database that answers the deletion's five reads in order: the stored
 * lifecycle, the now-tombstoned parent, the two zero survivor counts, and the
 * post-write revision readback for the outbox.
 */
function deletableDatabase() {
  const database = new FakeDatabase();
  database.firstResults = [
    {
      completed_at_epoch_ms: completedAt,
      started_at_epoch_ms: 1_700_000_000_000,
    },
    { deleted_at_epoch_ms: now().getTime() },
    { count: 0 },
    { count: 0 },
    { revision: 2 },
  ];
  database.allResults = [[{ id: exerciseId }]];
  return database;
}

describe('WorkoutSessionSqliteRepository', () => {
  it('persists canonical snapshots and individual sets with bound values', async () => {
    const database = new FakeDatabase();
    await new WorkoutSessionSqliteRepository(database, deviceId, now).insert(
      session(),
    );
    expect(database.runs).toHaveLength(3);
    expect(database.runs[1]?.parameters).toContain('Push-up');
    expect(database.runs[2]?.parameters).toEqual([
      setId,
      exerciseId,
      0,
      'repetitions',
      8,
      null,
      null,
      null,
      null,
    ]);
  });

  it('hydrates an active aggregate with a fixed three-query read', async () => {
    const database = new FakeDatabase();
    database.firstResults = [
      {
        completed_at_epoch_ms: null,
        display_name: 'Workout',
        id: sessionId,
        source_planned_workout_id: null,
        source_weekday: null,
        started_at_epoch_ms: 1_700_000_000_000,
        started_local_calendar_date: '2023-11-15',
        started_utc_offset_minutes: 480,
        status: 'active',
      },
    ];
    database.allResults = [
      [
        {
          exercise_name_snapshot: 'Push-up',
          id: exerciseId,
          logging_mode_snapshot: 'bodyweight-and-repetitions',
          planned_distance_millimeters: null,
          planned_duration_seconds: null,
          planned_kind: null,
          planned_repetitions: null,
          planned_resistance_grams: null,
          planned_sets: null,
          position: 0,
          source_exercise_definition_id: exerciseId,
          source_planned_exercise_id: null,
          workout_session_id: sessionId,
        },
      ],
      [
        {
          distance_millimeters: null,
          duration_seconds: null,
          id: setId,
          position: 0,
          repetitions: 8,
          reps_in_reserve: 2,
          resistance_grams: null,
          result_kind: 'repetitions',
          workout_session_exercise_id: exerciseId,
        },
      ],
    ];
    const result = await new WorkoutSessionSqliteRepository(
      database,
      deviceId,
      now,
    ).getActive();
    expect(result).toMatchObject({
      exercises: [{ sets: [{ repsInReserve: 2, result: { repetitions: 8 } }] }],
    });
  });

  it('discards only an active aggregate', async () => {
    const database = new FakeDatabase();
    database.firstResults = [{ id: sessionId }];
    await expect(
      new WorkoutSessionSqliteRepository(database, deviceId, now).discard(
        id(sessionId),
      ),
    ).resolves.toBe(true);
    expect(database.runs.at(-1)?.statement).toContain(
      'DELETE FROM workout_session WHERE id = ? AND status = ?',
    );
    expect(database.runs.at(-1)?.parameters).toEqual([sessionId, 'active']);
  });

  it('discards sets and exercises before the session that owns them', async () => {
    const database = new FakeDatabase();
    database.firstResults = [{ id: sessionId }];
    await new WorkoutSessionSqliteRepository(database, deviceId, now).discard(
      id(sessionId),
    );
    expect(database.runs).toHaveLength(3);
    expect(database.runs[0]?.statement).toContain('DELETE FROM workout_set');
    expect(database.runs[1]?.statement).toContain(
      'DELETE FROM workout_session_exercise',
    );
    expect(database.runs[2]?.statement).toContain(
      'DELETE FROM workout_session WHERE id = ?',
    );
    expect(database.runs.map((entry) => entry.parameters)).toEqual([
      [sessionId],
      [sessionId],
      [sessionId, 'active'],
    ]);
  });

  it('replaces sets before the exercises that own them', async () => {
    const database = new FakeDatabase();
    await new WorkoutSessionSqliteRepository(database, deviceId, now).replace(
      session(),
    );
    expect(database.runs[1]?.statement).toContain('DELETE FROM workout_set');
    expect(database.runs[1]?.parameters).toEqual([sessionId]);
    expect(database.runs[2]?.statement).toContain(
      'DELETE FROM workout_session_exercise',
    );
    expect(database.runs[2]?.parameters).toEqual([sessionId]);
  });

  it('corrects a completed aggregate and bumps its parent revision', async () => {
    const database = new FakeDatabase();
    database.firstResults = [
      {
        completed_at_epoch_ms: completedAt,
        started_at_epoch_ms: 1_700_000_000_000,
      },
      { revision: 2 },
    ];
    await new WorkoutSessionSqliteRepository(
      database,
      deviceId,
      now,
    ).correctCompleted(completedSession());
    expect(database.runs[0]?.statement).toContain('DELETE FROM workout_set');
    expect(database.runs[1]?.statement).toContain(
      'DELETE FROM workout_session_exercise',
    );
    expect(database.runs[2]?.statement).toContain(
      'INSERT INTO workout_session_exercise',
    );
    expect(database.runs[3]?.statement).toContain('INSERT INTO workout_set');
    expect(database.runs[3]?.parameters).toEqual([
      setId,
      exerciseId,
      0,
      'repetitions',
      8,
      null,
      null,
      null,
      null,
    ]);
    expect(database.runs[4]?.statement).toContain('UPDATE workout_session');
    expect(database.runs[4]?.statement).toContain('revision = revision + 1');
    expect(database.runs[5]?.statement).toContain('sync_outbox');
  });

  it('refuses to correct a session that is no longer completed', async () => {
    const database = new FakeDatabase();
    database.firstResults = [null];
    await expect(
      new WorkoutSessionSqliteRepository(
        database,
        deviceId,
        now,
      ).correctCompleted(completedSession()),
    ).rejects.toBeInstanceOf(PersistenceError);
    expect(database.runs).toHaveLength(0);
  });

  it('refuses to correct a session whose lifecycle instants moved', async () => {
    const database = new FakeDatabase();
    database.firstResults = [
      {
        completed_at_epoch_ms: completedAt + 1,
        started_at_epoch_ms: 1_700_000_000_000,
      },
    ];
    await expect(
      new WorkoutSessionSqliteRepository(
        database,
        deviceId,
        now,
      ).correctCompleted(completedSession()),
    ).rejects.toBeInstanceOf(PersistenceError);
    expect(database.runs).toHaveLength(0);
  });

  it('refuses to correct an active aggregate', async () => {
    const database = new FakeDatabase();
    await expect(
      new WorkoutSessionSqliteRepository(
        database,
        deviceId,
        now,
      ).correctCompleted(session()),
    ).rejects.toBeInstanceOf(PersistenceError);
    expect(database.runs).toHaveLength(0);
  });

  it('tombstones a completed workout child-first and binds every identifier', async () => {
    const database = deletableDatabase();

    await new WorkoutSessionSqliteRepository(
      database,
      deviceId,
      now,
    ).deleteCompleted(id(sessionId), storedLifecycle);

    expect(database.runs).toHaveLength(4);
    expect(database.runs[0]?.statement).toContain('DELETE FROM workout_set');
    expect(database.runs[1]?.statement).toContain(
      'DELETE FROM workout_session_exercise',
    );
    expect(database.runs[2]?.statement).toContain('UPDATE workout_session');
    expect(database.runs[2]?.statement).toContain('deleted_at_epoch_ms = ?');
    expect(
      database.runs.some((run) =>
        run.statement.startsWith('DELETE FROM workout_session '),
      ),
    ).toBe(false);
    expect(database.runs.map((entry) => entry.parameters)).toEqual([
      [sessionId],
      [sessionId],
      [now().getTime(), now().getTime(), sessionId, 'completed'],
      ['workout_session', sessionId, 'delete', 2, now().getTime()],
    ]);
  });

  it('refuses to delete a session that is not completed', async () => {
    const database = new FakeDatabase();
    database.firstResults = [null];

    await expect(
      new WorkoutSessionSqliteRepository(
        database,
        deviceId,
        now,
      ).deleteCompleted(id(sessionId), storedLifecycle),
    ).rejects.toBeInstanceOf(PersistenceError);
    expect(database.runs).toHaveLength(0);
  });

  it('refuses to delete a session whose lifecycle instants moved', async () => {
    const database = new FakeDatabase();
    database.firstResults = [
      {
        completed_at_epoch_ms: completedAt + 1,
        started_at_epoch_ms: 1_700_000_000_000,
      },
    ];

    await expect(
      new WorkoutSessionSqliteRepository(
        database,
        deviceId,
        now,
      ).deleteCompleted(id(sessionId), storedLifecycle),
    ).rejects.toBeInstanceOf(PersistenceError);
    expect(database.runs).toHaveLength(0);
  });

  it('refuses to report a deletion that left the session row untombstoned', async () => {
    const database = deletableDatabase();
    database.firstResults[1] = { deleted_at_epoch_ms: null };

    await expect(
      new WorkoutSessionSqliteRepository(
        database,
        deviceId,
        now,
      ).deleteCompleted(id(sessionId), storedLifecycle),
    ).rejects.toBeInstanceOf(PersistenceError);
  });

  it('refuses to report a deletion that left an orphaned set behind', async () => {
    const database = deletableDatabase();
    database.firstResults[3] = { count: 1 };

    await expect(
      new WorkoutSessionSqliteRepository(
        database,
        deviceId,
        now,
      ).deleteCompleted(id(sessionId), storedLifecycle),
    ).rejects.toBeInstanceOf(PersistenceError);
  });

  it('reads the owned exercises before deleting them so orphans stay findable', async () => {
    const database = deletableDatabase();

    await new WorkoutSessionSqliteRepository(
      database,
      deviceId,
      now,
    ).deleteCompleted(id(sessionId), storedLifecycle);

    const selected = database.log.findIndex((statement) =>
      statement.includes('SELECT id FROM workout_session_exercise'),
    );
    const deleted = database.log.findIndex((statement) =>
      statement.includes('DELETE FROM workout_session_exercise'),
    );
    expect(selected).toBeGreaterThanOrEqual(0);
    expect(selected).toBeLessThan(deleted);
  });

  it('renames a matching workout with one guarded update and no child write', async () => {
    const database = new FakeDatabase();
    database.firstResults = [{ id: sessionId }];

    const renamed = await new WorkoutSessionSqliteRepository(
      database,
      deviceId,
      now,
    ).rename(id(sessionId), 'Leg Day', {
      completedAtEpochMilliseconds: null,
      startedAtEpochMilliseconds: 1_700_000_000_000,
      status: 'active',
    });

    expect(renamed).toBe(true);
    expect(database.runs).toHaveLength(1);
    expect(database.runs[0]?.statement).toContain(
      'UPDATE workout_session SET display_name = ?',
    );
    expect(database.runs[0]?.parameters).toEqual([
      'Leg Day',
      now().getTime(),
      sessionId,
      'active',
      1_700_000_000_000,
      null,
    ]);
    expect(
      database.log.some((statement) => statement.includes('workout_set')),
    ).toBe(false);
    expect(
      database.log.some((statement) =>
        statement.includes('workout_session_exercise'),
      ),
    ).toBe(false);
  });

  it('repeats the lifecycle predicate on the statement that writes the name', async () => {
    const database = new FakeDatabase();
    database.firstResults = [{ id: sessionId }];

    database.firstResults.push({ revision: 2 });
    await new WorkoutSessionSqliteRepository(database, deviceId, now).rename(
      id(sessionId),
      'Leg Day',
      {
        completedAtEpochMilliseconds: completedAt,
        startedAtEpochMilliseconds: 1_700_000_000_000,
        status: 'completed',
      },
    );

    expect(database.runs[0]?.statement).toContain('status = ?');
    expect(database.runs[0]?.statement).toContain('started_at_epoch_ms = ?');
    expect(database.runs[0]?.statement).toContain('completed_at_epoch_ms IS ?');
  });

  it('writes nothing when no row holds the expected lifecycle', async () => {
    const database = new FakeDatabase();
    database.firstResults = [null];

    const renamed = await new WorkoutSessionSqliteRepository(
      database,
      deviceId,
      now,
    ).rename(id(sessionId), 'Leg Day', {
      completedAtEpochMilliseconds: null,
      startedAtEpochMilliseconds: 1_700_000_000_000,
      status: 'active',
    });

    expect(renamed).toBe(false);
    expect(database.runs).toHaveLength(0);
  });
});
