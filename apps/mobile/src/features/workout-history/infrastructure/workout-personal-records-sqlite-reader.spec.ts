import { createPlannedPrescription, DomainId } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import type { ExercisePersonalRecords } from '../application/exercise-personal-records';
import {
  SyntheticWorkoutHistory,
  syntheticExerciseIds,
  unwrap,
} from './synthetic-workout-history.spec-helper';
import { WorkoutPersonalRecordsSqliteReader } from './workout-personal-records-sqlite-reader';

/**
 * Record ordering is a property of the engine and of the data, not of the
 * orchestration, so these run against a real SQLite database with the
 * repository's own migrations.
 */

class RecordingDatabase implements DatabaseConnection {
  readonly statements: string[] = [];
  readonly parameters: DatabaseParameters[] = [];

  constructor(private readonly inner: DatabaseConnection) {}

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
  let history: SyntheticWorkoutHistory;
  let database: NodeSqliteDatabase;

  beforeEach(async () => {
    history = await SyntheticWorkoutHistory.create();
    database = history.database;
  });

  afterEach(() => {
    history.close();
  });

  function read(definitionId: string = syntheticExerciseIds.pushUp) {
    return new WorkoutPersonalRecordsSqliteReader(
      database,
    ).readExercisePersonalRecords(unwrap(DomainId.create(definitionId)));
  }

  it('reports nothing when no workout was ever completed', async () => {
    const found = await read();

    expect(found.latestExerciseNameSnapshot).toBeNull();
    expect(found.records).toEqual([]);
    expect(found.unsupportedLoggingModes).toEqual([]);
  });

