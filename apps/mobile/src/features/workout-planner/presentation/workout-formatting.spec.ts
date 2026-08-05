import {
  Duration,
  Length,
  Mass,
  createPlannedPrescription,
} from '@fitness/domain';
import { formatPrescription, weekdayLabels } from './workout-formatting';

function value<T>(result: { isSuccess: boolean; value?: T }): T {
  if (!result.isSuccess || result.value === undefined)
    throw new Error('Invalid fixture');
  return result.value;
}

describe('workout formatting', () => {
  it('publishes an explicit Sunday-first label map', () => {
    expect(Object.values(weekdayLabels)).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
  });

  it('formats canonical resistance and distance for the preferred units', () => {
    const weighted = value(
      createPlannedPrescription({
        loggingMode: 'external-load-and-repetitions',
        repetitions: 8,
        resistance: value(Mass.create(60, 'kilogram')),
        sets: 4,
      }),
    );
    expect(formatPrescription(weighted, 'metric')).toBe('4 × 8 reps at 60 kg');
    expect(formatPrescription(weighted, 'imperial')).toBe(
      '4 × 8 reps at 132.28 lb',
    );
    const cardio = value(
      createPlannedPrescription({
        distance: value(Length.create(5, 'kilometer')),
        duration: value(Duration.create(30, 'minute')),
        loggingMode: 'distance-and-duration',
        sets: 1,
      }),
    );
    expect(formatPrescription(cardio, 'metric')).toBe('1 × 5 km in 30 min');
  });
});
