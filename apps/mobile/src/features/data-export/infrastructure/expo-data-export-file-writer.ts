import { Directory, File, Paths } from 'expo-file-system';
import type {
  DataExportFile,
  DataExportFileWriter,
} from '../application/data-export-file';

/**
 * Writes the export into the application cache directory.
 *
 * Cache is deliberate: it stays inside the sandbox, platform convention keeps
 * it out of device backups, and the system may reclaim it. The directory is
 * recreated before every export so at most one export file ever exists, which
 * also removes anything a crash left behind.
 */
export const dataExportDirectoryName = 'data-export';

export class ExpoDataExportFileWriter implements DataExportFileWriter {
  // Asynchronous so a filesystem failure always reaches the caller as a
  // rejection. The callers decide what a failed cleanup means; none of them can
  // handle a synchronous throw from what looks like a promise.
  prepareDirectory(): Promise<void> {
    return Promise.resolve().then(() => {
      const directory = this.directory();
      if (directory.exists) directory.delete();
      directory.create({ intermediates: true });
    });
  }

  write(fileName: string, content: string): Promise<DataExportFile> {
    const file = new File(this.directory(), fileName);
    file.create({ overwrite: true });
    file.write(content);
    return Promise.resolve(
      Object.freeze({ byteSize: file.size, fileName, uri: file.uri }),
    );
  }

  remove(uri: string): Promise<void> {
    const file = new File(uri);
    if (file.exists) file.delete();
    return Promise.resolve();
  }

  private directory(): Directory {
    return new Directory(Paths.cache, dataExportDirectoryName);
  }
}
