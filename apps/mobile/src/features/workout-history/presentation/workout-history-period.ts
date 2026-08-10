import {
  getCalendarPeriodDetails,
  moveCalendarPeriod,
} from '../../../application/date/local-calendar-date';
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
  return getCalendarPeriodDetails(anchor, period);
}

export function moveWorkoutHistoryPeriod(
  anchor: Date,
  period: WorkoutHistoryPeriod,
  direction: -1 | 1,
): Date {
  return moveCalendarPeriod(anchor, period, direction);
}
