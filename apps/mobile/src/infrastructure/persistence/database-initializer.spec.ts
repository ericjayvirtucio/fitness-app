import type { DatabaseConnection } from './database';
import { initializeDatabase } from './database-initializer';
import type { Migration } from './migrations';
import { PersistenceError } from './persistence-error';
import { migrations } from './migrations';

class FakeDatabase implements DatabaseConnection {
  readonly statements: string[] = [];
  transactionCount = 0;

  constructor(public version = 0) {}

  exec(statement: string): Promise<void> {
    this.statements.push(statement);

    const versionMatch = /^PRAGMA user_version = (\d+)$/.exec(statement);
    if (versionMatch?.[1]) {
      this.version = Number(versionMatch[1]);
    }

    return Promise.resolve();
  }

  getVersion(): Promise<number> {
    return Promise.resolve(this.version);
  }

  getFirst<TResult>(): Promise<TResult | null> {
    return Promise.resolve(null);
  }

  run(): Promise<void> {
    return Promise.resolve();
  }

  async runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    this.transactionCount += 1;
    return operation(this);
  }
}

const testMigrations: readonly Migration[] = [
  {
    description: 'First migration',
    up: async (transaction) => transaction.exec('FIRST MIGRATION'),
    version: 1,
  },
  {
    description: 'Second migration',
    up: async (transaction) => transaction.exec('SECOND MIGRATION'),
    version: 2,
  },
];

describe('initializeDatabase', () => {
  it('includes the forward-only personal profile migration', () => {
    expect(migrations).toHaveLength(3);
    expect(migrations[1]).toMatchObject({
      description: 'Add the single personal profile record.',
      version: 2,
    });
  });

  it('upgrades schema version 2 by creating the goal configuration table', async () => {
    const database = new FakeDatabase(2);

    await initializeDatabase(database, migrations);

    expect(database.statements.join('\n')).toContain(
      'CREATE TABLE goal_configuration',
    );
    expect(database.statements.at(-1)).toBe('PRAGMA user_version = 3');
    expect(database.transactionCount).toBe(1);
  });

  it('upgrades schema version 1 by creating the personal profile table', async () => {
    const database = new FakeDatabase(1);

    await initializeDatabase(database, migrations);

    expect(database.statements.join('\n')).toContain(
      'CREATE TABLE personal_profile',
    );
    expect(database.statements.at(-1)).toBe('PRAGMA user_version = 3');
    expect(database.transactionCount).toBe(2);
  });
  it('configures the database and applies pending migrations in order', async () => {
    const database = new FakeDatabase();

    await initializeDatabase(database, testMigrations);

    expect(database.statements).toEqual([
      'PRAGMA foreign_keys = ON',
      'PRAGMA journal_mode = WAL',
      'FIRST MIGRATION',
      'PRAGMA user_version = 1',
      'SECOND MIGRATION',
      'PRAGMA user_version = 2',
    ]);
    expect(database.transactionCount).toBe(2);
    expect(database.version).toBe(2);
  });

  it('is idempotent when the database is current', async () => {
    const database = new FakeDatabase(2);

    await initializeDatabase(database, testMigrations);
    await initializeDatabase(database, testMigrations);

    expect(database.statements).toEqual([
      'PRAGMA foreign_keys = ON',
      'PRAGMA journal_mode = WAL',
      'PRAGMA foreign_keys = ON',
      'PRAGMA journal_mode = WAL',
    ]);
    expect(database.transactionCount).toBe(0);
  });

  it('rejects a schema newer than the application supports', async () => {
    const database = new FakeDatabase(3);

    await expect(
      initializeDatabase(database, testMigrations),
    ).rejects.toMatchObject({ code: 'unsupported-schema-version' });
  });

  it('rejects migrations that are not contiguous and ordered', async () => {
    const database = new FakeDatabase();
    const invalidMigrations: readonly Migration[] = [
      { description: 'Invalid', up: () => Promise.resolve(), version: 2 },
    ];

    await expect(
      initializeDatabase(database, invalidMigrations),
    ).rejects.toMatchObject({ code: 'migration-failed' });
  });

  it('translates a migration failure without exposing its details', async () => {
    const database = new FakeDatabase();
    const failedMigrations: readonly Migration[] = [
      {
        description: 'Fails',
        up: () => Promise.reject(new Error('sensitive SQL details')),
        version: 1,
      },
    ];

    const result = initializeDatabase(database, failedMigrations);

    await expect(result).rejects.toBeInstanceOf(PersistenceError);
    await expect(result).rejects.toMatchObject({
      code: 'migration-failed',
      message: 'Local storage could not be updated.',
    });
  });

  it('classifies a driver transaction failure as a migration failure', async () => {
    const database = new FakeDatabase();
    database.runExclusive = () =>
      Promise.reject(new PersistenceError('transaction-failed'));

    await expect(
      initializeDatabase(database, testMigrations),
    ).rejects.toMatchObject({ code: 'migration-failed' });
  });
});
