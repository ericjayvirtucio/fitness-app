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
  // Undeletes a tombstoned row exactly as it was last stored, touching only
  // its deletion, revision, and modification metadata. It is not a second
  // creation path: a caller that wants bundled content has to insert it, and
  // this only ever brings back a row the catalog already held.
  restore(id: DomainId): Promise<boolean>;
  search(
    normalizedQuery: string,
    limit: number,
    filter?: ExerciseCatalogFilter,
  ): Promise<readonly ExerciseCatalogItem[]>;
  setFavorite(id: DomainId, isFavorite: boolean): Promise<boolean>;
  update(item: ExerciseCatalogItem): Promise<boolean>;
}
