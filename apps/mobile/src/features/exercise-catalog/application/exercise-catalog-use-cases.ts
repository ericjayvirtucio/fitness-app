import { DomainError, DomainId, isErr } from '@fitness/domain';
import {
  buildExerciseCatalogItem,
  type SaveExerciseInput,
} from './build-exercise-catalog-item';
import type { ExerciseCatalogItem } from './exercise-catalog-item';
import { normalizeExerciseName } from './exercise-catalog-name';
import type { ExerciseCatalogRepository } from './exercise-catalog-repository';

export type ExerciseSaveOutcome =
  | Readonly<{ error: DomainError; status: 'invalid' }>
  | Readonly<{
      item: ExerciseCatalogItem;
      matches: readonly ExerciseCatalogItem[];
      status: 'duplicate';
    }>
  | Readonly<{ item: ExerciseCatalogItem; status: 'saved' }>;

export class CreateExerciseUseCase {
  constructor(
    private readonly repository: ExerciseCatalogRepository,
    private readonly generateId: () => string,
  ) {}

  async execute(
    input: SaveExerciseInput,
    allowDuplicate = false,
  ): Promise<ExerciseSaveOutcome> {
    const item = buildExerciseCatalogItem(this.generateId(), input);
    if (isErr(item)) return { error: item.error, status: 'invalid' };
    const matches = await this.repository.findByNormalizedName(
      normalizeExerciseName(item.value.definition.name),
    );
    if (!allowDuplicate && matches.length > 0)
      return { item: item.value, matches, status: 'duplicate' };
    await this.repository.insert(item.value);
    return { item: item.value, status: 'saved' };
  }
}

export class UpdateExerciseUseCase {
  constructor(private readonly repository: ExerciseCatalogRepository) {}

  async execute(
    idValue: unknown,
    input: SaveExerciseInput,
    allowDuplicate = false,
  ): Promise<ExerciseSaveOutcome> {
    const id = DomainId.create(idValue);
    if (isErr(id)) return { error: id.error, status: 'invalid' };
    const existing = await this.repository.getById(id.value);
    if (existing === null) return missing();
    const item = buildExerciseCatalogItem(id.value.value, input);
    if (isErr(item)) return { error: item.error, status: 'invalid' };
    const matches = (
      await this.repository.findByNormalizedName(
        normalizeExerciseName(item.value.definition.name),
      )
    ).filter((candidate) => candidate.definition.id.value !== id.value.value);
    if (!allowDuplicate && matches.length > 0)
      return { item: item.value, matches, status: 'duplicate' };
    return (await this.repository.update(item.value))
      ? { item: item.value, status: 'saved' }
      : missing();
  }
}

export class GetExerciseUseCase {
  constructor(private readonly repository: ExerciseCatalogRepository) {}
  async execute(idValue: unknown) {
    const id = DomainId.create(idValue);
    return isErr(id) ? null : this.repository.getById(id.value);
  }
}

export class DeleteExerciseUseCase {
  constructor(private readonly repository: ExerciseCatalogRepository) {}
  async execute(idValue: unknown): Promise<boolean> {
    const id = DomainId.create(idValue);
    return isErr(id) ? false : this.repository.delete(id.value);
  }
}

export class BrowseExercisesUseCase {
  constructor(private readonly repository: ExerciseCatalogRepository) {}
  listAll(limit = 100) {
    return this.repository.listAll(limit);
  }
  listFavorites(limit = 20) {
    return this.repository.listFavorites(limit);
  }
  search(query: string, limit = 50) {
    const normalized = normalizeExerciseName(query);
    return normalized === ''
      ? Promise.resolve(Object.freeze([]))
      : this.repository.search(normalized, limit);
  }
}

export class SetExerciseFavoriteUseCase {
  constructor(private readonly repository: ExerciseCatalogRepository) {}
  async execute(idValue: unknown, isFavorite: boolean): Promise<boolean> {
    const id = DomainId.create(idValue);
    return isErr(id)
      ? false
      : this.repository.setFavorite(id.value, isFavorite);
  }
}

function missing(): ExerciseSaveOutcome {
  return {
    error: DomainError.create(
      'invalid-identifier',
      'Exercise no longer exists.',
      'id',
    ),
    status: 'invalid',
  };
}
