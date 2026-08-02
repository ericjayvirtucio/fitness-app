import {
  ConsumptionEntry,
  DomainId,
  Energy,
  Mass,
  NutritionFacts,
  Volume,
  isErr,
  type NutritionReference,
} from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import type { ConsumptionEntryRepository } from '../application/consumption-entry-repository';

type ConsumptionEntryRow = Readonly<{
  carbohydrate_grams: number | null;
  consumed_amount: number;
  description: string;
  energy_kilojoules: number;
  entry_kind: string;
  fat_grams: number | null;
  fiber_grams: number | null;
  id: string;
  local_calendar_date: string;
  occurred_at_epoch_ms: number;
  protein_grams: number | null;
  provenance: string;
  reference_amount: number;
  reference_kind: string;
  sodium_milligrams: number | null;
  sugar_grams: number | null;
  utc_offset_minutes: number;
}>;

const selectedColumns = `id, entry_kind, description, reference_kind,
  reference_amount, consumed_amount, energy_kilojoules, protein_grams,
  carbohydrate_grams, fat_grams, fiber_grams, sugar_grams,
  sodium_milligrams, provenance, occurred_at_epoch_ms,
  local_calendar_date, utc_offset_minutes`;

export class ConsumptionEntrySqliteRepository implements ConsumptionEntryRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getById(id: DomainId): Promise<ConsumptionEntry | null> {
    try {
      const row = await this.database.getFirst<ConsumptionEntryRow>(
        `SELECT ${selectedColumns}
         FROM nutrition_consumption_entry WHERE id = ?`,
        [id.value],
      );
      return row === null ? null : mapRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async listByLocalDate(date: string): Promise<readonly ConsumptionEntry[]> {
    try {
      const rows = await this.database.getAll<ConsumptionEntryRow>(
        `SELECT ${selectedColumns}
         FROM nutrition_consumption_entry
         WHERE local_calendar_date = ?
         ORDER BY occurred_at_epoch_ms DESC, id ASC`,
        [date],
      );
      return Object.freeze(rows.map(mapRow));
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

function mapRow(row: ConsumptionEntryRow): ConsumptionEntry {
  const id = DomainId.create(row.id);
  const reference = createReference(row.reference_kind, row.reference_amount);
  const consumedQuantity = createReference(
    row.reference_kind,
    row.consumed_amount,
  );
  const energy = Energy.create(row.energy_kilojoules, 'kilojoule');
  if (isErr(id) || isErr(energy)) {
    throw new PersistenceError('operation-failed');
  }
  const facts = NutritionFacts.create({
    description: row.description,
    energy: energy.value,
    nutrients: {
      carbohydrateGrams: row.carbohydrate_grams,
      fatGrams: row.fat_grams,
      fiberGrams: row.fiber_grams,
      proteinGrams: row.protein_grams,
      sodiumMilligrams: row.sodium_milligrams,
      sugarGrams: row.sugar_grams,
    },
    provenance: row.provenance,
    reference,
  });
  if (isErr(facts)) throw new PersistenceError('operation-failed');
  const entry = ConsumptionEntry.create({
    consumedQuantity,
    facts: facts.value,
    id: id.value,
    kind: row.entry_kind,
    localCalendarDate: row.local_calendar_date,
    occurredAtEpochMilliseconds: row.occurred_at_epoch_ms,
    utcOffsetMinutes: row.utc_offset_minutes,
  });
  if (isErr(entry)) throw new PersistenceError('operation-failed');
  return entry.value;
}

function createReference(kind: string, amount: number): NutritionReference {
  if (kind === 'mass') {
    const mass = Mass.create(amount, 'gram');
    if (isErr(mass)) throw new PersistenceError('operation-failed');
    return Object.freeze({ amount: mass.value, kind });
  }
  if (kind === 'volume') {
    const volume = Volume.create(amount, 'milliliter');
    if (isErr(volume)) throw new PersistenceError('operation-failed');
    return Object.freeze({ amount: volume.value, kind });
  }
  throw new PersistenceError('operation-failed');
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
