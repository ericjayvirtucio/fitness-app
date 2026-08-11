import { BodyWeightDataEraser } from '../../features/body-measurement-history/infrastructure/body-weight-data-eraser';
import { ExerciseCatalogDataEraser } from '../../features/exercise-catalog/infrastructure/exercise-catalog-data-eraser';
import { GoalDataEraser } from '../../features/goals-energy/infrastructure/goal-data-eraser';
import { HydrationDataEraser } from '../../features/hydration-tracking/infrastructure/hydration-data-eraser';
import { NutritionDataEraser } from '../../features/nutrition-logging/infrastructure/nutrition-data-eraser';
import { PersonalProfileDataEraser } from '../../features/personal-profile/infrastructure/personal-profile-data-eraser';
import { WorkoutPlannerDataEraser } from '../../features/workout-planner/infrastructure/workout-planner-data-eraser';
import { WorkoutSessionDataEraser } from '../../features/workout-session/infrastructure/workout-session-data-eraser';
import type { DatabaseConnection } from './database';
import { PersistenceError } from './persistence-error';
import { deleteAllRows } from './stored-record-erasure';

/**
 * The erasers are exercised together for the same reason the probes are: the
 * behavior that matters is that every table a user can fill is owned by exactly
 * one capability, including the children that no probe has to name because they
 * cannot outlive their parent.
 */

class FakeDatabase implements DatabaseConnection {
  readonly statements: string[] = [];

  exec(): Promise<void> {
    return Promise.resolve();
  }
  getFirst<TResult>(): Promise<TResult | null> {
    return Promise.resolve(null);
  }
  getAll<TResult>(): Promise<readonly TResult[]> {
    return Promise.resolve([]);
  }
  getVersion(): Promise<number> {
    return Promise.resolve(11);
  }
  run(statement: string): Promise<void> {
    this.statements.push(statement);
    return Promise.resolve();
  }
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

/**
 * Composition order: a referencing row is always erased before what it
 * references, so no step depends on a cascade or a restricted foreign key.
 */
const erasers = [
  (database: DatabaseConnection) => new WorkoutSessionDataEraser(database),
  (database: DatabaseConnection) => new WorkoutPlannerDataEraser(database),
  (database: DatabaseConnection) => new ExerciseCatalogDataEraser(database),
  (database: DatabaseConnection) => new NutritionDataEraser(database),
  (database: DatabaseConnection) => new HydrationDataEraser(database),
  (database: DatabaseConnection) => new BodyWeightDataEraser(database),
  (database: DatabaseConnection) => new GoalDataEraser(database),
  (database: DatabaseConnection) => new PersonalProfileDataEraser(database),
];

async function eraseEverything(database: FakeDatabase): Promise<void> {
  for (const create of erasers) {
    await create(database).eraseStoredRecords();
  }
}

describe('capability data erasers', () => {
  it('delete every user-owned table, children before their parents', async () => {
    const database = new FakeDatabase();

    await eraseEverything(database);

    expect(database.statements).toEqual([
      'DELETE FROM workout_set',
      'DELETE FROM workout_session_exercise',
      'DELETE FROM workout_session',
      'DELETE FROM planned_exercise',
      'DELETE FROM planned_workout',
      'DELETE FROM exercise_catalog_item',
      'DELETE FROM nutrition_consumption_entry',
      'DELETE FROM nutrition_catalog_item',
      'DELETE FROM hydration_entry',
      'DELETE FROM hydration_target',
      'DELETE FROM body_weight_entry',
      'DELETE FROM goal_configuration',
      'DELETE FROM personal_profile',
    ]);
  });

  it('never relies on a cascade to remove a workout session child', async () => {
    const database = new FakeDatabase();

    await new WorkoutSessionDataEraser(database).eraseStoredRecords();

    expect(database.statements).toContain('DELETE FROM workout_set');
    expect(database.statements).toContain(
      'DELETE FROM workout_session_exercise',
    );
  });

  it('never relies on a cascade to remove a planned exercise', async () => {
    const database = new FakeDatabase();

    await new WorkoutPlannerDataEraser(database).eraseStoredRecords();

    expect(database.statements[0]).toBe('DELETE FROM planned_exercise');
  });

  it('erases each table exactly once across the whole installation', async () => {
    const database = new FakeDatabase();

    await eraseEverything(database);

    expect(new Set(database.statements).size).toBe(database.statements.length);
  });

  it('reads no stored value while deleting', async () => {
    const database = new FakeDatabase();

    await eraseEverything(database);

    expect(
      database.statements.every((statement) =>
        statement.startsWith('DELETE FROM '),
      ),
    ).toBe(true);
  });

  it('translates a database failure into a persistence error', async () => {
    class FailingDatabase extends FakeDatabase {
      override run(): Promise<void> {
        return Promise.reject(new Error('disk failure'));
      }
    }

    await expect(
      deleteAllRows(new FailingDatabase(), ['personal_profile']),
    ).rejects.toThrow(PersistenceError);
  });

  it('stops at the failing table rather than continuing', async () => {
    class FailingDatabase extends FakeDatabase {
      override run(statement: string): Promise<void> {
        this.statements.push(statement);
        return statement.includes('workout_session_exercise')
          ? Promise.reject(new Error('disk failure'))
          : Promise.resolve();
      }
    }
    const database = new FailingDatabase();

    await expect(
      new WorkoutSessionDataEraser(database).eraseStoredRecords(),
    ).rejects.toThrow(PersistenceError);
    expect(database.statements).not.toContain('DELETE FROM workout_session');
  });
});
