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

export type RecordedDayPrefill = Readonly<{
  localCalendarDate: string;
  time: string;
}>;

/**
 * Noon is this application's representative wall time for a local day. Both
 * daily screens already anchor a selected day at hour 12, because noon is the
 * one wall time no daylight-saving transition removes, so a form can always
 * prefill it and the entry builders can always accept it.
 */
const representativeDayTime = '12:00';

export function noonOnLocalCalendarDate(value: string): Date | null {
  if (!isLocalCalendarDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12);
}

export function formatLocalCalendarDateLabel(value: string): string {
  const date = noonOnLocalCalendarDate(value);
  if (date === null) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * A recording screen may be asked to record onto a day chosen elsewhere. The
 * request is untrusted: it arrives as a route parameter, so a day that is not
 * a local calendar date, or one that has not happened, resolves to today with
 * the current clock rather than to a value the entry builders would refuse.
 */
export function resolveRecordedDayPrefill(
  requestedLocalCalendarDate: string | undefined,
  now: Date,
): RecordedDayPrefill {
  const today = formatLocalCalendarDate(now);
  if (
    requestedLocalCalendarDate === undefined ||
    !isLocalCalendarDate(requestedLocalCalendarDate) ||
    requestedLocalCalendarDate >= today
  ) {
    return Object.freeze({
      localCalendarDate: today,
      time: formatWallClockTime(now),
    });
  }
  return Object.freeze({
    localCalendarDate: requestedLocalCalendarDate,
    time: representativeDayTime,
  });
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

function formatWallClockTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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
