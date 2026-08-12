import { initializeDatabase } from '../database-initializer';
import { migrations } from '../migrations';
import { NodeSqliteDatabase } from './node-sqlite-database';

describe('NodeSqliteDatabase', () => {
  it('runs the repository migrations and reports the installed version', async () => {
    const database = new NodeSqliteDatabase();
    await initializeDatabase(database, migrations);

    await expect(database.getVersion()).resolves.toBe(migrations.length);

    database.close();
  });

  it('commits an exclusive transaction that returns cleanly', async () => {
    const database = new NodeSqliteDatabase();
    await database.exec('CREATE TABLE sample (id TEXT PRIMARY KEY)');

    await database.runExclusive((transaction) =>
      transaction.run('INSERT INTO sample (id) VALUES (?)', ['kept']),
    );

    await expect(database.getAll('SELECT id FROM sample')).resolves.toEqual([
      { id: 'kept' },
    ]);

    database.close();
  });

  it('rolls a failed exclusive transaction back on the real engine', async () => {
    const database = new NodeSqliteDatabase();
    await database.exec('CREATE TABLE sample (id TEXT PRIMARY KEY)');
    await database.run('INSERT INTO sample (id) VALUES (?)', ['original']);

    const attempt = database.runExclusive(async (transaction) => {
      await transaction.run('DELETE FROM sample');
      await transaction.run('INSERT INTO sample (id) VALUES (?)', ['incoming']);
      throw new Error('failed before the commit');
    });

    await expect(attempt).rejects.toMatchObject({ code: 'transaction-failed' });
    await expect(database.getAll('SELECT id FROM sample')).resolves.toEqual([
      { id: 'original' },
    ]);

    database.close();
  });
});
