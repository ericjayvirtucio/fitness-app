import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  DatabaseConnection,
  DatabaseParameters,
  DatabaseVersionRow,
} from './database';
import { PersistenceError, toPersistenceError } from './persistence-error';

export class SqliteDatabaseAdapter implements DatabaseConnection {
  constructor(private readonly database: SQLiteDatabase) {}

  async exec(statement: string): Promise<void> {
    try {
      await this.database.execAsync(statement);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async getVersion(): Promise<number> {
    try {
      const row = await this.database.getFirstAsync<DatabaseVersionRow>(
        'PRAGMA user_version',
      );

      if (row === null) {
        throw new PersistenceError('operation-failed');
      }

      return row.user_version;
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async getFirst<TResult>(
    statement: string,
    parameters: DatabaseParameters = [],
  ): Promise<TResult | null> {
    try {
      return await this.database.getFirstAsync<TResult>(statement, [
        ...parameters,
      ]);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async getAll<TResult>(
    statement: string,
    parameters: DatabaseParameters = [],
  ): Promise<readonly TResult[]> {
    try {
      return await this.database.getAllAsync<TResult>(statement, [
        ...parameters,
      ]);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async run(
    statement: string,
    parameters: DatabaseParameters = [],
  ): Promise<void> {
    try {
      await this.database.runAsync(statement, [...parameters]);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }

  async runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    let outcome: [] | [TResult] = [];

    try {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        outcome = [await operation(new SqliteDatabaseAdapter(transaction))];
      });
    } catch (error: unknown) {
      throw toPersistenceError(error, 'transaction-failed');
    }

    if (outcome.length === 0) {
      throw new PersistenceError('transaction-failed');
    }

    return outcome[0];
  }
}
