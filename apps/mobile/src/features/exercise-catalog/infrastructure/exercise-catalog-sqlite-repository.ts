import type { DomainId } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { queueOutboxEntry } from '../../../infrastructure/persistence/sync-outbox';
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

const tableName = 'exercise_catalog_item';

export class ExerciseCatalogSqliteRepository implements ExerciseCatalogRepository {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly deviceId: string,
    private readonly now: () => Date,
  ) {}

  async getById(id: DomainId): Promise<ExerciseCatalogItem | null> {
    try {
      const row = await this.database.getFirst<ExerciseRow>(
        `SELECT ${exerciseColumns} FROM exercise_catalog_item
         WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
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
      `SELECT ${exerciseColumns} FROM exercise_catalog_item WHERE id IN (${ids.map(() => '?').join(', ')}) AND deleted_at_epoch_ms IS NULL ORDER BY id ASC`,
      ids.map((id) => id.value),
    );
  }

  findByNormalizedName(normalizedName: string) {
    return this.readMany(
      `SELECT ${exerciseColumns} FROM exercise_catalog_item WHERE normalized_name = ? AND deleted_at_epoch_ms IS NULL ORDER BY id ASC`,
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
      `SELECT ${exerciseColumns} FROM exercise_catalog_item WHERE is_favorite = 1 AND deleted_at_epoch_ms IS NULL ORDER BY normalized_name ASC, id ASC LIMIT ?`,
      [limit],
    );
  }

  async insert(item: ExerciseCatalogItem): Promise<void> {
    const nowEpochMs = this.now().getTime();
    await this.write(
      `INSERT INTO exercise_catalog_item (
        ${exerciseColumns}, updated_at_epoch_ms, deleted_at_epoch_ms,
        revision, originating_device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)`,
      [...parameters(item), nowEpochMs, this.deviceId],
    );
    await queueOutboxEntry(
      this.database,
      tableName,
      item.definition.id.value,
      'upsert',
      1,
      nowEpochMs,
    );
  }

  async update(item: ExerciseCatalogItem): Promise<boolean> {
    if ((await this.getById(item.definition.id)) === null) return false;
    const values = parameters(item);
    const nowEpochMs = this.now().getTime();
    await this.write(
      `UPDATE exercise_catalog_item SET display_name = ?, normalized_name = ?,
        equipment = ?, primary_muscle_group = ?, logging_mode = ?, notes = ?,
        is_favorite = ?, updated_at_epoch_ms = ?, revision = revision + 1
       WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
      [...values.slice(1), nowEpochMs, item.definition.id.value],
    );
    await this.queueRevision(item.definition.id.value, 'upsert', nowEpochMs);
    return true;
  }

  async setFavorite(id: DomainId, isFavorite: boolean): Promise<boolean> {
    if ((await this.getById(id)) === null) return false;
    const nowEpochMs = this.now().getTime();
    await this.write(
      `UPDATE exercise_catalog_item SET is_favorite = ?,
        updated_at_epoch_ms = ?, revision = revision + 1
       WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
      [isFavorite ? 1 : 0, nowEpochMs, id.value],
    );
    await this.queueRevision(id.value, 'upsert', nowEpochMs);
    return true;
  }

  async delete(id: DomainId): Promise<boolean> {
    if ((await this.getById(id)) === null) return false;
    const nowEpochMs = this.now().getTime();
    await this.write(
      `UPDATE exercise_catalog_item SET deleted_at_epoch_ms = ?,
        updated_at_epoch_ms = ?, revision = revision + 1
       WHERE id = ? AND deleted_at_epoch_ms IS NULL`,
      [nowEpochMs, nowEpochMs, id.value],
    );
    await this.queueRevision(id.value, 'delete', nowEpochMs);
    return true;
  }

  private async queueRevision(
    id: string,
    operation: 'delete' | 'upsert',
    nowEpochMs: number,
  ): Promise<void> {
    const stored = await this.database.getFirst<{ revision: number }>(
      'SELECT revision FROM exercise_catalog_item WHERE id = ?',
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
