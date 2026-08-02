import type { TransactionRunner } from '../../application/persistence/transaction-runner';
import type { DatabaseConnection } from './database';
import { toPersistenceError } from './persistence-error';

export class SqliteTransactionRunner implements TransactionRunner<DatabaseConnection> {
  constructor(private readonly database: DatabaseConnection) {}

  async run<TResult>(
    operation: (context: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await this.database.runExclusive(operation);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'transaction-failed');
    }
  }
}
