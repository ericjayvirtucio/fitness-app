import { isAvailableAsync, shareAsync } from 'expo-sharing';
import {
  dataExportMediaType,
  dataExportUniformTypeIdentifier,
} from '../application/data-export-contract';
import type {
  DataExportFile,
  DataExportShareService,
} from '../application/data-export-file';

/**
 * Hands the file to the platform's own share and save controls. The platform
 * owns the destination and no storage permission is requested. On iOS the
 * promise resolves whether the user saved or dismissed the sheet, so callers
 * must never report resolution as a completed save.
 */
export class ExpoDataExportShareService implements DataExportShareService {
  isAvailable(): Promise<boolean> {
    return isAvailableAsync();
  }

  share(file: DataExportFile): Promise<void> {
    return shareAsync(file.uri, {
      UTI: dataExportUniformTypeIdentifier,
      dialogTitle: 'Save your fitness data export',
      mimeType: dataExportMediaType,
    });
  }
}
