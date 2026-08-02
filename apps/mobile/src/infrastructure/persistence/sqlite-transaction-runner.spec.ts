import type { DatabaseConnection } from './database';
import { PersistenceError } from './persistence-error';
import { SqliteTransactionRunner } from './sqlite-transaction-runner';

class TransactionDatabase implements DatabaseConnection {
  didCommit = false;
  didRollback = false;
  readonly transactionContext: DatabaseConnection = {
    exec: () => Promise.resolve(),
    getFirst: () => Promise.resolve(null),
    getVersion: () => Promise.resolve(0),
    run: () => Promise.resolve(),
    runExclusive: (operation) => operation(this.transactionContext),
  };

  exec(): Promise<void> {
    return Promise.resolve();
  }

  getVersion(): Promise<number> {
    return Promise.resolve(0);
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
    try {
      const result = await operation(this.transactionContext);
      this.didCommit = true;
      return result;
    } catch (error: unknown) {
      this.didRollback = true;
      throw error;
    }
  }
}

describe('SqliteTransactionRunner', () => {
  it('wires the scoped context and commits a successful operation', async () => {
    const database = new TransactionDatabase();
    const runner = new SqliteTransactionRunner(database, (context) => context);

    const result = await runner.run((context) => {
      expect(context).toBe(database.transactionContext);
      return Promise.resolve('complete');
    });

    expect(result).toBe('complete');
    expect(database.didCommit).toBe(true);
    expect(database.didRollback).toBe(false);
  });

  it('rolls back and translates a failed operation', async () => {
    const database = new TransactionDatabase();
    const runner = new SqliteTransactionRunner(database, (context) => context);

    const result = runner.run(() => Promise.reject(new Error('raw failure')));

    await expect(result).rejects.toBeInstanceOf(PersistenceError);
    await expect(result).rejects.toMatchObject({
      code: 'transaction-failed',
      message: 'The local storage transaction failed.',
    });
    expect(database.didCommit).toBe(false);
    expect(database.didRollback).toBe(true);
  });
});
