import { DomainError, DomainId, isErr } from '@fitness/domain';
import {
  buildExerciseCatalogItem,
  type SaveExerciseInput,
} from './build-exercise-catalog-item';
import {
  noExerciseCatalogFilter,
  type ExerciseCatalogFilter,
} from './exercise-catalog-filter';
import type { ExerciseCatalogItem } from './exercise-catalog-item';
import { normalizeExerciseName } from './exercise-catalog-name';
import type { ExerciseCatalogRepository } from './exercise-catalog-repository';
import type {
  ExercisePlanReferenceReader,
  PlannedExerciseUsage,
} from './exercise-plan-reference-reader';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type { PerformedExerciseRecentReader } from './performed-exercise-recent-reader';

export type ExerciseSaveOutcome =
  | Readonly<{ error: DomainError; status: 'invalid' }>
  | Readonly<{
      item: ExerciseCatalogItem;
      matches: readonly ExerciseCatalogItem[];
      status: 'duplicate';
    }>
  | Readonly<{ item: ExerciseCatalogItem; status: 'saved' }>;

export type ExerciseUpdateOutcome =
  | ExerciseSaveOutcome
  | Readonly<{
      item: ExerciseCatalogItem;
      status: 'referenced';
      usages: readonly PlannedExerciseUsage[];
    }>;

export type ExerciseDeleteOutcome =
  | Readonly<{ status: 'deleted' }>
  | Readonly<{ status: 'missing' }>
  | Readonly<{
      status: 'referenced';
      usages: readonly PlannedExerciseUsage[];
    }>;

export type ExerciseCatalogMutationContext = Readonly<{
  catalog: ExerciseCatalogRepository;
  references: ExercisePlanReferenceReader;
}>;

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
  constructor(
    private readonly repository: ExerciseCatalogRepository,
    private readonly transactionRunner?: TransactionRunner<ExerciseCatalogMutationContext>,
  ) {}

  async execute(
    idValue: unknown,
    input: SaveExerciseInput,
    allowDuplicate = false,
  ): Promise<ExerciseUpdateOutcome> {
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
    if (
      this.transactionRunner &&
      existing.definition.loggingMode !== item.value.definition.loggingMode
    ) {
      const outcome = await this.transactionRunner.run(
        async ({ catalog, references }): Promise<ExerciseUpdateOutcome> => {
          const usages = await references.listUsages(id.value);
          if (usages.length > 0)
            return { item: item.value, status: 'referenced', usages };
          return (await catalog.update(item.value))
            ? { item: item.value, status: 'saved' }
            : missing();
        },
      );
      return outcome;
    }
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
  constructor(
    private readonly repository: ExerciseCatalogRepository,
    private readonly transactionRunner?: TransactionRunner<ExerciseCatalogMutationContext>,
  ) {}
  async execute(idValue: unknown): Promise<ExerciseDeleteOutcome> {
    const id = DomainId.create(idValue);
    if (isErr(id)) return { status: 'missing' };
    if (!this.transactionRunner)
      return (await this.repository.delete(id.value))
        ? { status: 'deleted' }
        : { status: 'missing' };
    return this.transactionRunner.run(async ({ catalog, references }) => {
      const usages = await references.listUsages(id.value);
      if (usages.length > 0) return { status: 'referenced', usages };
      return (await catalog.delete(id.value))
        ? { status: 'deleted' }
        : { status: 'missing' };
    });
  }
}

export class BrowseExercisesUseCase {
  constructor(
    private readonly repository: ExerciseCatalogRepository,
    private readonly recentReader?: PerformedExerciseRecentReader,
  ) {}
  listAll(
    limit = 100,
    filter: ExerciseCatalogFilter = noExerciseCatalogFilter,
  ) {
    return this.repository.listAll(limit, filter);
  }
  listFavorites(limit = 20) {
    return this.repository.listFavorites(limit);
  }
  async listRecentlyPerformed(limit = 10) {
    if (!this.recentReader) return Object.freeze([]);
    const ids = await this.recentReader.listRecentlyPerformedExerciseIds(limit);
    const items = await this.repository.getByIds(ids);
    const byId = new Map(items.map((item) => [item.definition.id.value, item]));
    return Object.freeze(
      ids.flatMap((id) => {
        const item = byId.get(id.value);
        return item ? [item] : [];
      }),
    );
  }
  search(
    query: string,
    limit = 50,
    filter: ExerciseCatalogFilter = noExerciseCatalogFilter,
  ) {
    const normalized = normalizeExerciseName(query);
    return normalized === ''
      ? Promise.resolve(Object.freeze([]))
      : this.repository.search(normalized, limit, filter);
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
