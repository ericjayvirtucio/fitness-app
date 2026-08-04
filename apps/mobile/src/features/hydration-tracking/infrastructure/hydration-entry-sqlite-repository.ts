import { DomainId, HydrationEntry, Volume, isErr } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import type { HydrationEntryRepository } from '../application/hydration-entry-repository';

type HydrationEntryRow = Readonly<{
  description: string | null;
  fluid_type: string;
  id: string;
  local_calendar_date: string;
  occurred_at_epoch_ms: number;
  utc_offset_minutes: number;
  volume_milliliters: number;
}>;

const selectedColumns = `id, fluid_type, volume_milliliters, description,
  occurred_at_epoch_ms, local_calendar_date, utc_offset_minutes`;

export class HydrationEntrySqliteRepository implements HydrationEntryRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getById(id: DomainId): Promise<HydrationEntry | null> {
    try {
      const row = await this.database.getFirst<HydrationEntryRow>(
        `SELECT ${selectedColumns} FROM hydration_entry WHERE id = ?`,
        [id.value],
      );
      return row === null ? null : mapRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async listByLocalDate(date: string): Promise<readonly HydrationEntry[]> {
    try {
      const rows = await this.database.getAll<HydrationEntryRow>(
        `SELECT ${selectedColumns} FROM hydration_entry
         WHERE local_calendar_date = ?
         ORDER BY occurred_at_epoch_ms DESC, id ASC`,
        [date],
      );
      return Object.freeze(rows.map(mapRow));
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

function mapRow(row: HydrationEntryRow): HydrationEntry {
  const id = DomainId.create(row.id);
  const volume = Volume.create(row.volume_milliliters, 'milliliter');
  if (isErr(id) || isErr(volume)) {
    throw new PersistenceError('operation-failed');
  }
  const entry = HydrationEntry.create({
    description: row.description,
    fluidType: row.fluid_type,
    id: id.value,
    localCalendarDate: row.local_calendar_date,
    occurredAtEpochMilliseconds: row.occurred_at_epoch_ms,
    utcOffsetMinutes: row.utc_offset_minutes,
    volume: volume.value,
  });
  if (isErr(entry)) throw new PersistenceError('operation-failed');
  return entry.value;
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
