import { GoalConfiguration, isErr } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import type { GoalRepository } from '../application/goal-repository';

type GoalRow = Readonly<{
  adjustment_kilocalories: number;
  goal_type: string;
}>;

export class GoalSqliteRepository implements GoalRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async get(): Promise<GoalConfiguration | null> {
    try {
      const row = await this.database.getFirst<GoalRow>(
        `SELECT goal_type, adjustment_kilocalories
         FROM goal_configuration WHERE singleton_id = ?`,
        [1],
      );
      if (row === null) return null;
      const goal = GoalConfiguration.create(
        row.goal_type,
        row.adjustment_kilocalories,
      );
      if (isErr(goal)) throw new PersistenceError('operation-failed');
      return goal.value;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async save(goal: GoalConfiguration): Promise<void> {
    try {
      await this.database.run(
        `INSERT INTO goal_configuration (
           singleton_id, goal_type, adjustment_kilocalories
         ) VALUES (?, ?, ?)
         ON CONFLICT(singleton_id) DO UPDATE SET
           goal_type = excluded.goal_type,
           adjustment_kilocalories = excluded.adjustment_kilocalories`,
        [1, goal.type, goal.adjustmentKilocalories],
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}
