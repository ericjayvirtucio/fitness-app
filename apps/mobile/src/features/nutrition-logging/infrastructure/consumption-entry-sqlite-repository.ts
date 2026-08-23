import type { ConsumptionEntry, DomainId } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { queueOutboxEntry } from '../../../infrastructure/persistence/sync-outbox';
import type { ConsumptionEntryRepository } from '../application/consumption-entry-repository';
import {
  consumptionEntryColumns,
  mapConsumptionEntryRow,
  type ConsumptionEntryRow,
} from './nutrition-row-mapping';

const tableName = 'nutrition_consumption_entry';

export class ConsumptionEntrySqliteRepository implements ConsumptionEntryRepository {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly deviceId: string,
    private readonly now: () => Date,
  ) {}

  async getById(id: DomainId): Promise<ConsumptionEntry | null> {
    try {
      const row = await this.database.getFirst<ConsumptionEntryRow>(
        `SELECT ${consumptionEntryColumns}
         FROM nutrition_consumption_entry
         WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
        [id.value],
      );
      return row === null ? null : mapConsumptionEntryRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async listByLocalDate(date: string): Promise<readonly ConsumptionEntry[]> {
    try {
      const rows = await this.database.getAll<ConsumptionEntryRow>(
        `SELECT ${consumptionEntryColumns}
         FROM nutrition_consumption_entry
         WHERE local_calendar_date = ? AND deleted_at_epoch_ms IS NULL
         ORDER BY occurred_at_epoch_ms DESC, id ASC`,
        [date],
      );
      return Object.freeze(rows.map(mapConsumptionEntryRow));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async insert(entry: ConsumptionEntry): Promise<void> {
    try {
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `INSERT INTO nutrition_consumption_entry (
          id, entry_kind, description, reference_kind, reference_amount,
          consumed_amount, energy_kilojoules, protein_grams,
          carbohydrate_grams, fat_grams, fiber_grams, sugar_grams,
          sodium_milligrams, provenance, occurred_at_epoch_ms,
          local_calendar_date, utc_offset_minutes, updated_at_epoch_ms,
          deleted_at_epoch_ms, revision, originating_device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)`,
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

  async update(entry: ConsumptionEntry): Promise<boolean> {
    try {
      if ((await this.getById(entry.id)) === null) return false;
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `UPDATE nutrition_consumption_entry SET
          entry_kind = ?, description = ?, reference_kind = ?,
          reference_amount = ?, consumed_amount = ?, energy_kilojoules = ?,
          protein_grams = ?, carbohydrate_grams = ?, fat_grams = ?,
          fiber_grams = ?, sugar_grams = ?, sodium_milligrams = ?,
          provenance = ?, occurred_at_epoch_ms = ?, local_calendar_date = ?,
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
        `UPDATE nutrition_consumption_entry SET deleted_at_epoch_ms = ?,
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
      'SELECT revision FROM nutrition_consumption_entry WHERE id = ?',
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

function toParameters(entry: ConsumptionEntry) {
  const { facts } = entry;
  const referenceAmount =
    facts.reference.kind === 'mass'
      ? facts.reference.amount.grams
      : facts.reference.amount.milliliters;
  const consumedAmount =
    entry.consumedQuantity.kind === 'mass'
      ? entry.consumedQuantity.amount.grams
      : entry.consumedQuantity.amount.milliliters;
  return [
    entry.id.value,
    entry.kind,
    facts.description,
    facts.reference.kind,
    referenceAmount,
    consumedAmount,
    facts.energy.kilojoules,
    facts.nutrients.proteinGrams,
    facts.nutrients.carbohydrateGrams,
    facts.nutrients.fatGrams,
    facts.nutrients.fiberGrams,
    facts.nutrients.sugarGrams,
    facts.nutrients.sodiumMilligrams,
    facts.provenance,
    entry.occurredAtEpochMilliseconds,
    entry.localCalendarDate,
    entry.utcOffsetMinutes,
  ] as const;
}
