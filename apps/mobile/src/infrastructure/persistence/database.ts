export type DatabaseVersionRow = Readonly<{
  user_version: number;
}>;

export type DatabaseValue = null | number | string;
export type DatabaseParameters = readonly DatabaseValue[];

export interface DatabaseConnection {
  exec(statement: string): Promise<void>;
  getFirst<TResult>(
    statement: string,
    parameters?: DatabaseParameters,
  ): Promise<TResult | null>;
  getVersion(): Promise<number>;
  run(statement: string, parameters?: DatabaseParameters): Promise<void>;
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult>;
}
