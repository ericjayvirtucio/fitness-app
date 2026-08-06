import { describe, expect, it } from 'vitest';

import { Length } from '../shared/measurement/length';
import { Mass } from '../shared/measurement/mass';
import { Duration } from './duration';
import { createPlannedPrescription } from './planned-prescription';

function value<T>(result: { isSuccess: boolean; value?: T }): T {
  if (!result.isSuccess || result.value === undefined)
    throw new Error('Invalid fixture');
  return result.value;
}

describe('planned prescriptions', () => {
  it.each([
    ['repetitions', { repetitions: 8 }, 'repetitions'],
    ['bodyweight-and-repetitions', { repetitions: 12 }, 'repetitions'],
    [
      'external-load-and-repetitions',
      { repetitions: 8, resistance: value(Mass.create(60, 'kilogram')) },
      'resistance-and-repetitions',
    ],
    [
      'duration',
      { duration: value(Duration.create(45, 'second')) },
      'duration',
    ],
    [
      'distance',
      { distance: value(Length.create(5, 'kilometer')) },
      'distance',
    ],
    [
      'distance-and-duration',
      {
        distance: value(Length.create(5, 'kilometer')),
        duration: value(Duration.create(30, 'minute')),
      },
      'distance-and-duration',
    ],
  ] as const)('creates a %s prescription', (loggingMode, fields, kind) => {
    expect(
      createPlannedPrescription({ loggingMode, sets: 3, ...fields }),
    ).toMatchObject({ isSuccess: true, value: { kind, sets: 3 } });
  });

  it.each([
    { loggingMode: 'repetitions' as const, repetitions: 10, sets: 0 },
    { loggingMode: 'repetitions' as const, repetitions: -1, sets: 3 },
    { loggingMode: 'duration' as const, duration: undefined, sets: 3 },
    { loggingMode: 'distance' as const, distance: undefined, sets: 3 },
    {
      loggingMode: 'external-load-and-repetitions' as const,
      repetitions: 8,
      resistance: value(Mass.create(0, 'kilogram')),
      sets: 3,
    },
  ])('rejects invalid targets', (input) => {
    expect(createPlannedPrescription(input)).toMatchObject({
      isSuccess: false,
    });
  });

  it('allows an omitted resistance target without changing its semantics', () => {
    expect(
      createPlannedPrescription({
        loggingMode: 'assistance-and-repetitions',
        repetitions: 8,
        sets: 3,
      }),
    ).toMatchObject({
      isSuccess: true,
      value: { kind: 'resistance-and-repetitions', resistance: null },
    });
  });
});
