export type PersistenceErrorCode =
  | 'initialization-failed'
  | 'migration-failed'
  | 'operation-failed'
  | 'transaction-failed'
  | 'unsupported-schema-version';

const messages: Readonly<Record<PersistenceErrorCode, string>> = {
  'initialization-failed': 'Local storage could not be initialized.',
  'migration-failed': 'Local storage could not be updated.',
  'operation-failed': 'The local storage operation failed.',
  'transaction-failed': 'The local storage transaction failed.',
  'unsupported-schema-version':
    'This app version cannot open the local database.',
};

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, options?: ErrorOptions) {
    super(messages[code], options);
    this.name = 'PersistenceError';
    this.code = code;
  }
}

export function toPersistenceError(
  error: unknown,
  code: PersistenceErrorCode,
): PersistenceError {
  return error instanceof PersistenceError
    ? error
    : new PersistenceError(code, { cause: error });
}
