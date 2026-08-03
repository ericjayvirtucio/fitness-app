import type { DomainId } from '@fitness/domain';
import type { NutritionCatalogItem } from './nutrition-catalog-item';

export interface NutritionCatalogRepository {
  delete(id: DomainId): Promise<boolean>;
  findByNormalizedName(
    normalizedName: string,
  ): Promise<readonly NutritionCatalogItem[]>;
  getById(id: DomainId): Promise<NutritionCatalogItem | null>;
  insert(item: NutritionCatalogItem): Promise<void>;
  listFavorites(limit: number): Promise<readonly NutritionCatalogItem[]>;
  listRecent(limit: number): Promise<readonly NutritionCatalogItem[]>;
  recordUsage(id: DomainId, usedAtEpochMilliseconds: number): Promise<boolean>;
  search(
    normalizedQuery: string,
    limit: number,
  ): Promise<readonly NutritionCatalogItem[]>;
  setFavorite(id: DomainId, isFavorite: boolean): Promise<boolean>;
  update(item: NutritionCatalogItem): Promise<boolean>;
}
