export function formatLocalCalendarDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type CalendarPeriod = 'day' | 'week' | 'month';

export type LocalCalendarDateRange = Readonly<{
  endLocalCalendarDate: string;
  startLocalCalendarDate: string;
}>;

export type CalendarPeriodDetails = Readonly<{
  label: string;
  range: LocalCalendarDateRange;
}>;

export function isLocalCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return formatLocalCalendarDate(date) === value;
}

export function isLocalCalendarDateRange(
  range: LocalCalendarDateRange,
): boolean {
  return (
    isLocalCalendarDate(range.startLocalCalendarDate) &&
    isLocalCalendarDate(range.endLocalCalendarDate) &&
    range.startLocalCalendarDate <= range.endLocalCalendarDate
  );
}

export function getCalendarPeriodDetails(
  anchor: Date,
  period: CalendarPeriod,
): CalendarPeriodDetails {
  const start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
  );
  const end = new Date(start);
  if (period === 'week') {
    start.setDate(start.getDate() - start.getDay());
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  } else if (period === 'month') {
    start.setDate(1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
  }
  return {
    label: formatPeriodLabel(start, end, period),
    range: {
      endLocalCalendarDate: formatLocalCalendarDate(end),
      startLocalCalendarDate: formatLocalCalendarDate(start),
    },
  };
}

export function moveCalendarPeriod(
  anchor: Date,
  period: CalendarPeriod,
  direction: -1 | 1,
): Date {
  const moved = new Date(anchor);
  if (period === 'day') moved.setDate(moved.getDate() + direction);
  else if (period === 'week') moved.setDate(moved.getDate() + direction * 7);
  else moved.setMonth(moved.getMonth() + direction, 1);
  return moved;
}

export function enumerateLocalCalendarDates(
  range: LocalCalendarDateRange,
): readonly string[] {
  if (!isLocalCalendarDateRange(range))
    throw new Error('Local calendar date range is invalid.');
  const [year, month, day] = range.startLocalCalendarDate
    .split('-')
    .map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const dates: string[] = [];
  while (formatLocalCalendarDate(date) <= range.endLocalCalendarDate) {
    dates.push(formatLocalCalendarDate(date));
    date.setDate(date.getDate() + 1);
  }
  return Object.freeze(dates);
}

function formatPeriodLabel(
  start: Date,
  end: Date,
  period: CalendarPeriod,
): string {
  if (period === 'day')
    return start.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  if (period === 'month')
    return start.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  const startLabel = start.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
  const endLabel = end.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}
