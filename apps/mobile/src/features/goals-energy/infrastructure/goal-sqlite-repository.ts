import { GoalConfiguration, isErr } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import { queueOutboxEntry } from '../../../infrastructure/persistence/sync-outbox';
import type { GoalRepository } from '../application/goal-repository';

const tableName = 'goal_configuration';

type GoalRow = Readonly<{
  adjustment_kilocalories: number;
  goal_type: string;
}>;

export class GoalSqliteRepository implements GoalRepository {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly deviceId: string,
    private readonly now: () => Date,
  ) {}

  async get(): Promise<GoalConfiguration | null> {
    try {
      const row = await this.database.getFirst<GoalRow>(
        `SELECT goal_type, adjustment_kilocalories
         FROM goal_configuration
         WHERE singleton_id = ? AND deleted_at_epoch_ms IS NULL`,
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
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `INSERT INTO goal_configuration (
           singleton_id, goal_type, adjustment_kilocalories,
           updated_at_epoch_ms, deleted_at_epoch_ms, revision,
           originating_device_id
         ) VALUES (?, ?, ?, ?, NULL, 1, ?)
         ON CONFLICT(singleton_id) DO UPDATE SET
           goal_type = excluded.goal_type,
           adjustment_kilocalories = excluded.adjustment_kilocalories,
           updated_at_epoch_ms = excluded.updated_at_epoch_ms,
           deleted_at_epoch_ms = NULL,
           revision = goal_configuration.revision + 1`,
        [1, goal.type, goal.adjustmentKilocalories, nowEpochMs, this.deviceId],
      );
      const stored = await this.database.getFirst<{ revision: number }>(
        'SELECT revision FROM goal_configuration WHERE singleton_id = 1',
      );
      await queueOutboxEntry(
        this.database,
        tableName,
        '1',
        'upsert',
        stored?.revision ?? 1,
        nowEpochMs,
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}
