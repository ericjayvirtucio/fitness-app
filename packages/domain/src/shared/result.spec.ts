import { describe, expect, it } from 'vitest';

import { err, isErr, isOk, ok } from './result';

describe('Result', () => {
  it('represents and narrows a successful result', () => {
    const result = ok('value');

    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) {
      expect(result.value).toBe('value');
    }
  });

  it('represents and narrows a failed result', () => {
    const result = err('failure');

    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    if (isErr(result)) {
      expect(result.error).toBe('failure');
    }
  });

  it('freezes the result container', () => {
    const result = ok('value');

    expect(Object.isFrozen(result)).toBe(true);
    expect(Reflect.set(result, 'isSuccess', false)).toBe(false);
  });
});
