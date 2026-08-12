import {
  createPlannedPrescription,
  createWorkoutResult,
  DomainId,
  Duration,
  Length,
  Mass,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  type ExerciseLoggingMode,
  type PlannedPrescription,
  type Result,
  type WorkoutResult,
  type WorkoutSessionStatus,
} from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { initializeDatabase } from '../../../infrastructure/persistence/database-initializer';
import { migrations } from '../../../infrastructure/persistence/migrations';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { WorkoutSessionSqliteRepository } from '../../workout-session/infrastructure/workout-session-sqlite-repository';
import { WorkoutPersonalRecordsSqliteReader } from './workout-personal-records-sqlite-reader';

/**
 * Personal-record ordering is a property of the engine and of the data, not of
 * the orchestration, so these run against a real SQLite database with the
 * repository's own migrations and the repository the application writes
 * sessions through. Nothing here reaches the Exercise Catalog, because history
 * is the only authority a record may use.
 */

const pushUpId = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';

type SetInput = Readonly<{
  distanceMillimeters?: number;
  durationSeconds?: number;
  repetitions?: number;
  resistanceGrams?: number;
}>;

type ExerciseInput = Readonly<{
  definitionId?: string;
  loggingMode: ExerciseLoggingMode;
  name?: string;
  planned?: PlannedPrescription;
  sets: readonly SetInput[];
}>;

type SessionInput = Readonly<{
  dayIndex: number;
  exercises: readonly ExerciseInput[];
  name?: string;
  status?: WorkoutSessionStatus;
}>;

class RecordingDatabase implements DatabaseConnection {
  readonly statements: string[] = [];
  readonly parameters: DatabaseParameters[] = [];

  constructor(private readonly inner: NodeSqliteDatabase) {}

  exec(statement: string) {
    return this.inner.exec(statement);
  }
  getAll<TResult>(statement: string, parameters: DatabaseParameters = []) {
    this.statements.push(statement);
    this.parameters.push(parameters);
    return this.inner.getAll<TResult>(statement, parameters);
  }
  getFirst<TResult>(statement: string, parameters: DatabaseParameters = []) {
    return this.inner.getFirst<TResult>(statement, parameters);
  }
  getVersion() {
    return this.inner.getVersion();
  }
  run(statement: string, parameters: DatabaseParameters = []) {
    return this.inner.run(statement, parameters);
  }
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ) {
    return this.inner.runExclusive(operation);
  }
}

