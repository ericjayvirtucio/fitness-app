import { DomainId, ExerciseDefinition, Weekday } from '@fitness/domain';
import type { ExerciseCatalogRepository } from './exercise-catalog-repository';
import { ExerciseCatalogItem } from './exercise-catalog-item';
import {
  BrowseExercisesUseCase,
  CreateExerciseUseCase,
  DeleteExerciseUseCase,
  SetExerciseFavoriteUseCase,
  UpdateExerciseUseCase,
} from './exercise-catalog-use-cases';
import type { ExerciseCatalogMutationContext } from './exercise-catalog-use-cases';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import {
  escapeExerciseSearch,
  normalizeExerciseName,
} from './exercise-catalog-name';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

function input(name = 'Bench Press') {
  return {
    equipment: 'barbell',
    isFavorite: false,
    loggingMode: 'external-load-and-repetitions',
    name,
    notes: '',
    primaryMuscleGroup: 'chest',
  } as const;
}

function item(name = 'Bench Press') {
  const id = DomainId.create(uuid);
  if (!id.isSuccess) throw new Error('Invalid fixture');
  const definition = ExerciseDefinition.create({
    ...input(name),
    id: id.value,
  });
  if (!definition.isSuccess) throw new Error('Invalid fixture');
  const result = ExerciseCatalogItem.create({
    definition: definition.value,
    isFavorite: false,
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

class MemoryRepository implements ExerciseCatalogRepository {
  values: ExerciseCatalogItem[] = [];
  delete = jest.fn((id: DomainId) => {
    const index = this.values.findIndex((value) =>
      value.definition.id.equals(id),
    );
    if (index < 0) return Promise.resolve(false);
    this.values.splice(index, 1);
    return Promise.resolve(true);
  });
  findByNormalizedName = jest.fn((name: string) =>
    Promise.resolve(
      this.values.filter(
        (value) => normalizeExerciseName(value.definition.name) === name,
      ),
    ),
  );
  getById = jest.fn((id: DomainId) =>
    Promise.resolve(
      this.values.find((value) => value.definition.id.equals(id)) ?? null,
    ),
  );
  getByIds = jest.fn((ids: readonly DomainId[]) =>
    Promise.resolve(
      this.values.filter((value) =>
        ids.some((id) => value.definition.id.equals(id)),
      ),
    ),
  );
  insert = jest.fn((value: ExerciseCatalogItem) => {
    this.values.push(value);
    return Promise.resolve();
  });
  listAll = jest.fn(() => Promise.resolve(this.values));
  listFavorites = jest.fn(() =>
    Promise.resolve(this.values.filter((value) => value.isFavorite)),
  );
  search = jest.fn((query: string) =>
    Promise.resolve(
      this.values.filter((value) =>
        normalizeExerciseName(value.definition.name).includes(query),
      ),
    ),
  );
  setFavorite = jest.fn(() => Promise.resolve(true));
  update = jest.fn((value: ExerciseCatalogItem) => {
    this.values = [value];
    return Promise.resolve(true);
  });
}

describe('exercise catalog application', () => {
  it('normalizes names and escapes literal search wildcards', () => {
    expect(normalizeExerciseName('  Bench\n Press ')).toBe('bench press');
    expect(escapeExerciseSearch('100%_\\')).toBe('100\\%\\_\\\\');
  });

  it('creates a validated exercise with an injected identifier', async () => {
    const repository = new MemoryRepository();
    const result = await new CreateExerciseUseCase(
      repository,
      () => uuid,
    ).execute(input());
    expect(result.status).toBe('saved');
    expect(repository.insert).toHaveBeenCalledTimes(1);
  });

  it('warns for exact normalized duplicates but permits explicit confirmation', async () => {
    const repository = new MemoryRepository();
    repository.values = [item()];
    const useCase = new CreateExerciseUseCase(repository, () => uuid);
    await expect(
      useCase.execute(input('  BENCH   PRESS ')),
    ).resolves.toMatchObject({ status: 'duplicate' });
    await expect(useCase.execute(input(), true)).resolves.toMatchObject({
      status: 'saved',
    });
  });

  it('updates explicit favorite metadata and excludes itself from duplicates', async () => {
    const repository = new MemoryRepository();
    const existing = item();
    const favorite = ExerciseCatalogItem.create({
      definition: existing.definition,
      isFavorite: true,
    });
    if (!favorite.isSuccess) throw new Error('Invalid fixture');
    repository.values = [favorite.value];
    const result = await new UpdateExerciseUseCase(repository).execute(
      uuid,
      input('Incline Bench Press'),
    );
    expect(result.status).toBe('saved');
    expect(repository.values[0]?.isFavorite).toBe(false);
  });

  it('derives performed recents and supports favorite and deletion commands', async () => {
    const repository = new MemoryRepository();
    repository.values = [item()];
    const browse = new BrowseExercisesUseCase(repository, {
      listRecentlyPerformedExerciseIds: () =>
        Promise.resolve([item().definition.id]),
    });
    await expect(browse.search(' BENCH ')).resolves.toHaveLength(1);
    await expect(browse.search('   ')).resolves.toEqual([]);
    await expect(browse.listRecentlyPerformed()).resolves.toHaveLength(1);
    await expect(
      new SetExerciseFavoriteUseCase(repository).execute(uuid, true),
    ).resolves.toBe(true);
    await expect(
      new DeleteExerciseUseCase(repository).execute(uuid),
    ).resolves.toEqual({ status: 'deleted' });
  });

  it('propagates validation without writing', async () => {
    const repository = new MemoryRepository();
    const result = await new CreateExerciseUseCase(
      repository,
      () => uuid,
    ).execute({ ...input(), name: '' });
    expect(result).toMatchObject({
      status: 'invalid',
      error: { field: 'name' },
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('blocks referenced deletion and logging-mode changes', async () => {
    const repository = new MemoryRepository();
    repository.values = [item()];
    const runner: TransactionRunner<ExerciseCatalogMutationContext> = {
      run: (operation) =>
        operation({
          catalog: repository,
          references: {
            listUsages: () =>
              Promise.resolve([
                {
                  weekday: weekday(1),
                  workoutName: 'Push Day',
                },
              ]),
          },
        }),
    };
    await expect(
      new DeleteExerciseUseCase(repository, runner).execute(uuid),
    ).resolves.toMatchObject({ status: 'referenced' });
    expect(repository.delete).not.toHaveBeenCalled();
    await expect(
      new UpdateExerciseUseCase(repository, runner).execute(uuid, {
        ...input(),
        loggingMode: 'repetitions',
      }),
    ).resolves.toMatchObject({ status: 'referenced' });
    expect(repository.update).not.toHaveBeenCalled();
  });
});

function weekday(value: number) {
  const result = Weekday.create(value);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}
