import type { ConsumptionEntry, DomainId } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type { ConsumptionEntryRepository } from '../application/consumption-entry-repository';
import {
  consumptionEntryColumns,
  mapConsumptionEntryRow,
  type ConsumptionEntryRow,
} from './nutrition-row-mapping';

export class ConsumptionEntrySqliteRepository implements ConsumptionEntryRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getById(id: DomainId): Promise<ConsumptionEntry | null> {
    try {
      const row = await this.database.getFirst<ConsumptionEntryRow>(
        `SELECT ${consumptionEntryColumns}
         FROM nutrition_consumption_entry WHERE id = ?`,
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
         WHERE local_calendar_date = ?
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
      await this.database.run(
        `INSERT INTO nutrition_consumption_entry (
          id, entry_kind, description, reference_kind, reference_amount,
          consumed_amount, energy_kilojoules, protein_grams,
          carbohydrate_grams, fat_grams, fiber_grams, sugar_grams,
          sodium_milligrams, provenance, occurred_at_epoch_ms,
          local_calendar_date, utc_offset_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        toParameters(entry),
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async update(entry: ConsumptionEntry): Promise<boolean> {
    try {
      if ((await this.getById(entry.id)) === null) return false;
      await this.database.run(
        `UPDATE nutrition_consumption_entry SET
          entry_kind = ?, description = ?, reference_kind = ?,
          reference_amount = ?, consumed_amount = ?, energy_kilojoules = ?,
          protein_grams = ?, carbohydrate_grams = ?, fat_grams = ?,
          fiber_grams = ?, sugar_grams = ?, sodium_milligrams = ?,
          provenance = ?, occurred_at_epoch_ms = ?, local_calendar_date = ?,
          utc_offset_minutes = ?
         WHERE id = ?`,
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
      await this.database.run(
        'DELETE FROM nutrition_consumption_entry WHERE id = ?',
        [id.value],
      );
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
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
