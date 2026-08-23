import type { DomainId } from '@fitness/domain';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { queueOutboxEntry } from '../../../infrastructure/persistence/sync-outbox';
import type { NutritionCatalogItem } from '../application/nutrition-catalog-item';
import {
  escapeLikePattern,
  normalizeNutritionCatalogName,
} from '../application/nutrition-catalog-name';
import type { NutritionCatalogRepository } from '../application/nutrition-catalog-repository';
import {
  mapNutritionCatalogRow,
  nutritionCatalogColumns,
  type NutritionCatalogRow,
} from './nutrition-row-mapping';

const tableName = 'nutrition_catalog_item';

export class NutritionCatalogSqliteRepository implements NutritionCatalogRepository {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly deviceId: string,
    private readonly now: () => Date,
  ) {}

  async getById(id: DomainId): Promise<NutritionCatalogItem | null> {
    try {
      const row = await this.database.getFirst<NutritionCatalogRow>(
        `SELECT ${nutritionCatalogColumns}
         FROM nutrition_catalog_item
         WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
        [id.value],
      );
      return row === null ? null : mapNutritionCatalogRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async findByNormalizedName(
    normalizedName: string,
  ): Promise<readonly NutritionCatalogItem[]> {
    return this.readMany(
      `SELECT ${nutritionCatalogColumns}
       FROM nutrition_catalog_item
       WHERE normalized_name = ? AND deleted_at_epoch_ms IS NULL
       ORDER BY id ASC`,
      [normalizedName],
    );
  }

  async search(
    normalizedQuery: string,
    limit: number,
  ): Promise<readonly NutritionCatalogItem[]> {
    return this.readMany(
      `SELECT ${nutritionCatalogColumns}
       FROM nutrition_catalog_item
       WHERE normalized_name LIKE ? ESCAPE '\\' AND deleted_at_epoch_ms IS NULL
       ORDER BY is_favorite DESC, normalized_name ASC, id ASC
       LIMIT ?`,
      [`%${escapeLikePattern(normalizedQuery)}%`, limit],
    );
  }

  async listFavorites(limit: number): Promise<readonly NutritionCatalogItem[]> {
    return this.readMany(
      `SELECT ${nutritionCatalogColumns}
       FROM nutrition_catalog_item
       WHERE is_favorite = 1 AND deleted_at_epoch_ms IS NULL
       ORDER BY normalized_name ASC, id ASC
       LIMIT ?`,
      [limit],
    );
  }

  async listRecent(limit: number): Promise<readonly NutritionCatalogItem[]> {
    return this.readMany(
      `SELECT ${nutritionCatalogColumns}
       FROM nutrition_catalog_item
       WHERE last_used_at_epoch_ms IS NOT NULL AND deleted_at_epoch_ms IS NULL
       ORDER BY last_used_at_epoch_ms DESC, use_count DESC,
         normalized_name ASC, id ASC
       LIMIT ?`,
      [limit],
    );
  }

  async insert(item: NutritionCatalogItem): Promise<void> {
    try {
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `INSERT INTO nutrition_catalog_item (
          id, item_kind, display_name, normalized_name, reference_kind,
          reference_amount, energy_kilojoules, protein_grams,
          carbohydrate_grams, fat_grams, fiber_grams, sugar_grams,
          sodium_milligrams, provenance, is_favorite,
          last_used_at_epoch_ms, use_count, updated_at_epoch_ms,
          deleted_at_epoch_ms, revision, originating_device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)`,
        [...toParameters(item), nowEpochMs, this.deviceId],
      );
      await queueOutboxEntry(
        this.database,
        tableName,
        item.id.value,
        'upsert',
        1,
        nowEpochMs,
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async update(item: NutritionCatalogItem): Promise<boolean> {
    try {
      if ((await this.getById(item.id)) === null) return false;
      const parameters = toParameters(item);
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `UPDATE nutrition_catalog_item SET
          item_kind = ?, display_name = ?, normalized_name = ?,
          reference_kind = ?, reference_amount = ?, energy_kilojoules = ?,
          protein_grams = ?, carbohydrate_grams = ?, fat_grams = ?,
          fiber_grams = ?, sugar_grams = ?, sodium_milligrams = ?,
          provenance = ?, is_favorite = ?, last_used_at_epoch_ms = ?,
          use_count = ?, updated_at_epoch_ms = ?, revision = revision + 1
         WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
        [...parameters.slice(1), nowEpochMs, item.id.value],
      );
      await this.queueRevision(item.id.value, 'upsert', nowEpochMs);
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
        `UPDATE nutrition_catalog_item SET deleted_at_epoch_ms = ?,
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

  async setFavorite(id: DomainId, isFavorite: boolean): Promise<boolean> {
    try {
      if ((await this.getById(id)) === null) return false;
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `UPDATE nutrition_catalog_item SET is_favorite = ?,
          updated_at_epoch_ms = ?, revision = revision + 1
         WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
        [isFavorite ? 1 : 0, nowEpochMs, id.value],
      );
      await this.queueRevision(id.value, 'upsert', nowEpochMs);
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
      const nowEpochMs = this.now().getTime();
      await this.database.run(
        `UPDATE nutrition_catalog_item
         SET last_used_at_epoch_ms = ?, use_count = use_count + 1,
           updated_at_epoch_ms = ?, revision = revision + 1
         WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
        [usedAtEpochMilliseconds, nowEpochMs, id.value],
      );
      await this.queueRevision(id.value, 'upsert', nowEpochMs);
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
      'SELECT revision FROM nutrition_catalog_item WHERE id = ?',
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

  private async readMany(
    statement: string,
    parameters: readonly (number | string)[],
  ): Promise<readonly NutritionCatalogItem[]> {
    try {
      const rows = await this.database.getAll<NutritionCatalogRow>(
        statement,
        parameters,
      );
      return Object.freeze(rows.map(mapNutritionCatalogRow));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
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
