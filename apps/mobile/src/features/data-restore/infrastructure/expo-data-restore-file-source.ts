import { File } from 'expo-file-system';
import { dataExportMediaType } from '../../data-export/application/data-export-contract';
import type {
  DataRestoreFile,
  DataRestoreFileSource,
  DataRestoreSelection,
} from '../application/data-restore-file';

/**
 * The system file picker, through the filesystem module the application already
 * depends on.
 *
 * The picker grants access to exactly the one file the user chose, so no
 * storage permission is requested and no directory is browsed. iOS hands back a
 * temporary copy and Android may hand back a content URI; both are read the
 * same way and neither is modified or deleted here — the file belongs to the
 * user, not to this application.
 *
 * The media-type filter only makes the picker easier to use. What the file
 * actually contains is decided by the parser, never by its type or its name.
 */
export class ExpoDataRestoreFileSource implements DataRestoreFileSource {
  async pick(): Promise<DataRestoreSelection> {
    const selection = await File.pickFileAsync({
      mimeTypes: [dataExportMediaType],
    });
    if (selection.canceled) return Object.freeze({ status: 'cancelled' });
    return Object.freeze({
      file: Object.freeze({
        byteSize: selection.result.size,
        uri: selection.result.uri,
      }),
      status: 'selected',
    });
  }

  readText(file: DataRestoreFile): Promise<string> {
    return new File(file.uri).text();
  }
}
