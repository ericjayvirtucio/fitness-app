import { DataExportError } from '../../data-export/application/data-export-error';
import type { DataExportFile } from '../../data-export/application/data-export-file';
import {
  CreateRecoveryExportUseCase,
  type CurrentDataExporter,
} from './create-recovery-export-use-case';
import { isLocalDataReplacementError } from './local-data-replacement-error';

const file: DataExportFile = {
  byteSize: 2048,
  fileName: 'fitness-app-export-20260812T090000Z.json',
  uri: 'file:///cache/data-export/fitness-app-export-20260812T090000Z.json',
};

describe('CreateRecoveryExportUseCase', () => {
  it('returns the copy the existing exporter produced', async () => {
    const exporter: CurrentDataExporter = {
      execute: () => Promise.resolve({ file }),
    };

    await expect(
      new CreateRecoveryExportUseCase(exporter).execute(),
    ).resolves.toBe(file);
  });

  it('never asks the exporter to cancel', async () => {
    const cancellations: boolean[] = [];
    const exporter: CurrentDataExporter = {
      execute: (cancellation) => {
        cancellations.push(cancellation.isCancelled);
        return Promise.resolve({ file });
      },
    };

    await new CreateRecoveryExportUseCase(exporter).execute();

    expect(cancellations).toEqual([false]);
  });

  it('reports a failure in this workflow rather than an export failure', async () => {
    const exporter: CurrentDataExporter = {
      execute: () => Promise.reject(new DataExportError('file-write-failed')),
    };

    const work = new CreateRecoveryExportUseCase(exporter).execute();

    await expect(work).rejects.toThrow();
    await work.catch((error: unknown) => {
      expect(isLocalDataReplacementError(error) && error.code).toBe(
        'recovery-export-failed',
      );
      expect(isLocalDataReplacementError(error) && error.message).toBe(
        'A copy of your current information could not be created, so nothing was replaced.',
      );
    });
  });

  it('keeps no file path or internal detail in its message', async () => {
    const exporter: CurrentDataExporter = {
      execute: () =>
        Promise.reject(new Error(`could not write ${file.uri}: EACCES`)),
    };

    await new CreateRecoveryExportUseCase(exporter)
      .execute()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '';
        expect(message).not.toContain('file:///');
        expect(message).not.toContain('EACCES');
      });
  });
});
