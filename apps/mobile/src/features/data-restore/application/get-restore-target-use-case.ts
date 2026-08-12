import { holdsStoredData } from '../../../application/persistence/stored-data-probe';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { DataRestoreError } from './data-restore-error';
import type { DataRestoreTransactionContext } from './data-restore-transaction-context';

/**
 * Answers whether this installation can accept a restore at all.
 *
 * The screen asks on entry so it can explain the refusal before the user picks
 * a file and waits through validation. It is advisory only: the answer that
 * decides anything is the one taken inside the write transaction.
 */
export class GetRestoreTargetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<DataRestoreTransactionContext>,
  ) {}

  async execute(): Promise<boolean> {
    try {
      return await this.transactionRunner.run(
        async (context) => !(await holdsStoredData(context.probes)),
      );
    } catch (error: unknown) {
      throw new DataRestoreError('storage-unavailable', { cause: error });
    }
  }
}
