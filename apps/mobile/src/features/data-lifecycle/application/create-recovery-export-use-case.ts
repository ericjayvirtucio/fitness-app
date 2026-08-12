import type { DataExportFile } from '../../data-export/application/data-export-file';
import { LocalDataReplacementError } from './local-data-replacement-error';

/**
 * The existing exporter, injected as a narrow port so this capability never
 * learns a cache path, a file name, or the export contract.
 */
export type CurrentDataExporter = Readonly<{
  execute: (
    cancellation: Readonly<{ isCancelled: boolean }>,
  ) => Promise<Readonly<{ file: DataExportFile }>>;
}>;

/**
 * Writes a copy of the information currently on the device, before any of it is
 * replaced.
 *
 * It is the same version 1 export the user can create from the export screen —
 * no second contract, mapping, or serializer exists — and it runs before the
 * replacement transaction opens, which is what makes it impossible for an
 * incoming record to appear in it.
 *
 * It is offered, never required. The application cannot see whether a share
 * sheet saved the file, so it never claims the copy is safe anywhere, and a
 * user who does not want another copy of sensitive information can say so.
 */
export class CreateRecoveryExportUseCase {
  constructor(private readonly exporter: CurrentDataExporter) {}

  async execute(): Promise<DataExportFile> {
    try {
      // The user cannot cancel a recovery export: it is a short step inside a
      // longer deliberate workflow, and offering a cancel here would only
      // create a state where the user believes a copy exists.
      const result = await this.exporter.execute({ isCancelled: false });
      return result.file;
    } catch (error: unknown) {
      throw new LocalDataReplacementError('recovery-export-failed', {
        cause: error,
      });
    }
  }
}
