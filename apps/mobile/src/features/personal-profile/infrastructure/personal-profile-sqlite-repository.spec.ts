import { UserProfile, isOk } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { PersonalProfileSqliteRepository } from './personal-profile-sqlite-repository';

class FakeDatabase implements DatabaseConnection {
  runError: Error | undefined;
  row: unknown = null;
  readonly runs: { parameters: DatabaseParameters; statement: string }[] = [];

  exec(): Promise<void> {
    return Promise.resolve();
  }
  getFirst<TResult>(): Promise<TResult | null> {
    return Promise.resolve(this.row as TResult | null);
  }
  getAll<TResult>(): Promise<readonly TResult[]> {
    return Promise.resolve([]);
  }
  getVersion(): Promise<number> {
    return Promise.resolve(2);
  }
  run(statement: string, parameters: DatabaseParameters = []): Promise<void> {
    if (this.runError) return Promise.reject(this.runError);
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
  activity_level: 'moderately-active',
  biological_sex: 'female',
  date_of_birth: '1990-06-15',
  height_millimeters: 1_650,
  preferred_unit_system: 'metric',
  weight_grams: 62_000,
};

describe('PersonalProfileSqliteRepository', () => {
  it('returns null when no profile exists', async () => {
    const repository = new PersonalProfileSqliteRepository(new FakeDatabase());
    await expect(repository.get()).resolves.toBeNull();
  });

  it('maps and validates a stored profile', async () => {
    const database = new FakeDatabase();
    database.row = storedRow;
    const profile = await new PersonalProfileSqliteRepository(database).get();
    expect(profile?.height.millimeters).toBe(1_650);
  });

  it('rejects invalid stored values with a safe persistence error', async () => {
    const database = new FakeDatabase();
    database.row = { ...storedRow, biological_sex: 'unsupported' };
    await expect(
      new PersonalProfileSqliteRepository(database).get(),
    ).rejects.toMatchObject({ code: 'operation-failed' });
  });

  it('upserts canonical values using bound parameters', async () => {
    const database = new FakeDatabase();
    const profile = UserProfile.create(
      {
        activityLevel: storedRow.activity_level,
        biologicalSex: storedRow.biological_sex,
        dateOfBirth: storedRow.date_of_birth,
        heightMillimeters: storedRow.height_millimeters,
        preferredUnitSystem: storedRow.preferred_unit_system,
        weightGrams: storedRow.weight_grams,
      },
      '2026-08-02',
    );
    if (!isOk(profile)) throw new Error('Fixture must be valid.');

    await new PersonalProfileSqliteRepository(database).save(profile.value);
    expect(database.runs[0]?.parameters).toEqual([
      1,
      1_650,
      62_000,
      'female',
      '1990-06-15',
      'moderately-active',
      'metric',
    ]);
    expect(database.runs[0]?.statement).toContain('ON CONFLICT');
  });

  it('translates write failures without exposing driver details', async () => {
    const database = new FakeDatabase();
    database.runError = new Error('raw SQL and profile values');
    const profile = UserProfile.create(
      {
        activityLevel: storedRow.activity_level,
        biologicalSex: storedRow.biological_sex,
        dateOfBirth: storedRow.date_of_birth,
        heightMillimeters: storedRow.height_millimeters,
        preferredUnitSystem: storedRow.preferred_unit_system,
        weightGrams: storedRow.weight_grams,
      },
      '2026-08-02',
    );
    if (!isOk(profile)) throw new Error('Fixture must be valid.');

    await expect(
      new PersonalProfileSqliteRepository(database).save(profile.value),
    ).rejects.toMatchObject({
      code: 'operation-failed',
      message: 'The local storage operation failed.',
    });
  });
});
