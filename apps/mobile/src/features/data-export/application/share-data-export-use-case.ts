import { DataExportError } from './data-export-error';
import type {
  DataExportFile,
  DataExportShareService,
} from './data-export-file';

/**
 * Sharing is a second, deliberate user action. It is separate from generation
 * so the user sees what is about to leave the application first, and so a
 * failure to share never looks like a failure to export.
 */
export class ShareDataExportUseCase {
  constructor(private readonly shareService: DataExportShareService) {}

  async execute(file: DataExportFile): Promise<void> {
    if (!(await this.isAvailable())) {
      throw new DataExportError('sharing-unavailable');
    }

    try {
      await this.shareService.share(file);
    } catch (error: unknown) {
      throw new DataExportError('sharing-failed', { cause: error });
    }
  }

  private async isAvailable(): Promise<boolean> {
    try {
      return await this.shareService.isAvailable();
    } catch {
      return false;
    }
  }
}
