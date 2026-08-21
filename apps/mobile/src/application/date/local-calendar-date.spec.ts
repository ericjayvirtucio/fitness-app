import {
  enumerateLocalCalendarDates,
  formatLocalCalendarDate,
  formatLocalCalendarDateLabel,
  getCalendarPeriodDetails,
  isLocalCalendarDateRange,
  moveCalendarPeriod,
  noonOnLocalCalendarDate,
  resolveRecordedDayPrefill,
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

describe('noonOnLocalCalendarDate', () => {
  it('anchors a local day at noon and rejects an impossible date', () => {
    const noon = noonOnLocalCalendarDate('2026-08-19');
    expect(noon?.getFullYear()).toBe(2026);
    expect(noon?.getMonth()).toBe(7);
    expect(noon?.getDate()).toBe(19);
    expect(noon?.getHours()).toBe(12);
    expect(noonOnLocalCalendarDate('2026-02-30')).toBeNull();
    expect(noonOnLocalCalendarDate('yesterday')).toBeNull();
  });
});

describe('formatLocalCalendarDateLabel', () => {
  it('names a day the way a daily screen heading names it', () => {
    expect(formatLocalCalendarDateLabel('2026-08-19')).toBe(
      new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(2026, 7, 19, 12)),
    );
  });

  it('returns an unusable value unchanged rather than inventing a day', () => {
    expect(formatLocalCalendarDateLabel('2026-02-30')).toBe('2026-02-30');
  });
});

describe('resolveRecordedDayPrefill', () => {
  const now = new Date(2026, 7, 20, 9, 5);

  it('uses today and the current clock when no day was requested', () => {
    expect(resolveRecordedDayPrefill(undefined, now)).toEqual({
      localCalendarDate: '2026-08-20',
      time: '09:05',
    });
  });

  it('uses the current clock when the requested day is today', () => {
    expect(resolveRecordedDayPrefill('2026-08-20', now)).toEqual({
      localCalendarDate: '2026-08-20',
      time: '09:05',
    });
  });

  it('uses the requested past day at noon', () => {
    expect(resolveRecordedDayPrefill('2026-08-19', now)).toEqual({
      localCalendarDate: '2026-08-19',
      time: '12:00',
    });
  });

  it('falls back to today for a day that has not happened', () => {
    expect(resolveRecordedDayPrefill('2026-08-21', now)).toEqual({
      localCalendarDate: '2026-08-20',
      time: '09:05',
    });
  });

  it('falls back to today for a malformed or impossible day', () => {
    expect(resolveRecordedDayPrefill('not-a-date', now)).toEqual({
      localCalendarDate: '2026-08-20',
      time: '09:05',
    });
    expect(resolveRecordedDayPrefill('2026-02-30', now)).toEqual({
      localCalendarDate: '2026-08-20',
      time: '09:05',
    });
  });
});
