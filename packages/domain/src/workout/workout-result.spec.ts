import { Duration, Length, Mass } from '..';
import { describe, expect, it } from 'vitest';
import { createWorkoutResult } from './workout-result';

function value<T>(
  result: { isSuccess: true; value: T } | { isSuccess: false },
): T {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('WorkoutResult', () => {
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
  ] as const)('creates a valid %s result', (loggingMode, fields, kind) => {
    const result = createWorkoutResult({ loggingMode, ...fields });
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.kind).toBe(kind);
      expect(Object.isFrozen(result.value)).toBe(true);
    }
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 10_001])(
    'rejects invalid repetitions %s',
    (repetitions) => {
      expect(
        createWorkoutResult({ loggingMode: 'repetitions', repetitions })
          .isSuccess,
      ).toBe(false);
    },
  );

  it('rejects zero resistance for a performed weighted set', () => {
    const result = createWorkoutResult({
      loggingMode: 'assistance-and-repetitions',
      repetitions: 8,
      resistance: value(Mass.create(0, 'kilogram')),
    });
    expect(result.isSuccess).toBe(false);
  });
});
