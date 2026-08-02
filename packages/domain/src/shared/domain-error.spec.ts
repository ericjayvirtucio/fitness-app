import { describe, expect, it } from 'vitest';

import { DomainError, domainErrorCodes } from './domain-error';

describe('DomainError', () => {
  it('preserves safe structured error information', () => {
    const error = DomainError.create(
      'negative-measurement',
      'Measurement cannot be negative.',
      'value',
    );

    expect(error).toEqual({
      code: 'negative-measurement',
      field: 'value',
      message: 'Measurement cannot be negative.',
    });
  });

  it('is immutable', () => {
    const error = DomainError.create('invalid-number', 'Invalid number.');

    expect(Object.isFrozen(error)).toBe(true);
    expect(Reflect.set(error, 'message', 'Changed')).toBe(false);
  });

  it('publishes the stable error-code vocabulary', () => {
    expect(domainErrorCodes).toEqual([
      'invalid-date',
      'invalid-identifier',
      'invalid-number',
      'negative-measurement',
      'out-of-range',
      'required-field',
      'unsupported-option',
      'unsupported-unit',
    ]);
    expect(Object.isFrozen(domainErrorCodes)).toBe(true);
  });
});
