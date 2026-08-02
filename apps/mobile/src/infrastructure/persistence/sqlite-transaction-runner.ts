import type { TransactionRunner } from '../../application/persistence/transaction-runner';
import type { DatabaseConnection } from './database';
import { toPersistenceError } from './persistence-error';

export class SqliteTransactionRunner<
  TContext,
> implements TransactionRunner<TContext> {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly createContext: (database: DatabaseConnection) => TContext,
  ) {}

  async run<TResult>(
    operation: (context: TContext) => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await this.database.runExclusive((transaction) =>
        operation(this.createContext(transaction)),
      );
    } catch (error: unknown) {
      throw toPersistenceError(error, 'transaction-failed');
    }
  }
}
