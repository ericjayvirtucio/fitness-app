export type DatabaseVersionRow = Readonly<{
  user_version: number;
}>;

export interface DatabaseConnection {
  exec(statement: string): Promise<void>;
  getVersion(): Promise<number>;
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult>;
}
