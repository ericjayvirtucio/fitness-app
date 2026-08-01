import { describe, expect, it } from 'vitest';

import {
  DomainError,
  DomainId,
  Duration,
  Energy,
  Length,
  Mass,
  Volume,
  err,
  isErr,
  isOk,
  ok,
} from './index';

describe('@fitness/domain public API', () => {
  it('exports every approved runtime concept', () => {
    expect([
      DomainError,
      DomainId,
      Duration,
      Energy,
      Length,
      Mass,
      Volume,
      err,
      isErr,
      isOk,
      ok,
    ]).not.toContain(undefined);
  });
});
