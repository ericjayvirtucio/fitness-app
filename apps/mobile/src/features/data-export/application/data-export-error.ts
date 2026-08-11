export type DataExportErrorCode =
  | 'cancelled'
  | 'file-write-failed'
  | 'read-failed'
  | 'serialization-failed'
  | 'sharing-failed'
  | 'sharing-unavailable';

/**
 * Messages are fixed and safe to show. They never contain a measurement, an
 * identifier, a file path, or anything read from the database, because the
 * whole point of this capability is that the data stays where the user put it.
 */
const messages: Readonly<Record<DataExportErrorCode, string>> = {
  cancelled: 'The export was cancelled. Nothing was saved.',
  'file-write-failed':
    'The export file could not be created. Check available storage and try again.',
  'read-failed':
    'Your information could not be read. No export file was created.',
  'serialization-failed':
    'The export file could not be prepared. No export file was created.',
  'sharing-failed':
    'Sharing did not finish. The export is still on this device.',
  'sharing-unavailable': 'This device cannot open share or save options.',
};

export class DataExportError extends Error {
  readonly code: DataExportErrorCode;

  constructor(code: DataExportErrorCode, options?: ErrorOptions) {
    super(messages[code], options);
    this.name = 'DataExportError';
    this.code = code;
  }
}

export function isDataExportError(value: unknown): value is DataExportError {
  return value instanceof DataExportError;
}
