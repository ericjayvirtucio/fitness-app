import type { DomainId } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
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

  search(normalizedQuery: string, limit: number) {
    return this.readMany(
      `SELECT ${exerciseColumns} FROM exercise_catalog_item WHERE normalized_name LIKE ? ESCAPE '\\' ORDER BY is_favorite DESC, normalized_name ASC, id ASC LIMIT ?`,
      [`%${escapeExerciseSearch(normalizedQuery)}%`, limit],
    );
  }

  listAll(limit: number) {
    return this.readMany(
      `SELECT ${exerciseColumns} FROM exercise_catalog_item ORDER BY normalized_name ASC, id ASC LIMIT ?`,
      [limit],
    );
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
