import type { DataExportFileWriter } from './data-export-file';

/**
 * Removes any export the application still holds.
 *
 * It runs when the export screen opens and when the user discards an export,
 * so a file left behind by a crash cannot outlive the next visit. It is
 * deliberately not run immediately after the share handoff resolves, because a
 * receiving application may still be reading the file it was granted.
 */
export class ClearDataExportsUseCase {
  constructor(private readonly fileWriter: DataExportFileWriter) {}

  async execute(): Promise<void> {
    try {
      await this.fileWriter.prepareDirectory();
    } catch {
      // Cleanup is best effort. The next export prepares the directory again.
    }
  }
}
