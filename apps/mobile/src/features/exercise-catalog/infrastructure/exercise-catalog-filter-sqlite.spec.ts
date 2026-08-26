import type { ExerciseEquipment, ExerciseMuscleGroup } from '@fitness/domain';
import { initializeDatabase } from '../../../infrastructure/persistence/database-initializer';
import { migrations } from '../../../infrastructure/persistence/migrations';
import { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { buildExerciseCatalogItem } from '../application/build-exercise-catalog-item';
import type { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import { ExerciseCatalogSqliteRepository } from './exercise-catalog-sqlite-repository';

const deviceId = 'device-a';
const now = () => new Date();

/**
 * Narrowing is an engine property, not an orchestration one. Only a real engine
 * can show that one statement returns exactly the matching rows, that narrowing
 * never disturbs the ordering browsing already had, and that a read leaves the
 * schema and every other table alone, so these run against the repository's own
 * migrations rather than against a fake.
 */

type CountRow = Readonly<{ total: number }>;

const catalogFixture = [
  ['Barbell Bench Press', 'barbell', 'chest'],
  ['Cable Row', 'cable', 'back'],
  ['Dumbbell Bench Press', 'dumbbell', 'chest'],
  ['Dumbbell Biceps Curl', 'dumbbell', 'biceps'],
  ['Dumbbell Fly', 'dumbbell', 'chest'],
] as const;

function fixtureItem(
  index: number,
  name: string,
  equipment: ExerciseEquipment,
  primaryMuscleGroup: ExerciseMuscleGroup,
): ExerciseCatalogItem {
  const built = buildExerciseCatalogItem(
    `550e8400-e29b-41d4-a716-4466554400${String(index).padStart(2, '0')}`,
    {
      equipment,
      isFavorite: index === 0,
      loggingMode: 'external-load-and-repetitions',
      name,
      primaryMuscleGroup,
    },
  );
  if (!built.isSuccess) throw new Error('Invalid fixture');
  return built.value;
}

describe('Narrowed exercise catalog reads on a real database', () => {
  let database: NodeSqliteDatabase;
  let repository: ExerciseCatalogSqliteRepository;

  const names = (items: readonly ExerciseCatalogItem[]) =>
    items.map((item) => item.definition.name);

  beforeEach(async () => {
    database = new NodeSqliteDatabase();
    await initializeDatabase(database, migrations);
    repository = new ExerciseCatalogSqliteRepository(database, deviceId, now);
    let index = 0;
    for (const [name, equipment, muscle] of catalogFixture) {
      await repository.insert(fixtureItem(index, name, equipment, muscle));
      index += 1;
    }
  });

  afterEach(() => {
    database.close();
  });

  it('returns only the rows matching an equipment filter', async () => {
    const items = await repository.listAll(100, {
      equipment: 'dumbbell',
      primaryMuscleGroup: null,
    });
    expect(names(items)).toEqual([
      'Dumbbell Bench Press',
      'Dumbbell Biceps Curl',
      'Dumbbell Fly',
    ]);
  });

  it('returns only the rows matching a muscle-group filter', async () => {
    const items = await repository.listAll(100, {
      equipment: null,
      primaryMuscleGroup: 'chest',
    });
    expect(names(items)).toEqual([
      'Barbell Bench Press',
      'Dumbbell Bench Press',
      'Dumbbell Fly',
    ]);
  });

  it('requires both criteria to hold when both are narrowed', async () => {
    const items = await repository.listAll(100, {
      equipment: 'dumbbell',
      primaryMuscleGroup: 'chest',
    });
    expect(names(items)).toEqual(['Dumbbell Bench Press', 'Dumbbell Fly']);
  });

  it('applies a filter and a search in the same query', async () => {
    const items = await repository.search('bench', 50, {
      equipment: 'dumbbell',
      primaryMuscleGroup: null,
    });
    expect(names(items)).toEqual(['Dumbbell Bench Press']);
  });

  it('returns nothing rather than everything when nothing matches', async () => {
    await expect(
      repository.listAll(100, {
        equipment: 'dumbbell',
        primaryMuscleGroup: 'calves',
      }),
    ).resolves.toEqual([]);
    await expect(
      repository.search('bench', 50, {
        equipment: 'cable',
        primaryMuscleGroup: null,
      }),
    ).resolves.toEqual([]);
  });

  it('orders narrowed rows exactly as unnarrowed ones', async () => {
    const all = await repository.listAll(100);
    const narrowed = await repository.listAll(100, {
      equipment: null,
      primaryMuscleGroup: 'chest',
    });
    expect(names(narrowed)).toEqual(
      names(all).filter((name) => names(narrowed).includes(name)),
    );
    // The favorite-first search ordering survives narrowing too: "Barbell Bench
    // Press" is the only favorited fixture and stays ahead of the alphabetically
    // earlier match it would otherwise follow.
    const searched = await repository.search('bench', 50, {
      equipment: null,
      primaryMuscleGroup: 'chest',
    });
    expect(names(searched)).toEqual([
      'Barbell Bench Press',
      'Dumbbell Bench Press',
    ]);
  });

  it('keeps a narrowed read bounded', async () => {
    const items = await repository.listAll(2, {
      equipment: 'dumbbell',
      primaryMuscleGroup: null,
    });
    expect(names(items)).toEqual([
      'Dumbbell Bench Press',
      'Dumbbell Biceps Curl',
    ]);
  });

  it('changes nothing: no row, no other table, no schema version', async () => {
    const before = await database.getAll<CountRow>(
      'SELECT COUNT(*) AS total FROM exercise_catalog_item',
    );
    await repository.listAll(100, {
      equipment: 'dumbbell',
      primaryMuscleGroup: 'chest',
    });
    await repository.search('bench', 50, {
      equipment: 'dumbbell',
      primaryMuscleGroup: null,
    });

    await expect(
      database.getAll<CountRow>(
        'SELECT COUNT(*) AS total FROM exercise_catalog_item',
      ),
    ).resolves.toEqual(before);
    for (const table of [
      'planned_exercise',
      'workout_session',
      'workout_set',
    ]) {
      await expect(
        database.getAll<CountRow>(`SELECT COUNT(*) AS total FROM ${table}`),
      ).resolves.toEqual([{ total: 0 }]);
    }
    await expect(database.getVersion()).resolves.toBe(13);
  });
});
