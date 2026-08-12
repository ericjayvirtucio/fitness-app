export type LocalDataReplacementErrorCode =
  | 'recovery-export-failed'
  | 'replace-failed'
  | 'storage-unavailable'
  | 'verification-failed';

/**
 * Messages are fixed and safe to show. None may name a table, echo a record
 * from either dataset, expose a file path, or repeat a database error.
 *
 * Every code except `recovery-export-failed` means the information that was
 * already on the device is still there, and every message says so, because
 * "something went wrong" after a destructive confirmation is exactly the moment
 * a user needs to know whether they still have their data.
 */
const messages: Readonly<Record<LocalDataReplacementErrorCode, string>> = {
  'recovery-export-failed':
    'A copy of your current information could not be created, so nothing was replaced.',
  'replace-failed':
    'Your information could not be replaced. What was already on this device was kept, so you can try again.',
  'storage-unavailable':
    'This app could not check its local storage, so nothing was replaced.',
  'verification-failed':
    'Replacing could not be confirmed, so nothing was replaced and what was already on this device was kept.',
};

export class LocalDataReplacementError extends Error {
  readonly code: LocalDataReplacementErrorCode;

  constructor(code: LocalDataReplacementErrorCode, options?: ErrorOptions) {
    super(messages[code], options);
    this.name = 'LocalDataReplacementError';
    this.code = code;
  }
}

export function isLocalDataReplacementError(
  value: unknown,
): value is LocalDataReplacementError {
  return value instanceof LocalDataReplacementError;
}
