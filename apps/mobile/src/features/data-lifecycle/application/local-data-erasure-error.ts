export type LocalDataErasureErrorCode =
  'erase-failed' | 'storage-unavailable' | 'verification-failed';

/**
 * Messages are fixed and safe to show. None of them may name a table, echo a
 * record, expose a file path, or repeat a database error, because the whole
 * point of this capability is that the information stops existing rather than
 * reappearing in a diagnostic.
 *
 * Every code here means nothing was deleted. Cleanup that fails after a
 * committed deletion is a warning carried on a successful result, not an error,
 * because saying "deletion failed" then would be untrue.
 */
const messages: Readonly<Record<LocalDataErasureErrorCode, string>> = {
  'erase-failed':
    'Your information could not be deleted. Nothing was changed, so you can try again.',
  'storage-unavailable':
    'This app could not check its local storage, so nothing was deleted.',
  'verification-failed':
    'Deleting could not be confirmed, so nothing was deleted. Try again.',
};

export class LocalDataErasureError extends Error {
  readonly code: LocalDataErasureErrorCode;

  constructor(code: LocalDataErasureErrorCode, options?: ErrorOptions) {
    super(messages[code], options);
    this.name = 'LocalDataErasureError';
    this.code = code;
  }
}

export function isLocalDataErasureError(
  value: unknown,
): value is LocalDataErasureError {
  return value instanceof LocalDataErasureError;
}
