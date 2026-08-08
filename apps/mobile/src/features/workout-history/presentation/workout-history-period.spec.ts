import {
  getWorkoutHistoryPeriodDetails,
  moveWorkoutHistoryPeriod,
} from './workout-history-period';

describe('workout history periods', () => {
  it('uses the established Sunday-to-Saturday week', () => {
    expect(
      getWorkoutHistoryPeriodDetails(new Date(2026, 7, 8), 'week').range,
    ).toEqual({
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    });
  });

  it('uses real calendar-month boundaries including leap days', () => {
    expect(
      getWorkoutHistoryPeriodDetails(new Date(2024, 1, 20), 'month').range,
    ).toEqual({
      endLocalCalendarDate: '2024-02-29',
      startLocalCalendarDate: '2024-02-01',
    });
  });

  it('moves periods without turning months into rolling day counts', () => {
    const moved = moveWorkoutHistoryPeriod(new Date(2026, 0, 31), 'month', 1);
    expect(getWorkoutHistoryPeriodDetails(moved, 'month').range).toEqual({
      endLocalCalendarDate: '2026-02-28',
      startLocalCalendarDate: '2026-02-01',
    });
  });
});
