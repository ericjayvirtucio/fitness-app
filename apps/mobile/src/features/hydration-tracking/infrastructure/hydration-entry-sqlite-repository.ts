import type { DomainId, HydrationEntry } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { queueOutboxEntry } from '../../../infrastructure/persistence/sync-outbox';
import type { HydrationEntryRepository } from '../application/hydration-entry-repository';
import {
  hydrationEntryColumns,
  mapHydrationEntryRow,
  type HydrationEntryRow,
} from './hydration-row-mapping';

const tableName = 'hydration_entry';

export class HydrationEntrySqliteRepository implements HydrationEntryRepository {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly deviceId: string,
    private readonly now: () => Date,
  ) {}

  async getById(id: DomainId): Promise<HydrationEntry | null> {
    try {
      const row = await this.database.getFirst<HydrationEntryRow>(
        `SELECT ${hydrationEntryColumns} FROM hydration_entry
         WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
        [id.value],
      );
      return row === null ? null : mapHydrationEntryRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async listByLocalDate(date: string): Promise<readonly HydrationEntry[]> {
    try {
      const rows = await this.database.getAll<HydrationEntryRow>(
        `SELECT ${hydrationEntryColumns} FROM hydration_entry
         WHERE local_calendar_date = ? AND deleted_at_epoch_ms IS NULL
         ORDER BY occurred_at_epoch_ms DESC, id ASC`,
        [date],
      );
      return Object.freeze(rows.map(mapHydrationEntryRow));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async insert(entry: HydrationEntry): Promise<void> {
    try {
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `INSERT INTO hydration_entry (
          id, fluid_type, volume_milliliters, description,
          occurred_at_epoch_ms, local_calendar_date, utc_offset_minutes,
          updated_at_epoch_ms, deleted_at_epoch_ms, revision,
          originating_device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)`,
        [...toParameters(entry), nowEpochMs, this.deviceId],
      );
      await queueOutboxEntry(
        this.database,
        tableName,
        entry.id.value,
        'upsert',
        1,
        nowEpochMs,
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async update(entry: HydrationEntry): Promise<boolean> {
    try {
      if ((await this.getById(entry.id)) === null) return false;
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `UPDATE hydration_entry SET fluid_type = ?, volume_milliliters = ?,
          description = ?, occurred_at_epoch_ms = ?, local_calendar_date = ?,
          utc_offset_minutes = ?, updated_at_epoch_ms = ?, revision = revision + 1
         WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
        [...toParameters(entry).slice(1), nowEpochMs, entry.id.value],
      );
      await this.queueRevision(entry.id.value, 'upsert', nowEpochMs);
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async delete(id: DomainId): Promise<boolean> {
    try {
      if ((await this.getById(id)) === null) return false;
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `UPDATE hydration_entry SET deleted_at_epoch_ms = ?,
          updated_at_epoch_ms = ?, revision = revision + 1
         WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
        [nowEpochMs, nowEpochMs, id.value],
      );
      await this.queueRevision(id.value, 'delete', nowEpochMs);
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  private async queueRevision(
    id: string,
    operation: 'delete' | 'upsert',
    nowEpochMs: number,
  ): Promise<void> {
    const stored = await this.database.getFirst<{ revision: number }>(
      'SELECT revision FROM hydration_entry WHERE id = ?',
      [id],
    );
    await queueOutboxEntry(
      this.database,
      tableName,
      id,
      operation,
      stored?.revision ?? 1,
      nowEpochMs,
    );
  }
}

function toParameters(entry: HydrationEntry) {
  return [
    entry.id.value,
    entry.fluidType,
    entry.volume.milliliters,
    entry.description,
    entry.occurredAtEpochMilliseconds,
    entry.localCalendarDate,
    entry.utcOffsetMinutes,
  ] as const;
}
