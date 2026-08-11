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
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { NutritionCatalogItem } from '../application/nutrition-catalog-item';
import { normalizeNutritionCatalogName } from '../application/nutrition-catalog-name';

export type ConsumptionEntryRow = Readonly<{
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

export type NutritionCatalogRow = Readonly<{
  carbohydrate_grams: number | null;
  display_name: string;
  energy_kilojoules: number;
  fat_grams: number | null;
  fiber_grams: number | null;
  id: string;
  is_favorite: number;
  item_kind: string;
  last_used_at_epoch_ms: number | null;
  normalized_name: string;
  protein_grams: number | null;
  provenance: string;
  reference_amount: number;
  reference_kind: string;
  sodium_milligrams: number | null;
  sugar_grams: number | null;
  use_count: number;
}>;

export const consumptionEntryColumns = `id, entry_kind, description, reference_kind,
  reference_amount, consumed_amount, energy_kilojoules, protein_grams,
  carbohydrate_grams, fat_grams, fiber_grams, sugar_grams,
  sodium_milligrams, provenance, occurred_at_epoch_ms,
  local_calendar_date, utc_offset_minutes`;

export const nutritionCatalogColumns = `id, item_kind, display_name, normalized_name,
  reference_kind, reference_amount, energy_kilojoules, protein_grams,
  carbohydrate_grams, fat_grams, fiber_grams, sugar_grams,
  sodium_milligrams, provenance, is_favorite, last_used_at_epoch_ms,
  use_count`;

export function mapConsumptionEntryRow(
  row: ConsumptionEntryRow,
): ConsumptionEntry {
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

export function mapNutritionCatalogRow(
  row: NutritionCatalogRow,
): NutritionCatalogItem {
  const id = DomainId.create(row.id);
  const energy = Energy.create(row.energy_kilojoules, 'kilojoule');
  const reference = createReference(row.reference_kind, row.reference_amount);
  if (isErr(id) || isErr(energy))
    throw new PersistenceError('operation-failed');

  const facts = NutritionFacts.create({
    description: row.display_name,
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
  if (
    isErr(facts) ||
    normalizeNutritionCatalogName(row.display_name) !== row.normalized_name
  ) {
    throw new PersistenceError('operation-failed');
  }

  const item = NutritionCatalogItem.create({
    facts: facts.value,
    id: id.value,
    isFavorite: row.is_favorite === 1,
    kind: row.item_kind,
    lastUsedAtEpochMilliseconds: row.last_used_at_epoch_ms,
    useCount: row.use_count,
  });
  if (isErr(item) || (row.is_favorite !== 0 && row.is_favorite !== 1)) {
    throw new PersistenceError('operation-failed');
  }
  return item.value;
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
