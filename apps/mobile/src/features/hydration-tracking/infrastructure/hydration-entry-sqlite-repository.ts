import type { DomainId, HydrationEntry } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type { HydrationEntryRepository } from '../application/hydration-entry-repository';
import {
  hydrationEntryColumns,
  mapHydrationEntryRow,
  type HydrationEntryRow,
} from './hydration-row-mapping';

export class HydrationEntrySqliteRepository implements HydrationEntryRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getById(id: DomainId): Promise<HydrationEntry | null> {
    try {
      const row = await this.database.getFirst<HydrationEntryRow>(
        `SELECT ${hydrationEntryColumns} FROM hydration_entry WHERE id = ?`,
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
         WHERE local_calendar_date = ?
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
      await this.database.run(
        `INSERT INTO hydration_entry (
          id, fluid_type, volume_milliliters, description,
          occurred_at_epoch_ms, local_calendar_date, utc_offset_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        toParameters(entry),
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async update(entry: HydrationEntry): Promise<boolean> {
    try {
      if ((await this.getById(entry.id)) === null) return false;
      await this.database.run(
        `UPDATE hydration_entry SET fluid_type = ?, volume_milliliters = ?,
          description = ?, occurred_at_epoch_ms = ?, local_calendar_date = ?,
          utc_offset_minutes = ? WHERE id = ?`,
        [...toParameters(entry).slice(1), entry.id.value],
      );
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async delete(id: DomainId): Promise<boolean> {
    try {
      if ((await this.getById(id)) === null) return false;
      await this.database.run('DELETE FROM hydration_entry WHERE id = ?', [
        id.value,
      ]);
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
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
