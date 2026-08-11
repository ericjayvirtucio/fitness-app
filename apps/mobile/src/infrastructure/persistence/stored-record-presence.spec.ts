import { BodyWeightStoredDataProbe } from '../../features/body-measurement-history/infrastructure/body-weight-stored-data-probe';
import { ExerciseCatalogStoredDataProbe } from '../../features/exercise-catalog/infrastructure/exercise-catalog-stored-data-probe';
import { GoalStoredDataProbe } from '../../features/goals-energy/infrastructure/goal-stored-data-probe';
import { HydrationStoredDataProbe } from '../../features/hydration-tracking/infrastructure/hydration-stored-data-probe';
import { NutritionStoredDataProbe } from '../../features/nutrition-logging/infrastructure/nutrition-stored-data-probe';
import { PersonalProfileStoredDataProbe } from '../../features/personal-profile/infrastructure/personal-profile-stored-data-probe';
import { WorkoutPlannerStoredDataProbe } from '../../features/workout-planner/infrastructure/workout-planner-stored-data-probe';
import { WorkoutSessionStoredDataProbe } from '../../features/workout-session/infrastructure/workout-session-stored-data-probe';
import type { DatabaseConnection } from './database';
import { PersistenceError } from './persistence-error';
import { hasStoredRows } from './stored-record-presence';

/**
 * The probes are exercised together on purpose. The behavior that matters is
 * not that one class queries one table; it is that "this installation is empty"
 * covers every table a user can fill, which no single probe can assert.
 */

class FakeDatabase implements DatabaseConnection {
  readonly statements: string[] = [];

  constructor(private readonly populatedTables: readonly string[] = []) {}

  exec(): Promise<void> {
    return Promise.resolve();
  }
  getFirst<TResult>(statement: string): Promise<TResult | null> {
    this.statements.push(statement);
    const isPopulated = this.populatedTables.some((table) =>
      statement.includes(` FROM ${table} `),
    );
    return Promise.resolve(isPopulated ? ({ present: 1 } as TResult) : null);
  }
  getAll<TResult>(): Promise<readonly TResult[]> {
    return Promise.resolve([]);
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

const probes = [
  {
    create: (db: DatabaseConnection) => new PersonalProfileStoredDataProbe(db),
    tables: ['personal_profile'],
  },
  {
    create: (db: DatabaseConnection) => new GoalStoredDataProbe(db),
    tables: ['goal_configuration'],
  },
  {
    create: (db: DatabaseConnection) => new NutritionStoredDataProbe(db),
    tables: ['nutrition_consumption_entry', 'nutrition_catalog_item'],
  },
  {
    create: (db: DatabaseConnection) => new HydrationStoredDataProbe(db),
    tables: ['hydration_entry', 'hydration_target'],
  },
  {
    create: (db: DatabaseConnection) => new ExerciseCatalogStoredDataProbe(db),
    tables: ['exercise_catalog_item'],
  },
  {
    create: (db: DatabaseConnection) => new WorkoutPlannerStoredDataProbe(db),
    tables: ['planned_workout'],
  },
  {
    create: (db: DatabaseConnection) => new WorkoutSessionStoredDataProbe(db),
    tables: ['workout_session'],
  },
  {
    create: (db: DatabaseConnection) => new BodyWeightStoredDataProbe(db),
    tables: ['body_weight_entry'],
  },
] as const;

/**
 * Every table a user can fill. Cascade-deleted children are covered by their
 * parent: planned_exercise by planned_workout, and workout_session_exercise and
 * workout_set by workout_session.
 */
const userOwnedTables = [
  'body_weight_entry',
  'exercise_catalog_item',
  'goal_configuration',
  'hydration_entry',
  'hydration_target',
  'nutrition_catalog_item',
  'nutrition_consumption_entry',
  'personal_profile',
  'planned_workout',
  'workout_session',
];

describe('stored data probes', () => {
  it('cover every table a user can fill', () => {
    const probed = probes.flatMap((probe) => [...probe.tables]).sort();

    expect(probed).toEqual(userOwnedTables);
  });

  it('report an empty installation when no capability holds a record', async () => {
    for (const probe of probes) {
      const database = new FakeDatabase();

      await expect(probe.create(database).hasStoredRecords()).resolves.toBe(
        false,
      );
    }
  });

  it.each(userOwnedTables)('reports stored data in %s', async (table) => {
    const database = new FakeDatabase([table]);
    const owner = probes.find((probe) =>
      probe.tables.some((candidate) => candidate === table),
    );

    await expect(owner?.create(database).hasStoredRecords()).resolves.toBe(
      true,
    );
  });

  it('stops at the first populated table', async () => {
    const database = new FakeDatabase(['nutrition_consumption_entry']);

    await new NutritionStoredDataProbe(database).hasStoredRecords();

    expect(database.statements).toHaveLength(1);
  });

  it('never reads a stored value to decide emptiness', async () => {
    const database = new FakeDatabase();

    await new BodyWeightStoredDataProbe(database).hasStoredRecords();

    expect(database.statements[0]).toBe(
      'SELECT 1 AS present FROM body_weight_entry LIMIT 1',
    );
  });

  it('translates a database failure into a persistence error', async () => {
    class FailingDatabase extends FakeDatabase {
      override getFirst<TResult>(): Promise<TResult | null> {
        return Promise.reject(new Error('disk failure'));
      }
    }

    await expect(
      hasStoredRows(new FailingDatabase(), ['personal_profile']),
    ).rejects.toThrow(PersistenceError);
  });
});
