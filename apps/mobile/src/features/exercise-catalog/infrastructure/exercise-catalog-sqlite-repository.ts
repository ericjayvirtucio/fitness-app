import { DomainId, ExerciseDefinition, isErr } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import {
  escapeExerciseSearch,
  normalizeExerciseName,
} from '../application/exercise-catalog-name';
import type { ExerciseCatalogRepository } from '../application/exercise-catalog-repository';

type ExerciseRow = Readonly<{
  display_name: string;
  equipment: string;
  id: string;
  is_favorite: number;
  logging_mode: string;
  normalized_name: string;
  notes: string | null;
  primary_muscle_group: string;
}>;

const columns =
  'id, display_name, normalized_name, equipment, primary_muscle_group, logging_mode, notes, is_favorite';

export class ExerciseCatalogSqliteRepository implements ExerciseCatalogRepository {
  constructor(private readonly database: DatabaseConnection) {}

  async getById(id: DomainId): Promise<ExerciseCatalogItem | null> {
    try {
      const row = await this.database.getFirst<ExerciseRow>(
        `SELECT ${columns} FROM exercise_catalog_item WHERE id = ?`,
        [id.value],
      );
      return row === null ? null : mapRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  getByIds(ids: readonly DomainId[]) {
    if (ids.length === 0) return Promise.resolve(Object.freeze([]));
    return this.readMany(
      `SELECT ${columns} FROM exercise_catalog_item WHERE id IN (${ids.map(() => '?').join(', ')}) ORDER BY id ASC`,
      ids.map((id) => id.value),
    );
  }

  findByNormalizedName(normalizedName: string) {
    return this.readMany(
      `SELECT ${columns} FROM exercise_catalog_item WHERE normalized_name = ? ORDER BY id ASC`,
      [normalizedName],
    );
  }

  search(normalizedQuery: string, limit: number) {
    return this.readMany(
      `SELECT ${columns} FROM exercise_catalog_item WHERE normalized_name LIKE ? ESCAPE '\\' ORDER BY is_favorite DESC, normalized_name ASC, id ASC LIMIT ?`,
      [`%${escapeExerciseSearch(normalizedQuery)}%`, limit],
    );
  }

  listAll(limit: number) {
    return this.readMany(
      `SELECT ${columns} FROM exercise_catalog_item ORDER BY normalized_name ASC, id ASC LIMIT ?`,
      [limit],
    );
  }

  listFavorites(limit: number) {
    return this.readMany(
      `SELECT ${columns} FROM exercise_catalog_item WHERE is_favorite = 1 ORDER BY normalized_name ASC, id ASC LIMIT ?`,
      [limit],
    );
  }

  async insert(item: ExerciseCatalogItem): Promise<void> {
    await this.write(
      `INSERT INTO exercise_catalog_item (${columns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
          mapRow,
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

function mapRow(row: ExerciseRow): ExerciseCatalogItem {
  const id = DomainId.create(row.id);
  if (
    isErr(id) ||
    normalizeExerciseName(row.display_name) !== row.normalized_name
  )
    throw new PersistenceError('operation-failed');
  const definition = ExerciseDefinition.create({
    equipment: row.equipment,
    id: id.value,
    loggingMode: row.logging_mode,
    name: row.display_name,
    notes: row.notes,
    primaryMuscleGroup: row.primary_muscle_group,
  });
  const item = definition.isSuccess
    ? ExerciseCatalogItem.create({
        definition: definition.value,
        isFavorite: row.is_favorite === 1,
      })
    : definition;
  if (isErr(item) || (row.is_favorite !== 0 && row.is_favorite !== 1))
    throw new PersistenceError('operation-failed');
  return item.value;
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
