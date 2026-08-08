import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import type { WorkoutHistoryRange } from '../application/workout-history-models';

export type WorkoutHistoryPeriod = 'day' | 'week' | 'month';

export type WorkoutHistoryPeriodDetails = Readonly<{
  label: string;
  range: WorkoutHistoryRange;
}>;

export function getWorkoutHistoryPeriodDetails(
  anchor: Date,
  period: WorkoutHistoryPeriod,
): WorkoutHistoryPeriodDetails {
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

export function moveWorkoutHistoryPeriod(
  anchor: Date,
  period: WorkoutHistoryPeriod,
  direction: -1 | 1,
): Date {
  const moved = new Date(anchor);
  if (period === 'day') moved.setDate(moved.getDate() + direction);
  else if (period === 'week') moved.setDate(moved.getDate() + direction * 7);
  else moved.setMonth(moved.getMonth() + direction, 1);
  return moved;
}

function formatPeriodLabel(
  start: Date,
  end: Date,
  period: WorkoutHistoryPeriod,
) {
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