describe('WorkoutPersonalRecordsSqliteReader', () => {
  let database: NodeSqliteDatabase;
  let identifierCount = 0;

  beforeEach(async () => {
    identifierCount = 0;
    database = new NodeSqliteDatabase();
    await initializeDatabase(database, migrations);
  });

  afterEach(() => {
    database.close();
  });

  function nextIdentifier(): string {
    identifierCount += 1;
    return `00000000-0000-4000-8000-${String(identifierCount).padStart(12, '0')}`;
  }

  async function store(...sessions: readonly SessionInput[]): Promise<void> {
    const repository = new WorkoutSessionSqliteRepository(database);
    for (const session of sessions) {
      await repository.insert(buildSession(session));
    }
  }

  function buildSession(input: SessionInput): WorkoutSession {
    const startedAt = Date.UTC(2026, 0, 1 + input.dayIndex, 9);
    const status = input.status ?? 'completed';
    return unwrap(
      WorkoutSession.create({
        completedAtEpochMilliseconds:
          status === 'completed' ? startedAt + 3_600_000 : null,
        exercises: input.exercises.map((exercise, position) =>
          buildExercise(exercise, position),
        ),
        id: unwrap(DomainId.create(nextIdentifier())),
        name: input.name ?? `Workout ${input.dayIndex}`,
        sourcePlannedWorkoutId: null,
        sourceWeekday: null,
        startedAtEpochMilliseconds: startedAt,
        startedLocalCalendarDate: localDate(startedAt),
        startedUtcOffsetMinutes: 0,
        status,
      }),
    );
  }

  function buildExercise(
    input: ExerciseInput,
    position: number,
  ): WorkoutSessionExercise {
    return unwrap(
      WorkoutSessionExercise.create({
        exerciseNameSnapshot: input.name ?? 'Push-up',
        id: unwrap(DomainId.create(nextIdentifier())),
        loggingModeSnapshot: input.loggingMode,
        plannedPrescriptionSnapshot: input.planned ?? null,
        position,
        sets: input.sets.map((set, setPosition) =>
          unwrap(
            WorkoutSet.create({
              id: unwrap(DomainId.create(nextIdentifier())),
              position: setPosition,
              result: buildResult(input.loggingMode, set),
            }),
          ),
        ),
        sourceExerciseDefinitionId: unwrap(
          DomainId.create(input.definitionId ?? pushUpId),
        ),
        sourcePlannedExerciseId: null,
      }),
    );
  }

  function buildResult(
    loggingMode: ExerciseLoggingMode,
    set: SetInput,
  ): WorkoutResult {
    return unwrap(
      createWorkoutResult({
        distance:
          set.distanceMillimeters === undefined
            ? undefined
            : unwrap(Length.create(set.distanceMillimeters, 'millimeter')),
        duration:
          set.durationSeconds === undefined
            ? undefined
            : unwrap(Duration.create(set.durationSeconds, 'second')),
        loggingMode,
        repetitions: set.repetitions,
        resistance:
          set.resistanceGrams === undefined
            ? undefined
            : unwrap(Mass.create(set.resistanceGrams, 'gram')),
      }),
    );
  }

  function read(definitionId = pushUpId) {
    return new WorkoutPersonalRecordsSqliteReader(
      database,
    ).readExercisePersonalRecords(unwrap(DomainId.create(definitionId)));
  }

  it('reports nothing when no workout was ever completed', async () => {
    const records = await read();

    expect(records.latestExerciseNameSnapshot).toBeNull();
    expect(records.records).toEqual([]);
    expect(records.unsupportedLoggingModes).toEqual([]);
  });

  it('records the most repetitions in one set with its evidence', async () => {
    await store({
      dayIndex: 0,
      exercises: [
        {
          loggingMode: 'bodyweight-and-repetitions',
          sets: [{ repetitions: 12 }],
        },
      ],
      name: 'Monday Push',
    });

    const found = await read();
    const stored = await database.getAll<{ id: string }>(
      'SELECT id FROM workout_session',
    );

    expect(found.records).toHaveLength(1);
    expect(found.records[0]?.category).toBe('most-repetitions');
    expect(found.records[0]?.canonicalValue).toBe(12);
    expect(found.records[0]?.loggingMode).toBe('bodyweight-and-repetitions');
    expect(found.records[0]?.occurrence.exerciseNameSnapshot).toBe('Push-up');
    expect(found.records[0]?.occurrence.sessionNameSnapshot).toBe(
      'Monday Push',
    );
    expect(found.records[0]?.occurrence.setPosition).toBe(0);
    expect(found.records[0]?.occurrence.startedLocalCalendarDate).toBe(
      '2026-01-01',
    );
    expect(found.records[0]?.occurrence.sessionId.value).toBe(stored[0]?.id);
  });

  it('compares single sets rather than session totals', async () => {
    await store({
      dayIndex: 0,
      exercises: [
        {
          loggingMode: 'repetitions',
          sets: [{ repetitions: 8 }, { repetitions: 12 }, { repetitions: 6 }],
        },
      ],
    });

    expect(records(await read(), 'most-repetitions')?.canonicalValue).toBe(12);
  });

  it('ignores sets recorded in a workout that is still active', async () => {
    await store(
      {
        dayIndex: 0,
        exercises: [{ loggingMode: 'repetitions', sets: [{ repetitions: 9 }] }],
      },
      {
        dayIndex: 1,
        exercises: [
          { loggingMode: 'repetitions', sets: [{ repetitions: 40 }] },
        ],
        status: 'active',
      },
    );

    expect(records(await read(), 'most-repetitions')?.canonicalValue).toBe(9);
  });

  it('ignores the planned target and records only what was performed', async () => {
    await store({
      dayIndex: 0,
      exercises: [
        {
          loggingMode: 'repetitions',
          planned: unwrap(
            createPlannedPrescription({
              loggingMode: 'repetitions',
              repetitions: 100,
              sets: 5,
            }),
          ),
          sets: [{ repetitions: 7 }],
        },
      ],
    });

    expect(records(await read(), 'most-repetitions')?.canonicalValue).toBe(7);
  });

  it('keeps records of one exercise out of another', async () => {
    await store({
      dayIndex: 0,
      exercises: [
        { loggingMode: 'repetitions', sets: [{ repetitions: 9 }] },
        {
          definitionId: runId,
          loggingMode: 'repetitions',
          name: 'Burpee',
          sets: [{ repetitions: 30 }],
        },
      ],
    });

    expect(records(await read(), 'most-repetitions')?.canonicalValue).toBe(9);
    expect(records(await read(runId), 'most-repetitions')?.canonicalValue).toBe(
      30,
    );
  });

  it('awards an equalled record to the earliest completed occurrence', async () => {
    await store(
      {
        dayIndex: 0,
        exercises: [
          { loggingMode: 'repetitions', sets: [{ repetitions: 15 }] },
        ],
        name: 'First',
      },
      {
        dayIndex: 5,
        exercises: [
          { loggingMode: 'repetitions', sets: [{ repetitions: 15 }] },
        ],
        name: 'Equalled',
      },
    );

    const record = records(await read(), 'most-repetitions');

    expect(record?.canonicalValue).toBe(15);
    expect(record?.occurrence.sessionNameSnapshot).toBe('First');
    expect(record?.occurrence.startedLocalCalendarDate).toBe('2026-01-01');
  });

  it('keeps an earlier better result when a later workout is weaker', async () => {
    await store(
      {
        dayIndex: 0,
        exercises: [
          { loggingMode: 'repetitions', sets: [{ repetitions: 20 }] },
        ],
        name: 'Best',
      },
      {
        dayIndex: 3,
        exercises: [{ loggingMode: 'repetitions', sets: [{ repetitions: 5 }] }],
        name: 'Lighter',
      },
    );

    const record = records(await read(), 'most-repetitions');

    expect(record?.canonicalValue).toBe(20);
    expect(record?.occurrence.sessionNameSnapshot).toBe('Best');
  });

  it('merges the two repetition modes that record no load', async () => {
    await store(
      {
        dayIndex: 0,
        exercises: [
          { loggingMode: 'repetitions', sets: [{ repetitions: 10 }] },
        ],
      },
      {
        dayIndex: 1,
        exercises: [
          {
            loggingMode: 'bodyweight-and-repetitions',
            sets: [{ repetitions: 18 }],
          },
        ],
      },
    );

    const found = await read();

    expect(found.records).toHaveLength(1);
    expect(found.records[0]?.canonicalValue).toBe(18);
    expect(found.records[0]?.loggingMode).toBe('bodyweight-and-repetitions');
  });

  it('separates load from added load after a logging mode change', async () => {
    await store(
      {
        dayIndex: 0,
        exercises: [
          {
            loggingMode: 'external-load-and-repetitions',
            sets: [{ repetitions: 5, resistanceGrams: 60_000 }],
          },
        ],
      },
      {
        dayIndex: 1,
        exercises: [
          {
            loggingMode: 'bodyweight-plus-load-and-repetitions',
            sets: [{ repetitions: 5, resistanceGrams: 20_000 }],
          },
        ],
      },
    );

    const found = await read();

    expect(
      found.records.map((record) => [record.category, record.canonicalValue]),
    ).toEqual([
      ['heaviest-load', 60_000],
      ['heaviest-added-load', 20_000],
    ]);
  });

  it('claims no record for assisted work and says which mode it was', async () => {
    await store({
      dayIndex: 0,
      exercises: [
        {
          loggingMode: 'assistance-and-repetitions',
          name: 'Assisted Pull-up',
          sets: [{ repetitions: 8, resistanceGrams: 30_000 }],
        },
      ],
    });

    const found = await read();

    expect(found.records).toEqual([]);
    expect(found.unsupportedLoggingModes).toEqual([
      'assistance-and-repetitions',
    ]);
    expect(found.latestExerciseNameSnapshot).toBe('Assisted Pull-up');
  });

  it('records both stored dimensions of a distance and duration set', async () => {
    await store(
      {
        dayIndex: 0,
        exercises: [
          {
            definitionId: runId,
            loggingMode: 'distance-and-duration',
            name: 'Easy Run',
            sets: [{ distanceMillimeters: 5_000_000, durationSeconds: 1_800 }],
          },
        ],
      },
      {
        dayIndex: 1,
        exercises: [
          {
            definitionId: runId,
            loggingMode: 'distance-and-duration',
            name: 'Long Run',
            sets: [{ distanceMillimeters: 12_000_000, durationSeconds: 1_500 }],
          },
        ],
      },
    );

    const found = await read(runId);

    expect(
      found.records.map((record) => [record.category, record.canonicalValue]),
    ).toEqual([
      ['longest-distance-with-duration', 12_000_000],
      ['longest-duration-with-distance', 1_800],
    ]);
    expect(
      records(found, 'longest-duration-with-distance')?.occurrence
        .sessionNameSnapshot,
    ).toBe('Workout 0');
  });

  it('keeps the captured name of the record occurrence after a rename', async () => {
    await store(
      {
        dayIndex: 0,
        exercises: [
          {
            loggingMode: 'repetitions',
            name: 'Push-up',
            sets: [{ repetitions: 25 }],
          },
        ],
      },
      {
        dayIndex: 4,
        exercises: [
          {
            loggingMode: 'repetitions',
            name: 'Wide Push-up',
            sets: [{ repetitions: 6 }],
          },
        ],
      },
    );

    const found = await read();

    expect(found.latestExerciseNameSnapshot).toBe('Wide Push-up');
    expect(
      records(found, 'most-repetitions')?.occurrence.exerciseNameSnapshot,
    ).toBe('Push-up');
  });

  it('still reports records when no catalog definition exists', async () => {
    await store({
      dayIndex: 0,
      exercises: [{ loggingMode: 'repetitions', sets: [{ repetitions: 11 }] }],
    });
    const remaining = await database.getAll<{ total: number }>(
      'SELECT COUNT(*) AS total FROM exercise_catalog_item',
    );

    expect(remaining[0]?.total).toBe(0);
    expect(records(await read(), 'most-repetitions')?.canonicalValue).toBe(11);
  });

  it('selects the maximum across a long history', async () => {
    const sessions = Array.from({ length: 60 }, (_, index) => ({
      dayIndex: index,
      exercises: [
        {
          loggingMode: 'external-load-and-repetitions' as const,
          sets: Array.from({ length: 5 }, (_unused, setIndex) => ({
            repetitions: 5,
            resistanceGrams: 40_000 + index * 100 + setIndex * 10,
          })),
        },
      ],
    }));
    await store(...sessions);

    expect(records(await read(), 'heaviest-load')?.canonicalValue).toBe(45_940);
  });

  it('finds candidate sets through the source exercise history index', async () => {
    await store({
      dayIndex: 0,
      exercises: [{ loggingMode: 'repetitions', sets: [{ repetitions: 11 }] }],
    });
    const recording = new RecordingDatabase(database);
    await new WorkoutPersonalRecordsSqliteReader(
      recording,
    ).readExercisePersonalRecords(unwrap(DomainId.create(pushUpId)));
    const plan = await database.getAll<{ detail: string }>(
      `EXPLAIN QUERY PLAN ${recording.statements[0] ?? ''}`,
      recording.parameters[0] ?? [],
    );
    const details = plan.map((step) => step.detail).join('\n');

    expect(details).toContain('workout_session_exercise_source_history');
    expect(details).not.toMatch(/SCAN workout_session_exercise\b/);
  });

  it('binds the exercise identifier instead of writing it into the statement', async () => {
    const recording = new RecordingDatabase(database);

    await new WorkoutPersonalRecordsSqliteReader(
      recording,
    ).readExercisePersonalRecords(unwrap(DomainId.create(pushUpId)));

    recording.statements.forEach((statement) => {
      expect(statement).not.toContain(pushUpId);
    });
    expect(recording.parameters.flat()).toContain(pushUpId);
  });

  it('fails safely when a stored row cannot be trusted', async () => {
    await store({
      dayIndex: 0,
      exercises: [{ loggingMode: 'repetitions', sets: [{ repetitions: 11 }] }],
    });
    await database.run(
      "UPDATE workout_session SET started_local_calendar_date = '2026-13-45'",
    );

    await expect(read()).rejects.toBeInstanceOf(PersistenceError);
  });
});

function records(
  found: Awaited<
    ReturnType<
      WorkoutPersonalRecordsSqliteReader['readExercisePersonalRecords']
    >
  >,
  category: string,
) {
  return found.records.find((record) => record.category === category);
}

function localDate(epochMilliseconds: number): string {
  const value = new Date(epochMilliseconds);
  const year = String(value.getUTCFullYear()).padStart(4, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess)
    throw new Error('Synthetic workout history is invalid.');
  return result.value;
}
