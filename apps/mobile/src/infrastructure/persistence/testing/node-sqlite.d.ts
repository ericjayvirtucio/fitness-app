/**
 * The subset of Node's built-in SQLite module that the test-owned database
 * adapter uses.
 *
 * `@types/node` is not a dependency of this workspace and this application does
 * not run on Node, so declaring the handful of members used here is preferable
 * to pulling a whole platform's type definitions in for one test adapter. The
 * shape mirrors `node:sqlite` as of Node 24.
 *
 * Row generics mirror `expo-sqlite`'s own signatures: a stored row is
 * unvalidated at this boundary in both adapters, and each repository maps it to
 * a validated domain value.
 */
declare module 'node:sqlite' {
  export class StatementSync {
    all<TRow>(...parameters: readonly (null | number | string)[]): TRow[];
    get<TRow>(
      ...parameters: readonly (null | number | string)[]
    ): TRow | undefined;
    run(...parameters: readonly (null | number | string)[]): void;
  }

  export class DatabaseSync {
    constructor(path: string);
    close(): void;
    exec(statement: string): void;
    prepare(statement: string): StatementSync;
  }
}
