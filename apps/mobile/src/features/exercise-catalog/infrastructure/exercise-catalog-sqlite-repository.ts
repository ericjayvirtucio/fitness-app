import type { DomainId } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import {
  noExerciseCatalogFilter,
  type ExerciseCatalogFilter,
} from '../application/exercise-catalog-filter';
import type { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import {
  escapeExerciseSearch,
  normalizeExerciseName,
} from '../application/exercise-catalog-name';
import type { ExerciseCatalogRepository } from '../application/exercise-catalog-repository';
import {
  exerciseColumns,
  mapExerciseRow,
  type ExerciseRow,
} from './exercise-row-mapping';

export class ExerciseCatalogSqliteRepository implements ExerciseCatalogRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getById(id: DomainId): Promise<ExerciseCatalogItem | null> {
    try {
      const row = await this.database.getFirst<ExerciseRow>(
        `SELECT ${exerciseColumns} FROM exercise_catalog_item WHERE id = ?`,
        [id.value],
      );
      return row === null ? null : mapExerciseRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  getByIds(ids: readonly DomainId[]) {
    if (ids.length === 0) return Promise.resolve(Object.freeze([]));
    return this.readMany(
      `SELECT ${exerciseColumns} FROM exercise_catalog_item WHERE id IN (${ids.map(() => '?').join(', ')}) ORDER BY id ASC`,
      ids.map((id) => id.value),
    );
  }

  findByNormalizedName(normalizedName: string) {
    return this.readMany(
      `SELECT ${exerciseColumns} FROM exercise_catalog_item WHERE normalized_name = ? ORDER BY id ASC`,
      [normalizedName],
    );
  }

  search(
    normalizedQuery: string,
    limit: number,
    filter: ExerciseCatalogFilter = noExerciseCatalogFilter,
  ) {
    return this.listMatching(normalizedQuery, limit, filter);
  }

  listAll(
    limit: number,
    filter: ExerciseCatalogFilter = noExerciseCatalogFilter,
  ) {
    return this.listMatching(null, limit, filter);
  }

  listFavorites(limit: number) {
    return this.readMany(
      `SELECT ${exerciseColumns} FROM exercise_catalog_item WHERE is_favorite = 1 ORDER BY normalized_name ASC, id ASC LIMIT ?`,
      [limit],
    );
  }

  async insert(item: ExerciseCatalogItem): Promise<void> {
    await this.write(
      `INSERT INTO exercise_catalog_item (${exerciseColumns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      parameters(item),
    );
  }

  async update(item: ExerciseCatalogItem): Promise<boolean> {
    if ((await this.getById(item.definition.id)) === null) return false;
    const values = parameters(item);
    await this.write(
      `UPDATE exercise_catalog_item SET display_name = ?, normalized_name = ?, equipment = ?, primary_muscle_group = ?, logging_mode = ?, notes = ?, is_favorite = ? WHERE id = ?`,
      [...values.slice(1), item.definition.id.value],
    );
    return true;
  }

  async setFavorite(id: DomainId, isFavorite: boolean): Promise<boolean> {
    if ((await this.getById(id)) === null) return false;
    await this.write(
      'UPDATE exercise_catalog_item SET is_favorite = ? WHERE id = ?',
      [isFavorite ? 1 : 0, id.value],
    );
    return true;
  }

  async delete(id: DomainId): Promise<boolean> {
    if ((await this.getById(id)) === null) return false;
    await this.write('DELETE FROM exercise_catalog_item WHERE id = ?', [
      id.value,
    ]);
    return true;
  }

  /**
   * The only place the catalog's browse and search statements are composed.
   * Every clause is a code literal and every narrowed value arrives as a bound
   * parameter, so no filter value is ever interpolated. A clause is omitted
   * entirely when its criterion is absent, which keeps the unfiltered
   * statements identical to the ones this repository has always issued and
   * leaves the existing `(normalized_name, id)` index covering the ordering.
   */
  private listMatching(
    normalizedQuery: string | null,
    limit: number,
    filter: ExerciseCatalogFilter,
  ) {
    const conditions: string[] = [];
    const values: (number | string)[] = [];
    if (normalizedQuery !== null) {
      conditions.push("normalized_name LIKE ? ESCAPE '\\'");
      values.push(`%${escapeExerciseSearch(normalizedQuery)}%`);
    }
    if (filter.equipment !== null) {
      conditions.push('equipment = ?');
      values.push(filter.equipment);
    }
    if (filter.primaryMuscleGroup !== null) {
      conditions.push('primary_muscle_group = ?');
      values.push(filter.primaryMuscleGroup);
    }
    // Ordering depends on whether the person supplied a name, never on whether
    // they narrowed: a search surfaces favorites first, browsing is alphabetical.
    const ordering =
      normalizedQuery === null
        ? 'normalized_name ASC, id ASC'
        : 'is_favorite DESC, normalized_name ASC, id ASC';
    const where =
      conditions.length === 0 ? '' : ` WHERE ${conditions.join(' AND ')}`;
    return this.readMany(
      `SELECT ${exerciseColumns} FROM exercise_catalog_item${where} ORDER BY ${ordering} LIMIT ?`,
      [...values, limit],
    );
  }

  private async readMany(
    statement: string,
    values: DatabaseParameters,
  ): Promise<readonly ExerciseCatalogItem[]> {
    try {
      return Object.freeze(
        (await this.database.getAll<ExerciseRow>(statement, values)).map(
          mapExerciseRow,
        ),
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  private async write(
    statement: string,
    values: DatabaseParameters,
  ): Promise<void> {
    try {
      await this.database.run(statement, values);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}

function parameters(item: ExerciseCatalogItem): DatabaseParameters {
  const exercise = item.definition;
  return [
    exercise.id.value,
    exercise.name,
    normalizeExerciseName(exercise.name),
    exercise.equipment,
    exercise.primaryMuscleGroup,
    exercise.loggingMode,
    exercise.notes,
    item.isFavorite ? 1 : 0,
  ];
}
