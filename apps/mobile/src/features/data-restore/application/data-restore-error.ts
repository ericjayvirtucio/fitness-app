export type DataRestoreErrorCode =
  | 'duplicate-identifier'
  | 'file-empty'
  | 'file-too-large'
  | 'file-unreadable'
  | 'invalid-encoding'
  | 'invalid-json'
  | 'invalid-record'
  | 'invalid-structure'
  | 'picker-unavailable'
  | 'target-not-empty'
  | 'too-many-records'
  | 'unresolved-reference'
  | 'unsupported-format'
  | 'unsupported-format-version'
  | 'write-failed';

/**
 * Messages are fixed and safe to show. A selected file is untrusted input, so
 * none of them may echo a value, an identifier, a JSON fragment, a file path,
 * or a stack trace back to the screen. The codes are granular where they change
 * what the user should do next: "not a Fitness App export" and "this app
 * already contains data" call for very different recovery.
 */
const messages: Readonly<Record<DataRestoreErrorCode, string>> = {
  'duplicate-identifier':
    'The selected export lists the same record more than once, so it cannot be restored.',
  'file-empty': 'The selected file is empty.',
  'file-too-large':
    'The selected file is larger than this app can restore. Only Fitness App exports up to 25 MB are supported.',
  'file-unreadable':
    'The selected file could not be read. Choose the file again.',
  'invalid-encoding': 'The selected file is not readable text.',
  'invalid-json': 'The selected file is not a valid JSON document.',
  'invalid-record':
    'The selected export contains a record this app cannot accept, so nothing was restored.',
  'invalid-structure':
    'The selected export does not match the Fitness App export format.',
  'picker-unavailable': 'This device cannot open the file picker.',
  'target-not-empty':
    'This app already contains information, so nothing was restored. Restoring is only supported on an installation with no data.',
  'too-many-records':
    'The selected export contains more records than this app can restore.',
  'unresolved-reference':
    'The selected export plans an exercise it does not contain, so nothing was restored.',
  'unsupported-format': 'The selected file is not a Fitness App export.',
  'unsupported-format-version':
    'The selected export uses a format version this app version cannot read.',
  'write-failed':
    'Your information could not be restored. Nothing was changed.',
};

export class DataRestoreError extends Error {
  readonly code: DataRestoreErrorCode;

  constructor(code: DataRestoreErrorCode, options?: ErrorOptions) {
    super(messages[code], options);
    this.name = 'DataRestoreError';
    this.code = code;
  }
}

export function isDataRestoreError(value: unknown): value is DataRestoreError {
  return value instanceof DataRestoreError;
}
