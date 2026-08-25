import {
  DomainId,
  ExerciseDefinition,
  Weekday,
  type ExerciseEquipment,
  type ExerciseMuscleGroup,
} from '@fitness/domain';
import {
  createExerciseCatalogFilter,
  type ExerciseCatalogFilter,
} from './exercise-catalog-filter';
import type { ExerciseCatalogRepository } from './exercise-catalog-repository';
import { ExerciseCatalogItem } from './exercise-catalog-item';
import {
  BrowseExercisesUseCase,
  CreateExerciseUseCase,
  DeleteExerciseUseCase,
  SetExerciseFavoriteUseCase,
  UpdateExerciseUseCase,
  exerciseBrowseLimit,
  exerciseSearchLimit,
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
  listAll = jest.fn((limit: number, filter?: ExerciseCatalogFilter) =>
    Promise.resolve(this.matching(filter).slice(0, limit)),
  );
  listFavorites = jest.fn(() =>
    Promise.resolve(this.values.filter((value) => value.isFavorite)),
  );
  restore = jest.fn(() => Promise.resolve(false));
  search = jest.fn(
    (query: string, limit: number, filter?: ExerciseCatalogFilter) =>
      Promise.resolve(
        this.matching(filter)
          .filter((value) =>
            normalizeExerciseName(value.definition.name).includes(query),
          )
          .slice(0, limit),
      ),
  );
  private matching(filter?: ExerciseCatalogFilter) {
    return this.values.filter(
      (value) =>
        (filter?.equipment == null ||
          value.definition.equipment === filter.equipment) &&
        (filter?.primaryMuscleGroup == null ||
          value.definition.primaryMuscleGroup === filter.primaryMuscleGroup),
    );
  }
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

describe('browsing a narrowed exercise catalog', () => {
  function catalog() {
    const repository = new MemoryRepository();
    repository.values = [
      classified('a', 'Dumbbell Bench Press', 'dumbbell', 'chest'),
      classified('b', 'Dumbbell Fly', 'dumbbell', 'chest'),
      classified('c', 'Dumbbell Curl', 'dumbbell', 'biceps'),
      classified('d', 'Barbell Bench Press', 'barbell', 'chest'),
      classified('e', 'Cable Row', 'cable', 'back'),
    ];
    return repository;
  }
  const names = (items: readonly ExerciseCatalogItem[]) =>
    items.map((value) => value.definition.name);

  it('browses everything exactly as before when nothing is narrowed', async () => {
    const repository = catalog();
    const browse = new BrowseExercisesUseCase(repository);
    await expect(browse.listAll()).resolves.toHaveLength(5);
    expect(repository.listAll).toHaveBeenCalledWith(exerciseBrowseLimit, {
      equipment: null,
      primaryMuscleGroup: null,
    });
    await expect(browse.search('bench')).resolves.toHaveLength(2);
    expect(repository.search).toHaveBeenCalledWith(
      'bench',
      exerciseSearchLimit,
      { equipment: null, primaryMuscleGroup: null },
    );
  });

  it('narrows by equipment', async () => {
    const items = await new BrowseExercisesUseCase(catalog()).listAll({
      equipment: 'dumbbell',
      primaryMuscleGroup: null,
    });
    expect(names(items)).toEqual([
      'Dumbbell Bench Press',
      'Dumbbell Fly',
      'Dumbbell Curl',
    ]);
  });

  it('narrows by primary muscle group', async () => {
    const items = await new BrowseExercisesUseCase(catalog()).listAll({
      equipment: null,
      primaryMuscleGroup: 'chest',
    });
    expect(names(items)).toEqual([
      'Dumbbell Bench Press',
      'Dumbbell Fly',
      'Barbell Bench Press',
    ]);
  });

  it('requires both criteria to hold when both are narrowed', async () => {
    const items = await new BrowseExercisesUseCase(catalog()).listAll({
      equipment: 'dumbbell',
      primaryMuscleGroup: 'chest',
    });
    expect(names(items)).toEqual(['Dumbbell Bench Press', 'Dumbbell Fly']);
  });

  it('applies a search and a filter together', async () => {
    const items = await new BrowseExercisesUseCase(catalog()).search('bench', {
      equipment: 'dumbbell',
      primaryMuscleGroup: null,
    });
    expect(names(items)).toEqual(['Dumbbell Bench Press']);
  });

  it('returns nothing rather than everything when a filter matches nothing', async () => {
    const browse = new BrowseExercisesUseCase(catalog());
    await expect(
      browse.listAll({
        equipment: 'dumbbell',
        primaryMuscleGroup: 'calves',
      }),
    ).resolves.toEqual([]);
    await expect(
      browse.search('bench', {
        equipment: 'cable',
        primaryMuscleGroup: null,
      }),
    ).resolves.toEqual([]);
  });

  it('keeps every narrowed read bounded', async () => {
    const repository = catalog();
    const browse = new BrowseExercisesUseCase(repository);
    const filter = { equipment: 'dumbbell', primaryMuscleGroup: null } as const;
    await expect(browse.listAll(filter, 2)).resolves.toHaveLength(2);
    await expect(browse.search('dumbbell', filter, 1)).resolves.toHaveLength(1);
    expect(repository.listAll).toHaveBeenCalledWith(2, filter);
    expect(repository.search).toHaveBeenCalledWith('dumbbell', 1, filter);
  });

  it('never reaches storage for a blank query, narrowed or not', async () => {
    const repository = catalog();
    await expect(
      new BrowseExercisesUseCase(repository).search('   ', {
        equipment: 'dumbbell',
        primaryMuscleGroup: null,
      }),
    ).resolves.toEqual([]);
    expect(repository.search).not.toHaveBeenCalled();
  });

  it('cannot pass a value outside the vocabulary to the repository', async () => {
    const repository = catalog();
    await new BrowseExercisesUseCase(repository).listAll(
      createExerciseCatalogFilter({
        equipment: "dumbbell' OR 1=1 --",
        primaryMuscleGroup: 'chest',
      }),
    );
    expect(repository.listAll).toHaveBeenCalledWith(exerciseBrowseLimit, {
      equipment: null,
      primaryMuscleGroup: 'chest',
    });
  });
});

function classified(
  suffix: string,
  name: string,
  equipment: ExerciseEquipment,
  primaryMuscleGroup: ExerciseMuscleGroup,
) {
  const id = DomainId.create(`550e8400-e29b-41d4-a716-44665544000${suffix}`);
  if (!id.isSuccess) throw new Error('Invalid fixture');
  const definition = ExerciseDefinition.create({
    equipment,
    id: id.value,
    loggingMode: 'external-load-and-repetitions',
    name,
    primaryMuscleGroup,
  });
  if (!definition.isSuccess) throw new Error('Invalid fixture');
  const result = ExerciseCatalogItem.create({
    definition: definition.value,
    isFavorite: false,
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function weekday(value: number) {
  const result = Weekday.create(value);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}
