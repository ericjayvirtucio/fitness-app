import { holdsStoredData } from '../../../application/persistence/stored-data-probe';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { LocalDataErasureError } from './local-data-erasure-error';
import type { LocalDataErasureTransactionContext } from './local-data-erasure-transaction-context';

/**
 * Answers whether this installation has anything to delete.
 *
 * The screen asks on entry so it can disable the destructive control, and say
 * why, rather than offering an action that would do nothing. It is advisory:
 * the answer that decides anything is the one taken inside the erasure
 * transaction.
 */
export class GetLocalDataPresenceUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<LocalDataErasureTransactionContext>,
  ) {}

  async execute(): Promise<boolean> {
    try {
      return await this.transactionRunner.run((context) =>
        holdsStoredData(context.probes),
      );
    } catch (error: unknown) {
      throw new LocalDataErasureError('storage-unavailable', { cause: error });
    }
  }
}
