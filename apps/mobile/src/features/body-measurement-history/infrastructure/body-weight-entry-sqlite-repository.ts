import type { BodyWeightEntry, DomainId } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type { BodyWeightEntryRepository } from '../application/body-weight-entry-repository';
import {
  toBodyWeightHistoryCursor,
  type BodyWeightHistoryPage,
  type BodyWeightHistoryPageQuery,
} from '../application/body-weight-history-models';
import {
  bodyWeightEntryColumns,
  mapBodyWeightEntryRow,
  type BodyWeightEntryRow,
} from './body-weight-row-mapping';

// Newest first, matching body_weight_entry_local_date_occurred_at.
const newestFirst = `ORDER BY local_calendar_date DESC,
  occurred_at_epoch_ms DESC, id DESC`;

export class BodyWeightEntrySqliteRepository implements BodyWeightEntryRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getById(id: DomainId): Promise<BodyWeightEntry | null> {
    try {
      const row = await this.database.getFirst<BodyWeightEntryRow>(
        `SELECT ${bodyWeightEntryColumns} FROM body_weight_entry WHERE id = ?`,
        [id.value],
      );
      return row === null ? null : mapBodyWeightEntryRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async getLatest(): Promise<BodyWeightEntry | null> {
    try {
      const row = await this.database.getFirst<BodyWeightEntryRow>(
        `SELECT ${bodyWeightEntryColumns} FROM body_weight_entry ${newestFirst} LIMIT 1`,
      );
      return row === null ? null : mapBodyWeightEntryRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async listPage(
    query: BodyWeightHistoryPageQuery,
  ): Promise<BodyWeightHistoryPage> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor;
    try {
      // One extra row decides whether another page exists without a count.
      const rows = await this.database.getAll<BodyWeightEntryRow>(
        `SELECT ${bodyWeightEntryColumns} FROM body_weight_entry
         ${
           cursor
             ? `WHERE local_calendar_date < ?
                  OR (local_calendar_date = ? AND occurred_at_epoch_ms < ?)
                  OR (local_calendar_date = ? AND occurred_at_epoch_ms = ?
                      AND id < ?)`
             : ''
         }
         ${newestFirst} LIMIT ?`,
        cursor
          ? [
              cursor.localCalendarDate,
              cursor.localCalendarDate,
              cursor.occurredAtEpochMilliseconds,
              cursor.localCalendarDate,
              cursor.occurredAtEpochMilliseconds,
              cursor.id,
              limit + 1,
            ]
          : [limit + 1],
      );
      const items = rows.slice(0, limit).map(mapBodyWeightEntryRow);
      const lastItem = items.at(-1);
      return Object.freeze({
        items: Object.freeze(items),
        nextCursor:
          rows.length > limit && lastItem
            ? toBodyWeightHistoryCursor(lastItem)
            : null,
      });
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async insert(entry: BodyWeightEntry): Promise<void> {
    try {
      await this.database.run(
        `INSERT INTO body_weight_entry (
          id, mass_grams, note, occurred_at_epoch_ms,
          local_calendar_date, utc_offset_minutes
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        toParameters(entry),
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async update(entry: BodyWeightEntry): Promise<boolean> {
    try {
      if ((await this.getById(entry.id)) === null) return false;
      await this.database.run(
        `UPDATE body_weight_entry SET mass_grams = ?, note = ?,
          occurred_at_epoch_ms = ?, local_calendar_date = ?,
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
      await this.database.run('DELETE FROM body_weight_entry WHERE id = ?', [
        id.value,
      ]);
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}

function toParameters(entry: BodyWeightEntry): DatabaseParameters {
  return [
    entry.id.value,
    entry.mass.grams,
    entry.note,
    entry.occurredAtEpochMilliseconds,
    entry.localCalendarDate,
    entry.utcOffsetMinutes,
  ];
}
