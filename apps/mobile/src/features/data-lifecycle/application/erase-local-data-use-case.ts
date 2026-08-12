import { holdsStoredData } from '../../../application/persistence/stored-data-probe';
import type { StorageCompactor } from '../../../application/persistence/storage-compactor';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { LocalDataErasureError } from './local-data-erasure-error';
import type { LocalDataErasureTransactionContext } from './local-data-erasure-transaction-context';

/**
 * The existing export cleanup, injected as a narrow port so this capability
 * never learns a cache path or a file name of its own.
 */
export type GeneratedExportCleanup = Readonly<{
  execute: () => Promise<void>;
}>;

export type LocalDataErasureResult = Readonly<{
  /**
   * False when the records are gone but the generated export file could not be
   * removed. The screen says so instead of pretending either that the deletion
   * failed or that nothing is left behind.
   */
  isCleanupComplete: boolean;
}>;

/**
 * Erases every user-owned record in one exclusive transaction.
 *
 * Verification runs inside that transaction, not after it. A probe that still
 * finds records has to be able to undo the deletion, and after a commit it
 * could only report a problem it can no longer fix. The verification failure is
 * therefore raised inside the callback to force a rollback, and remembered in a
 * flag because the transaction runner flattens everything it catches into one
 * generic persistence error.
 *
 * Nothing outside SQLite takes part in the transaction. Cleanup and compaction
 * run afterwards and can never turn a committed deletion into a reported
 * failure, because by then the records really are gone.
 */
export class EraseLocalDataUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<LocalDataErasureTransactionContext>,
    private readonly exportCleanup: GeneratedExportCleanup,
    private readonly storageCompactor: StorageCompactor,
  ) {}

  async execute(): Promise<LocalDataErasureResult> {
    await this.erase();

    const isCleanupComplete = await this.removeGeneratedExport();
    await this.compact();

    return Object.freeze({ isCleanupComplete });
  }

  private async erase(): Promise<void> {
    let hasFailedVerification = false;

    try {
      await this.transactionRunner.run(async (context) => {
        for (const eraser of context.erasers) {
          await eraser.eraseStoredRecords();
        }

        if (await holdsStoredData(context.probes)) {
          hasFailedVerification = true;
          throw new LocalDataErasureError('verification-failed');
        }
      });
    } catch (error: unknown) {
      throw new LocalDataErasureError(
        hasFailedVerification ? 'verification-failed' : 'erase-failed',
        { cause: error },
      );
    }
  }

  private async removeGeneratedExport(): Promise<boolean> {
    try {
      await this.exportCleanup.execute();
      return true;
    } catch {
      // The records are already gone. A leftover export the app still owns is
      // reported to the user, and the export screen removes it on its next
      // visit either way.
      return false;
    }
  }

  private async compact(): Promise<void> {
    try {
      await this.storageCompactor.compact();
    } catch {
      // Reclaiming space is housekeeping, not deletion. Failing here leaves no
      // user record behind and nothing the user could act on, so it changes
      // neither the result nor the message.
    }
  }
}