  it('records the most repetitions in one set with its evidence', async () => {
    await history.store({
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
    const record = found.records[0];

    expect(found.records).toHaveLength(1);
    expect(record?.category).toBe('most-repetitions');
    expect(record?.canonicalValue).toBe(12);
    expect(record?.loggingMode).toBe('bodyweight-and-repetitions');
    expect(record?.occurrence.exerciseNameSnapshot).toBe('Push-up');
    expect(record?.occurrence.sessionNameSnapshot).toBe('Monday Push');
    expect(record?.occurrence.setPosition).toBe(0);
    expect(record?.occurrence.startedLocalCalendarDate).toBe('2026-01-01');
    expect(record?.occurrence.sessionId.value).toBe(stored[0]?.id);
  });

  it('compares single sets rather than session totals', async () => {
    await history.store({
      dayIndex: 0,
      exercises: [
        {
          loggingMode: 'repetitions',
          sets: [{ repetitions: 8 }, { repetitions: 12 }, { repetitions: 6 }],
        },
      ],
    });

    expect(recordFor(await read(), 'most-repetitions')?.canonicalValue).toBe(
      12,
    );
  });

  it('ignores sets recorded in a workout that is still active', async () => {
    await history.store(
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

    expect(recordFor(await read(), 'most-repetitions')?.canonicalValue).toBe(9);
  });

  it('ignores the planned target and records only what was performed', async () => {
    await history.store({
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

    expect(recordFor(await read(), 'most-repetitions')?.canonicalValue).toBe(7);
  });

  it('keeps records of one exercise out of another', async () => {
    await history.store({
      dayIndex: 0,
      exercises: [
        { loggingMode: 'repetitions', sets: [{ repetitions: 9 }] },
        {
          definitionId: syntheticExerciseIds.run,
          loggingMode: 'repetitions',
          name: 'Burpee',
          sets: [{ repetitions: 30 }],
        },
      ],
    });

    expect(recordFor(await read(), 'most-repetitions')?.canonicalValue).toBe(9);
    expect(
      recordFor(await read(syntheticExerciseIds.run), 'most-repetitions')
        ?.canonicalValue,
    ).toBe(30);
  });

  it('awards an equalled record to the earliest completed occurrence', async () => {
    await history.store(
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

    const record = recordFor(await read(), 'most-repetitions');

    expect(record?.canonicalValue).toBe(15);
    expect(record?.occurrence.sessionNameSnapshot).toBe('First');
    expect(record?.occurrence.startedLocalCalendarDate).toBe('2026-01-01');
  });

  it('keeps an earlier better result when a later workout is weaker', async () => {
    await history.store(
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

    const record = recordFor(await read(), 'most-repetitions');

    expect(record?.canonicalValue).toBe(20);
    expect(record?.occurrence.sessionNameSnapshot).toBe('Best');
  });

  it('merges the two repetition modes that record no load', async () => {
    await history.store(
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
    await history.store(
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
    await history.store({
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
    await history.store(
      {
        dayIndex: 0,
        exercises: [
          {
            definitionId: syntheticExerciseIds.run,
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
            definitionId: syntheticExerciseIds.run,
            loggingMode: 'distance-and-duration',
            name: 'Long Run',
            sets: [{ distanceMillimeters: 12_000_000, durationSeconds: 1_500 }],
          },
        ],
      },
    );

    const found = await read(syntheticExerciseIds.run);

    expect(
      found.records.map((record) => [record.category, record.canonicalValue]),
    ).toEqual([
      ['longest-distance-with-duration', 12_000_000],
      ['longest-duration-with-distance', 1_800],
    ]);
    expect(
      recordFor(found, 'longest-duration-with-distance')?.occurrence
        .sessionNameSnapshot,
    ).toBe('Workout 0');
  });

  it('keeps the captured name of the record occurrence after a rename', async () => {
    await history.store(
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
      recordFor(found, 'most-repetitions')?.occurrence.exerciseNameSnapshot,
    ).toBe('Push-up');
  });

  it('still reports records when no catalog definition exists', async () => {
    await history.store({
      dayIndex: 0,
      exercises: [{ loggingMode: 'repetitions', sets: [{ repetitions: 11 }] }],
    });
    const catalog = await database.getAll<{ total: number }>(
      'SELECT COUNT(*) AS total FROM exercise_catalog_item',
    );

    expect(catalog[0]?.total).toBe(0);
    expect(recordFor(await read(), 'most-repetitions')?.canonicalValue).toBe(
      11,
    );
  });

  it('selects the maximum across a long history', async () => {
    await history.store(
      ...Array.from({ length: 60 }, (_unused, index) => ({
        dayIndex: index,
        exercises: [
          {
            loggingMode: 'external-load-and-repetitions' as const,
            sets: Array.from({ length: 5 }, (_ignored, setIndex) => ({
              repetitions: 5,
              resistanceGrams: 40_000 + index * 100 + setIndex * 10,
            })),
          },
        ],
      })),
    );

    expect(recordFor(await read(), 'heaviest-load')?.canonicalValue).toBe(
      45_940,
    );
  });

  it('finds candidate sets through the source exercise history index', async () => {
    await history.store({
      dayIndex: 0,
      exercises: [{ loggingMode: 'repetitions', sets: [{ repetitions: 11 }] }],
    });
    const recording = new RecordingDatabase(database);
    await new WorkoutPersonalRecordsSqliteReader(
      recording,
    ).readExercisePersonalRecords(
      unwrap(DomainId.create(syntheticExerciseIds.pushUp)),
    );
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
    ).readExercisePersonalRecords(
      unwrap(DomainId.create(syntheticExerciseIds.pushUp)),
    );

    recording.statements.forEach((statement) => {
      expect(statement).not.toContain(syntheticExerciseIds.pushUp);
    });
    expect(recording.parameters.flat()).toContain(syntheticExerciseIds.pushUp);
  });

  it('fails safely when a stored row cannot be trusted', async () => {
    await history.store({
      dayIndex: 0,
      exercises: [{ loggingMode: 'repetitions', sets: [{ repetitions: 11 }] }],
    });
    await database.run(
      "UPDATE workout_session SET started_local_calendar_date = '2026-13-45'",
    );

    await expect(read()).rejects.toBeInstanceOf(PersistenceError);
  });
});

function recordFor(found: ExercisePersonalRecords, category: string) {
  return found.records.find((record) => record.category === category);
}
