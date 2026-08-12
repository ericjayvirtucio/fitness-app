import { DatabaseSync } from 'node:sqlite';
import type {
  DatabaseConnection,
  DatabaseParameters,
  DatabaseValue,
  DatabaseVersionRow,
} from '../database';
import { PersistenceError, toPersistenceError } from '../persistence-error';

/**
 * A real SQLite engine behind the application's own `DatabaseConnection`, for
 * tests only.
 *
 * The rollback guarantee that safe replacement rests on — the previous dataset
 * survives, or the complete replacement commits — is a property of the engine,
 * not of the orchestration. A hand-written fake runner can only assert that the
 * code asked for a rollback; it cannot assert that one happened. This adapter
 * lets a test say the second thing, using the repository's real migrations and
 * real repositories.
 *
 * It is not the production adapter and never runs in the application. Expo owns
 * that, on `expo-sqlite`, and `composition/persistence.ts` remains the only
 * place a production database is opened.
 *
 * Foreign-key enforcement is deliberately disabled around the transaction.
 * `PRAGMA foreign_keys` is a per-connection setting that is a no-op once a
 * transaction has begun, and Expo runs an exclusive transaction on a connection
 * it opens itself, so production transaction work is measured to run with
 * enforcement off. Reproducing that here keeps a test from passing because of a
 * constraint the application does not actually get.
 */
export class NodeSqliteDatabase implements DatabaseConnection {
  private readonly database = new DatabaseSync(':memory:');
  private isInTransaction = false;

  close(): void {
    this.database.close();
  }

  exec(statement: string): Promise<void> {
    return this.guard(() => {
      this.database.exec(statement);
    });
  }

  getVersion(): Promise<number> {
    return this.guard(() => {
      const row = this.database
        .prepare('PRAGMA user_version')
        .get<DatabaseVersionRow>();
      if (row === undefined) {
        throw new PersistenceError('operation-failed');
      }
      return row.user_version;
    });
  }

  getFirst<TResult>(
    statement: string,
    parameters: DatabaseParameters = [],
  ): Promise<TResult | null> {
    return this.guard(() => {
      const row = this.database
        .prepare(statement)
        .get<TResult>(...toBindings(parameters));
      return row === undefined ? null : row;
    });
  }

  getAll<TResult>(
    statement: string,
    parameters: DatabaseParameters = [],
  ): Promise<readonly TResult[]> {
    return this.guard(() =>
      this.database.prepare(statement).all<TResult>(...toBindings(parameters)),
    );
  }

  run(statement: string, parameters: DatabaseParameters = []): Promise<void> {
    return this.guard(() => {
      this.database.prepare(statement).run(...toBindings(parameters));
    });
  }

  /**
   * Mirrors Expo's exclusive transaction: one writer at a time, committed on a
   * clean return and rolled back on any throw. Nesting is rejected rather than
   * silently flattened, because the application never nests one either.
   */
  async runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    if (this.isInTransaction) {
      throw new PersistenceError('transaction-failed');
    }

    this.isInTransaction = true;
    this.database.exec('PRAGMA foreign_keys = OFF');
    this.database.exec('BEGIN EXCLUSIVE');

    try {
      const result = await operation(this);
      this.database.exec('COMMIT');
      return result;
    } catch (error: unknown) {
      this.database.exec('ROLLBACK');
      throw toPersistenceError(error, 'transaction-failed');
    } finally {
      this.isInTransaction = false;
      this.database.exec('PRAGMA foreign_keys = ON');
    }
  }

  private guard<TResult>(read: () => TResult): Promise<TResult> {
    try {
      return Promise.resolve(read());
    } catch (error: unknown) {
      return Promise.reject(toPersistenceError(error, 'operation-failed'));
    }
  }
}

function toBindings(
  parameters: DatabaseParameters,
): readonly (null | number | string)[] {
  return parameters.map((value: DatabaseValue) => value);
}
