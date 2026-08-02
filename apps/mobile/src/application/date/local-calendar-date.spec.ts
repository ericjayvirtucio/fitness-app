import { formatLocalCalendarDate } from './local-calendar-date';

describe('formatLocalCalendarDate', () => {
  it('uses local calendar fields without converting to UTC', () => {
    const date = new Date(2026, 7, 2, 23, 30);
    expect(formatLocalCalendarDate(date)).toBe('2026-08-02');
  });
});
