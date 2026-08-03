import { DomainId, Energy, Mass, NutritionFacts, isOk } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { NutritionCatalogItem } from '../application/nutrition-catalog-item';
import { NutritionCatalogSqliteRepository } from './nutrition-catalog-sqlite-repository';

class FakeDatabase implements DatabaseConnection {
  rows: readonly unknown[] = [];
  firstRow: unknown = null;
  readonly reads: { parameters: DatabaseParameters; statement: string }[] = [];
  readonly runs: { parameters: DatabaseParameters; statement: string }[] = [];
  exec(): Promise<void> {
    return Promise.resolve();
  }
  getAll<TResult>(
    statement: string,
    parameters: DatabaseParameters = [],
  ): Promise<readonly TResult[]> {
    this.reads.push({ parameters, statement });
    return Promise.resolve(this.rows as readonly TResult[]);
  }
  getFirst<TResult>(): Promise<TResult | null> {
    return Promise.resolve(this.firstRow as TResult | null);
  }
  getVersion(): Promise<number> {
    return Promise.resolve(5);
  }
  run(statement: string, parameters: DatabaseParameters = []): Promise<void> {
    this.runs.push({ parameters, statement });
    return Promise.resolve();
  }
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

const storedRow = {
  carbohydrate_grams: 2,
  display_name: 'Chicken adobo',
  energy_kilojoules: 418.4,
  fat_grams: 4,
  fiber_grams: null,
  id: '550e8400-e29b-41d4-a716-446655440000',
  is_favorite: 1,
  item_kind: 'food',
  last_used_at_epoch_ms: 100,
  normalized_name: 'chicken adobo',
  protein_grams: 8,
  provenance: 'provided',
  reference_amount: 100,
  reference_kind: 'mass',
  sodium_milligrams: 0,
  sugar_grams: 1,
  use_count: 2,
};

function createItem() {
  const id = DomainId.create(storedRow.id);
  const mass = Mass.create(100, 'gram');
  const energy = Energy.create(100, 'kilocalorie');
  if (!isOk(id) || !isOk(mass) || !isOk(energy)) {
    throw new Error('Invalid fixture.');
  }
  const facts = NutritionFacts.create({
    description: 'Chicken adobo',
    energy: energy.value,
    nutrients: {
      carbohydrateGrams: 2,
      fatGrams: 4,
      fiberGrams: null,
      proteinGrams: 8,
      sodiumMilligrams: 0,
      sugarGrams: 1,
    },
    provenance: 'provided',
    reference: { amount: mass.value, kind: 'mass' },
  });
  if (!isOk(facts)) throw new Error('Invalid fixture.');
  const item = NutritionCatalogItem.create({
    facts: facts.value,
    id: id.value,
    isFavorite: true,
    kind: 'food',
    lastUsedAtEpochMilliseconds: 100,
    useCount: 2,
  });
  if (!item.isSuccess) throw new Error('Invalid fixture.');
  return item.value;
}

describe('NutritionCatalogSqliteRepository', () => {
  it('reconstructs validated rows preserving unknown and zero', async () => {
    const database = new FakeDatabase();
    database.rows = [storedRow];
    const items = await new NutritionCatalogSqliteRepository(
      database,
    ).listRecent(10);

    expect(items[0]?.facts.nutrients.fiberGrams).toBeNull();
    expect(items[0]?.facts.nutrients.sodiumMilligrams).toBe(0);
    expect(items[0]?.isFavorite).toBe(true);
    expect(items[0]?.usage.useCount).toBe(2);
  });

  it('rejects corrupt dimension and normalized-name rows safely', async () => {
    const database = new FakeDatabase();
    const repository = new NutritionCatalogSqliteRepository(database);
    database.rows = [{ ...storedRow, reference_kind: 'volume' }];
    await expect(repository.listRecent(10)).rejects.toMatchObject({
      code: 'operation-failed',
    });

    database.rows = [{ ...storedRow, normalized_name: 'stale' }];
    await expect(repository.listRecent(10)).rejects.toMatchObject({
      code: 'operation-failed',
    });
  });

  it('inserts canonical values and normalized name with bound parameters', async () => {
    const database = new FakeDatabase();
    await new NutritionCatalogSqliteRepository(database).insert(createItem());

    expect(database.runs[0]?.statement).toContain(
      'INSERT INTO nutrition_catalog_item',
    );
    expect(database.runs[0]?.parameters).toEqual([
      storedRow.id,
      'food',
      'Chicken adobo',
      'chicken adobo',
      'mass',
      100,
      418.40000000000003,
      8,
      2,
      4,
      null,
      1,
      0,
      'provided',
      1,
      100,
      2,
    ]);
  });

  it('uses focused bounded search, favorite, recent, and exact queries', async () => {
    const database = new FakeDatabase();
    const repository = new NutritionCatalogSqliteRepository(database);
    await repository.search('100%_rice', 50);
    await repository.listFavorites(10);
    await repository.listRecent(10);
    await repository.findByNormalizedName('rice');

    expect(database.reads[0]?.parameters).toEqual(['%100\\%\\_rice%', 50]);
    expect(database.reads[0]?.statement).toContain("ESCAPE '\\'");
    expect(database.reads[1]?.statement).toContain('WHERE is_favorite = 1');
    expect(database.reads[2]?.statement).toContain(
      'ORDER BY last_used_at_epoch_ms DESC',
    );
    expect(database.reads[3]?.statement).toContain('WHERE normalized_name = ?');
  });

  it('updates favorite and usage only for existing rows', async () => {
    const database = new FakeDatabase();
    database.firstRow = storedRow;
    const repository = new NutritionCatalogSqliteRepository(database);
    const id = DomainId.create(storedRow.id);
    if (!isOk(id)) throw new Error('Invalid fixture.');

    await expect(repository.setFavorite(id.value, false)).resolves.toBe(true);
    await expect(repository.recordUsage(id.value, 200)).resolves.toBe(true);
    expect(database.runs[0]?.parameters).toEqual([0, storedRow.id]);
    expect(database.runs[1]?.parameters).toEqual([200, storedRow.id]);
  });
});
