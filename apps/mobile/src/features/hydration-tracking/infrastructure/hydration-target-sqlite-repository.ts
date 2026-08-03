import { HydrationTarget, Volume, isErr } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import type { HydrationTargetRepository } from '../application/hydration-target-repository';

type HydrationTargetRow = Readonly<{ target_milliliters: number }>;

export class HydrationTargetSqliteRepository implements HydrationTargetRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async get(): Promise<HydrationTarget | null> {
    try {
      const row = await this.database.getFirst<HydrationTargetRow>(
        'SELECT target_milliliters FROM hydration_target WHERE singleton_id = ?',
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
      await this.database.run(
        `INSERT INTO hydration_target (singleton_id, target_milliliters)
         VALUES (?, ?)
         ON CONFLICT(singleton_id) DO UPDATE SET
           target_milliliters = excluded.target_milliliters`,
        [1, target.volume.milliliters],
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}
