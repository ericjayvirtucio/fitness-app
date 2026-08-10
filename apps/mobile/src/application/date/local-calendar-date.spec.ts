import {
  enumerateLocalCalendarDates,
  formatLocalCalendarDate,
  getCalendarPeriodDetails,
  isLocalCalendarDateRange,
  moveCalendarPeriod,
} from './local-calendar-date';

describe('formatLocalCalendarDate', () => {
  it('uses local calendar fields without converting to UTC', () => {
    const date = new Date(2026, 7, 2, 23, 30);
    expect(formatLocalCalendarDate(date)).toBe('2026-08-02');
  });
});

describe('calendar periods', () => {
  it('uses Sunday through Saturday without UTC conversion', () => {
    expect(
      getCalendarPeriodDetails(new Date(2026, 7, 5, 23), 'week').range,
    ).toEqual({
      endLocalCalendarDate: '2026-08-08',
      startLocalCalendarDate: '2026-08-02',
    });
  });

  it('uses real month boundaries and moves safely from a long month', () => {
    const moved = moveCalendarPeriod(new Date(2026, 0, 31), 'month', 1);
    expect(getCalendarPeriodDetails(moved, 'month').range).toEqual({
      endLocalCalendarDate: '2026-02-28',
      startLocalCalendarDate: '2026-02-01',
    });
  });

  it('enumerates inclusive dates and rejects invalid ranges', () => {
    expect(
      enumerateLocalCalendarDates({
        endLocalCalendarDate: '2026-08-03',
        startLocalCalendarDate: '2026-08-01',
      }),
    ).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    expect(
      isLocalCalendarDateRange({
        endLocalCalendarDate: '2026-02-30',
        startLocalCalendarDate: '2026-02-01',
      }),
    ).toBe(false);
  });
});
