export const domainErrorCodes = Object.freeze([
  'invalid-date',
  'invalid-identifier',
  'invalid-number',
  'negative-measurement',
  'out-of-range',
  'required-field',
  'unsupported-option',
  'unsupported-unit',
] as const);

export type DomainErrorCode = (typeof domainErrorCodes)[number];

export class DomainError {
  readonly code: DomainErrorCode;
  readonly field?: string;
  readonly message: string;

  private constructor(code: DomainErrorCode, message: string, field?: string) {
    this.code = code;
    this.message = message;
    if (field !== undefined) {
      this.field = field;
    }
    Object.freeze(this);
  }

  static create(
    code: DomainErrorCode,
    message: string,
    field?: string,
  ): DomainError {
    return new DomainError(code, message, field);
  }
}
