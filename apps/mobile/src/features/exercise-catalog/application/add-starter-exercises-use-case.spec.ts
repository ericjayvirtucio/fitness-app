import type { DomainId } from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { AddStarterExercisesUseCase } from './add-starter-exercises-use-case';
import { buildExerciseCatalogItem } from './build-exercise-catalog-item';
import type { ExerciseCatalogItem } from './exercise-catalog-item';
import { normalizeExerciseName } from './exercise-catalog-name';
import type { ExerciseCatalogRepository } from './exercise-catalog-repository';
import type { StarterExerciseImportContext } from './starter-exercise-import-context';
import { starterExercises, type StarterExercise } from './starter-exercises';

class FakeCatalog implements ExerciseCatalogRepository {
  failOnInsert: string | null = null;
  readonly items: ExerciseCatalogItem[] = [];

  delete(): Promise<boolean> {
    throw new Error('Not used by the starter import.');
  }
  findByNormalizedName(normalizedName: string) {
    return Promise.resolve(
      Object.freeze(
        this.items.filter(
          (item) =>
            normalizeExerciseName(item.definition.name) === normalizedName,
        ),
      ),
    );
  }
  getById(id: DomainId) {
    return Promise.resolve(
      this.items.find((item) => item.definition.id.value === id.value) ?? null,
    );
  }
  getByIds(ids: readonly DomainId[]) {
    const wanted = new Set(ids.map((id) => id.value));
    return Promise.resolve(
      Object.freeze(
        this.items.filter((item) => wanted.has(item.definition.id.value)),
      ),
    );
  }
  insert(item: ExerciseCatalogItem): Promise<void> {
    if (this.failOnInsert === item.definition.name)
      return Promise.reject(new Error('Storage is unavailable.'));
    this.items.push(item);
    return Promise.resolve();
  }
  listAll() {
    return Promise.resolve(Object.freeze([...this.items]));
  }
  listFavorites() {
    return Promise.resolve(
      Object.freeze(this.items.filter((item) => item.isFavorite)),
    );
  }
  search() {
    return Promise.resolve(Object.freeze([]));
  }
  setFavorite(): Promise<boolean> {
    throw new Error('Not used by the starter import.');
  }
  update(): Promise<boolean> {
    throw new Error('Not used by the starter import.');
  }
}

/**
 * Rolls the catalog back the way an exclusive transaction does, so a refusal
 * caused by a failed write can be asserted to have changed nothing rather than
 * merely to have reported a failure.
 */
class RollingBackRunner implements TransactionRunner<StarterExerciseImportContext> {
  constructor(private readonly catalog: FakeCatalog) {}

  async run<TResult>(
    operation: (context: StarterExerciseImportContext) => Promise<TResult>,
  ): Promise<TResult> {
    const snapshot = [...this.catalog.items];
    try {
      return await operation({ catalog: this.catalog });
    } catch (error: unknown) {
      this.catalog.items.length = 0;
      this.catalog.items.push(...snapshot);
      throw error;
    }
  }
}

function item(entry: StarterExercise, name = entry.name, id = entry.id) {
  const built = buildExerciseCatalogItem(id, {
    equipment: entry.equipment,
    isFavorite: false,
    loggingMode: entry.loggingMode,
    name,
    primaryMuscleGroup: entry.primaryMuscleGroup,
  });
  if (!built.isSuccess) throw new Error('Invalid fixture');
  return built.value;
}

/**
 * A version 4 identifier, which is what a definition the person creates carries
 * and what a starter identifier can therefore never be.
 */
function authoredId(index: number): string {
  return `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
}

function firstEntry(): StarterExercise {
  const entry = starterExercises[0];
  if (entry === undefined) throw new Error('Invalid fixture');
  return entry;
}

describe('AddStarterExercisesUseCase', () => {
  let catalog: FakeCatalog;
  let useCase: AddStarterExercisesUseCase;

  beforeEach(() => {
    catalog = new FakeCatalog();
    useCase = new AddStarterExercisesUseCase(new RollingBackRunner(catalog));
  });

  it('adds every definition to an empty catalog', async () => {
    const outcome = await useCase.execute();

    expect(outcome).toEqual({
      addedCount: starterExercises.length,
      skippedCount: 0,
      status: 'imported',
    });
    expect(catalog.items).toHaveLength(starterExercises.length);
  });

  it('favorites nothing it adds', async () => {
    await useCase.execute();

    expect(catalog.items.every((stored) => !stored.isFavorite)).toBe(true);
  });

  it('leaves a definition the person authored under the same name alone', async () => {
    const entry = firstEntry();
    const authored = item(entry, entry.name, authoredId(0));
    catalog.items.push(authored);

    const outcome = await useCase.execute();

    expect(outcome).toEqual({
      addedCount: starterExercises.length - 1,
      skippedCount: 1,
      status: 'imported',
    });
    expect(catalog.items).toContain(authored);
    expect(
      catalog.items.filter(
        (stored) =>
          normalizeExerciseName(stored.definition.name) ===
          normalizeExerciseName(entry.name),
      ),
    ).toHaveLength(1);
  });

  it('skips an entry already held under a different name', async () => {
    const entry = firstEntry();
    // The identifier a restore brought back, renamed since it was imported
    // elsewhere. Only the identifier test can see it.
    catalog.items.push(item(entry, 'Renamed movement', entry.id));

    const outcome = await useCase.execute();

    expect(outcome).toEqual({
      addedCount: starterExercises.length - 1,
      skippedCount: 1,
      status: 'imported',
    });
    expect(
      catalog.items.some(
        (stored) => stored.definition.name === 'Renamed movement',
      ),
    ).toBe(true);
  });

  it('adds nothing the second time', async () => {
    await useCase.execute();

    const outcome = await useCase.execute();

    expect(outcome).toEqual({
      skippedCount: starterExercises.length,
      status: 'unchanged',
    });
    expect(catalog.items).toHaveLength(starterExercises.length);
  });

  it('reports that nothing was added when every name is already held', async () => {
    starterExercises.forEach((entry, index) => {
      catalog.items.push(item(entry, entry.name, authoredId(index)));
    });

    const outcome = await useCase.execute();

    expect(outcome).toEqual({
      skippedCount: starterExercises.length,
      status: 'unchanged',
    });
  });

  it('refuses invalid content without writing anything', async () => {
    const invalid = new AddStarterExercisesUseCase(
      new RollingBackRunner(catalog),
      [{ ...firstEntry(), name: '   ' }],
    );

    const outcome = await invalid.execute();

    expect(outcome).toEqual({ reason: 'content-invalid', status: 'refused' });
    expect(catalog.items).toHaveLength(0);
  });

  it('preserves the previous catalog when a write fails', async () => {
    const entry = firstEntry();
    const authored = item(
      entry,
      'Authored movement',
      '22222222-2222-4222-8222-222222222222',
    );
    catalog.items.push(authored);
    const failing = starterExercises[3];
    if (failing === undefined) throw new Error('Invalid fixture');
    catalog.failOnInsert = failing.name;

    const outcome = await useCase.execute();

    expect(outcome).toEqual({ reason: 'write-failed', status: 'refused' });
    expect(catalog.items).toEqual([authored]);
  });
});
