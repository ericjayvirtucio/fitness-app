import {
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
import { NutritionCatalogItem } from '../application/nutrition-catalog-item';
import {
  escapeLikePattern,
  normalizeNutritionCatalogName,
} from '../application/nutrition-catalog-name';
import type { NutritionCatalogRepository } from '../application/nutrition-catalog-repository';

type NutritionCatalogRow = Readonly<{
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

const selectedColumns = `id, item_kind, display_name, normalized_name,
  reference_kind, reference_amount, energy_kilojoules, protein_grams,
  carbohydrate_grams, fat_grams, fiber_grams, sugar_grams,
  sodium_milligrams, provenance, is_favorite, last_used_at_epoch_ms,
  use_count`;

export class NutritionCatalogSqliteRepository implements NutritionCatalogRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getById(id: DomainId): Promise<NutritionCatalogItem | null> {
    try {
      const row = await this.database.getFirst<NutritionCatalogRow>(
        `SELECT ${selectedColumns}
         FROM nutrition_catalog_item WHERE id = ?`,
        [id.value],
      );
      return row === null ? null : mapRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async findByNormalizedName(
    normalizedName: string,
  ): Promise<readonly NutritionCatalogItem[]> {
    return this.readMany(
      `SELECT ${selectedColumns}
       FROM nutrition_catalog_item
       WHERE normalized_name = ?
       ORDER BY id ASC`,
      [normalizedName],
    );
  }

  async search(
    normalizedQuery: string,
    limit: number,
  ): Promise<readonly NutritionCatalogItem[]> {
    return this.readMany(
      `SELECT ${selectedColumns}
       FROM nutrition_catalog_item
       WHERE normalized_name LIKE ? ESCAPE '\\'
       ORDER BY is_favorite DESC, normalized_name ASC, id ASC
       LIMIT ?`,
      [`%${escapeLikePattern(normalizedQuery)}%`, limit],
    );
  }

  async listFavorites(limit: number): Promise<readonly NutritionCatalogItem[]> {
    return this.readMany(
      `SELECT ${selectedColumns}
       FROM nutrition_catalog_item
       WHERE is_favorite = 1
       ORDER BY normalized_name ASC, id ASC
       LIMIT ?`,
      [limit],
    );
  }

  async listRecent(limit: number): Promise<readonly NutritionCatalogItem[]> {
    return this.readMany(
      `SELECT ${selectedColumns}
       FROM nutrition_catalog_item
       WHERE last_used_at_epoch_ms IS NOT NULL
       ORDER BY last_used_at_epoch_ms DESC, use_count DESC,
         normalized_name ASC, id ASC
       LIMIT ?`,
      [limit],
    );
  }

  async insert(item: NutritionCatalogItem): Promise<void> {
    try {
      await this.database.run(
        `INSERT INTO nutrition_catalog_item (
          id, item_kind, display_name, normalized_name, reference_kind,
          reference_amount, energy_kilojoules, protein_grams,
          carbohydrate_grams, fat_grams, fiber_grams, sugar_grams,
          sodium_milligrams, provenance, is_favorite,
          last_used_at_epoch_ms, use_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        toParameters(item),
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async update(item: NutritionCatalogItem): Promise<boolean> {
    try {
      if ((await this.getById(item.id)) === null) return false;
      const parameters = toParameters(item);
      await this.database.run(
        `UPDATE nutrition_catalog_item SET
          item_kind = ?, display_name = ?, normalized_name = ?,
          reference_kind = ?, reference_amount = ?, energy_kilojoules = ?,
          protein_grams = ?, carbohydrate_grams = ?, fat_grams = ?,
          fiber_grams = ?, sugar_grams = ?, sodium_milligrams = ?,
          provenance = ?, is_favorite = ?, last_used_at_epoch_ms = ?,
          use_count = ?
         WHERE id = ?`,
        [...parameters.slice(1), item.id.value],
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
        'DELETE FROM nutrition_catalog_item WHERE id = ?',
        [id.value],
      );
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async setFavorite(id: DomainId, isFavorite: boolean): Promise<boolean> {
    try {
      if ((await this.getById(id)) === null) return false;
      await this.database.run(
        'UPDATE nutrition_catalog_item SET is_favorite = ? WHERE id = ?',
        [isFavorite ? 1 : 0, id.value],
      );
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async recordUsage(
    id: DomainId,
    usedAtEpochMilliseconds: number,
  ): Promise<boolean> {
    try {
      if ((await this.getById(id)) === null) return false;
      await this.database.run(
        `UPDATE nutrition_catalog_item
         SET last_used_at_epoch_ms = ?, use_count = use_count + 1
         WHERE id = ?`,
        [usedAtEpochMilliseconds, id.value],
      );
      return true;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  private async readMany(
    statement: string,
    parameters: readonly (number | string)[],
  ): Promise<readonly NutritionCatalogItem[]> {
    try {
      const rows = await this.database.getAll<NutritionCatalogRow>(
        statement,
        parameters,
      );
      return Object.freeze(rows.map(mapRow));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}

function mapRow(row: NutritionCatalogRow): NutritionCatalogItem {
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

function toParameters(item: NutritionCatalogItem) {
  const { facts } = item;
  const referenceAmount =
    facts.reference.kind === 'mass'
      ? facts.reference.amount.grams
      : facts.reference.amount.milliliters;
  return [
    item.id.value,
    item.kind,
    facts.description,
    normalizeNutritionCatalogName(facts.description),
    facts.reference.kind,
    referenceAmount,
    facts.energy.kilojoules,
    facts.nutrients.proteinGrams,
    facts.nutrients.carbohydrateGrams,
    facts.nutrients.fatGrams,
    facts.nutrients.fiberGrams,
    facts.nutrients.sugarGrams,
    facts.nutrients.sodiumMilligrams,
    facts.provenance,
    item.isFavorite ? 1 : 0,
    item.usage.lastUsedAtEpochMilliseconds,
    item.usage.useCount,
  ] as const;
}
