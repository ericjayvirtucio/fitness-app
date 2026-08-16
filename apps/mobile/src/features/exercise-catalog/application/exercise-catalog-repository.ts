import type { DomainId } from '@fitness/domain';
import type { ExerciseCatalogFilter } from './exercise-catalog-filter';
import type { ExerciseCatalogItem } from './exercise-catalog-item';

export interface ExerciseCatalogRepository {
  delete(id: DomainId): Promise<boolean>;
  findByNormalizedName(
    normalizedName: string,
  ): Promise<readonly ExerciseCatalogItem[]>;
  getById(id: DomainId): Promise<ExerciseCatalogItem | null>;
  getByIds(ids: readonly DomainId[]): Promise<readonly ExerciseCatalogItem[]>;
  insert(item: ExerciseCatalogItem): Promise<void>;
  // Browsing and searching take the same optional criteria, so a narrowed read
  // stays one bounded query on the path it already used rather than a second
  // path that can drift from this one.
  listAll(
    limit: number,
    filter?: ExerciseCatalogFilter,
  ): Promise<readonly ExerciseCatalogItem[]>;
  listFavorites(limit: number): Promise<readonly ExerciseCatalogItem[]>;
  search(
    normalizedQuery: string,
    limit: number,
    filter?: ExerciseCatalogFilter,
  ): Promise<readonly ExerciseCatalogItem[]>;
  setFavorite(id: DomainId, isFavorite: boolean): Promise<boolean>;
  update(item: ExerciseCatalogItem): Promise<boolean>;
}
