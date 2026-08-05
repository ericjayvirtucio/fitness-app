import type { DomainId } from '@fitness/domain';
import type { ExerciseCatalogItem } from './exercise-catalog-item';

export interface ExerciseCatalogRepository {
  delete(id: DomainId): Promise<boolean>;
  findByNormalizedName(
    normalizedName: string,
  ): Promise<readonly ExerciseCatalogItem[]>;
  getById(id: DomainId): Promise<ExerciseCatalogItem | null>;
  insert(item: ExerciseCatalogItem): Promise<void>;
  listAll(limit: number): Promise<readonly ExerciseCatalogItem[]>;
  listFavorites(limit: number): Promise<readonly ExerciseCatalogItem[]>;
  search(
    normalizedQuery: string,
    limit: number,
  ): Promise<readonly ExerciseCatalogItem[]>;
  setFavorite(id: DomainId, isFavorite: boolean): Promise<boolean>;
  update(item: ExerciseCatalogItem): Promise<boolean>;
}
