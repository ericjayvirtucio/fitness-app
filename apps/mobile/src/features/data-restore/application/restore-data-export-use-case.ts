import { holdsStoredData } from '../../../application/persistence/stored-data-probe';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { DataRestoreError } from './data-restore-error';
import type { DataRestoreTransactionContext } from './data-restore-transaction-context';
import type { RestoreData } from './restore-data';
import { writeRestoreData } from './write-restore-data';

type TransactionOutcome = 'restored' | 'target-not-empty';

/**
 * Writes a validated export inside one exclusive transaction.
 *
 * Emptiness is rechecked here rather than trusted from the preview, because a
 * record can be created between the two. The check returns an outcome instead
 * of throwing so a refusal commits an empty transaction rather than travelling
 * out through the transaction runner's error translation, where its meaning
 * would be flattened into a generic persistence failure.
 *
 * The writes themselves live in {@link writeRestoreData}, which replacement
 * restore shares, so the schema-shaped insertion order has one definition.
 */
export class RestoreDataExportUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<DataRestoreTransactionContext>,
  ) {}

  async execute(data: RestoreData): Promise<void> {
    const outcome = await this.run(data);
    if (outcome === 'target-not-empty')
      throw new DataRestoreError('target-not-empty');
  }

  private async run(data: RestoreData): Promise<TransactionOutcome> {
    try {
      return await this.transactionRunner.run(async (context) => {
        if (await holdsStoredData(context.probes)) return 'target-not-empty';
        await writeRestoreData(context, data);
        return 'restored';
      });
    } catch (error: unknown) {
      throw new DataRestoreError('write-failed', { cause: error });
    }
  }
}
