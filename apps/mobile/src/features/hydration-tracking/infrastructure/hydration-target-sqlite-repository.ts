import { HydrationTarget, Volume, isErr } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import { queueOutboxEntry } from '../../../infrastructure/persistence/sync-outbox';
import type { HydrationTargetRepository } from '../application/hydration-target-repository';

const tableName = 'hydration_target';

type HydrationTargetRow = Readonly<{ target_milliliters: number }>;

export class HydrationTargetSqliteRepository implements HydrationTargetRepository {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly deviceId: string,
    private readonly now: () => Date,
  ) {}

  async get(): Promise<HydrationTarget | null> {
    try {
      const row = await this.database.getFirst<HydrationTargetRow>(
        `SELECT target_milliliters FROM hydration_target
         WHERE singleton_id = ? AND deleted_at_epoch_ms IS NULL`,
        [1],
      );
      if (row === null) return null;
      const volume = Volume.create(row.target_milliliters, 'milliliter');
      if (isErr(volume)) throw new PersistenceError('operation-failed');
      const target = HydrationTarget.create(volume.value);
      if (isErr(target)) throw new PersistenceError('operation-failed');
      return target.value;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async save(target: HydrationTarget): Promise<void> {
    try {
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `INSERT INTO hydration_target (
           singleton_id, target_milliliters, updated_at_epoch_ms,
           deleted_at_epoch_ms, revision, originating_device_id
         ) VALUES (?, ?, ?, NULL, 1, ?)
         ON CONFLICT(singleton_id) DO UPDATE SET
           target_milliliters = excluded.target_milliliters,
           updated_at_epoch_ms = excluded.updated_at_epoch_ms,
           deleted_at_epoch_ms = NULL,
           revision = hydration_target.revision + 1`,
        [1, target.volume.milliliters, nowEpochMs, this.deviceId],
      );
      const stored = await this.database.getFirst<{ revision: number }>(
        'SELECT revision FROM hydration_target WHERE singleton_id = 1',
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
