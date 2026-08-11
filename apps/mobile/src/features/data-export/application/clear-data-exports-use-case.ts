import type { DataExportFileWriter } from './data-export-file';

/**
 * Removes any export the application still holds.
 *
 * It runs when the export screen opens, when the user discards an export, and
 * when local data is erased, so a file left behind by a crash cannot outlive
 * the next visit. It is deliberately not run immediately after the share
 * handoff resolves, because a receiving application may still be reading the
 * file it was granted.
 *
 * A failure is reported to the caller rather than swallowed here, because the
 * two callers owe the user different answers: the export screen carries on,
 * since the next export prepares the directory again, while erasure has to say
 * that a file it owns is still on the device.
 */
export class ClearDataExportsUseCase {
  constructor(private readonly fileWriter: DataExportFileWriter) {}

  execute(): Promise<void> {
    return this.fileWriter.prepareDirectory();
  }
}
