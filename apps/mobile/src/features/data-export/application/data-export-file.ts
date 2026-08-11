/**
 * Ports for the platform work an export needs. Neither mentions Expo, so the
 * application layer stays free of filesystem and share-sheet types and both
 * are replaceable without touching the contract or the use cases.
 */

export type DataExportFile = Readonly<{
  byteSize: number;
  fileName: string;
  uri: string;
}>;

export interface DataExportFileWriter {
  /**
   * Removes any previous export and recreates the working directory, so at
   * most one export file exists on the device at a time.
   */
  prepareDirectory(): Promise<void>;
  remove(uri: string): Promise<void>;
  write(fileName: string, content: string): Promise<DataExportFile>;
}

export interface DataExportShareService {
  isAvailable(): Promise<boolean>;
  /**
   * Hands the file to the platform. The platform owns the destination, and on
   * some platforms a dismissed sheet is indistinguishable from a completed
   * save, so resolution must never be reported as "saved".
   */
  share(file: DataExportFile): Promise<void>;
}
