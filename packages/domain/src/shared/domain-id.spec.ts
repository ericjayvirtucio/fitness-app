import { describe, expect, it } from 'vitest';

import { DomainId } from './domain-id';
import { isErr, isOk } from './result';

const uppercaseId = '550E8400-E29B-41D4-A716-446655440000';
const lowercaseId = uppercaseId.toLowerCase();

describe('DomainId', () => {
  it('accepts an RFC 4122 UUID and normalizes its case', () => {
    const result = DomainId.create(uppercaseId);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.value).toBe(lowercaseId);
      expect(Object.isFrozen(result.value)).toBe(true);
    }
  });

  it.each([
    undefined,
    null,
    42,
    '',
    'not-a-uuid',
    '550e8400-e29b-41d4-0716-446655440000',
  ])('rejects an invalid identifier value: %s', (value) => {
    const result = DomainId.create(value);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('invalid-identifier');
    }
  });

  it('compares identifiers by normalized value', () => {
    const first = DomainId.create(uppercaseId);
    const second = DomainId.create(lowercaseId);
    const other = DomainId.create('6ba7b810-9dad-41d1-80b4-00c04fd430c8');

    if (isOk(first) && isOk(second) && isOk(other)) {
      expect(first.value.equals(second.value)).toBe(true);
      expect(first.value.equals(other.value)).toBe(false);
    } else {
      throw new Error('Test fixtures must be valid UUIDs.');
    }
  });
});
