export interface TransactionRunner<TContext> {
  run<TResult>(
    operation: (context: TContext) => Promise<TResult>,
  ): Promise<TResult>;
}
