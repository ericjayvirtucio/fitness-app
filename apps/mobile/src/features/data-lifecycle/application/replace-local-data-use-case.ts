import { holdsStoredData } from '../../../application/persistence/stored-data-probe';
import type { StorageCompactor } from '../../../application/persistence/storage-compactor';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type { RestoreData } from '../../data-restore/application/restore-data';
import { writeRestoreData } from '../../data-restore/application/write-restore-data';
import {
  isSameCapabilityPresence,
  readCapabilityPresence,
  toExpectedCapabilityPresence,
} from './capability-presence';
import { LocalDataReplacementError } from './local-data-replacement-error';
import type { LocalDataReplacementTransactionContext } from './local-data-replacement-transaction-context';

/**
 * Replaces the whole local dataset with an already validated one, inside a
 * single exclusive transaction.
 *
 * The guarantee is that the previous dataset survives intact or the complete
 * replacement commits. That is why erasing and writing share one transaction
 * rather than running as two: two transactions would commit an empty database
 * in between, where an insertion failure or a force quit destroys what the user
 * had without producing what they asked for.
 *
 * Everything this receives has already been read, parsed, domain-reconstructed,
 * referentially checked, and shown to the user. Nothing here interprets a file,
 * and no file is read after the transaction opens.
 *
 * Verification runs inside the transaction for the same reason erasure's does:
 * a failure found there can still be undone. It is remembered in a flag before
 * it is raised, because the transaction runner flattens everything it catches
 * into one generic persistence error and the two cases owe the user different
 * sentences.
 */
export class ReplaceLocalDataUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<LocalDataReplacementTransactionContext>,
    private readonly storageCompactor: StorageCompactor,
  ) {}

  async execute(data: RestoreData): Promise<void> {
    await this.replace(data);
    await this.compact();
  }

  private async replace(data: RestoreData): Promise<void> {
    let hasFailedVerification = false;

    try {
      await this.transactionRunner.run(async (context) => {
        for (const eraser of context.erasers) {
          await eraser.eraseStoredRecords();
        }
        await context.clearOutbox();

        // Nothing is written until the previous dataset is provably gone, so a
        // failed or skipped eraser can never leave one record of it mixed into
        // the replacement.
        if (await holdsStoredData(context.target.probes)) {
          hasFailedVerification = true;
          throw new LocalDataReplacementError('verification-failed');
        }

        await writeRestoreData(context.target, data);

        const expected = toExpectedCapabilityPresence(data);
        const actual = await readCapabilityPresence(context.presence);
        if (!isSameCapabilityPresence(expected, actual)) {
          hasFailedVerification = true;
          throw new LocalDataReplacementError('verification-failed');
        }
      });
    } catch (error: unknown) {
      throw new LocalDataReplacementError(
        hasFailedVerification ? 'verification-failed' : 'replace-failed',
        { cause: error },
      );
    }
  }

  /**
   * Free pages left by the dataset that was just replaced still hold its bytes,
   * and committed frames stay in the write-ahead log until a checkpoint. Both
   * statements are refused inside a transaction, so they run afterwards, and
   * neither can turn a committed replacement into a reported failure: the
   * records really are replaced either way.
   *
   * Unlike after an erasure, this rebuilds a populated database, so the cost
   * scales with the replacement dataset rather than being close to free.
   */
  private async compact(): Promise<void> {
    try {
      await this.storageCompactor.compact();
    } catch {
      // Reclaiming space is housekeeping. Failing here leaves no user record
      // wrong and nothing the user could act on.
    }
  }
}
