import type { BodyWeightEntry } from '@fitness/domain';

export const bodyWeightHistoryPagePolicy = Object.freeze({
  defaultLimit: 20,
  maximumLimit: 50,
});

// Ordering key for both listing and "latest". Comparing the captured calendar
// date first keeps history stable when a device offset changes later.
export type BodyWeightHistoryCursor = Readonly<{
  id: string;
  localCalendarDate: string;
  occurredAtEpochMilliseconds: number;
}>;

export type BodyWeightHistoryPage = Readonly<{
  items: readonly BodyWeightEntry[];
  nextCursor: BodyWeightHistoryCursor | null;
}>;

export type BodyWeightHistoryPageQuery = Readonly<{
  cursor?: BodyWeightHistoryCursor;
  limit?: number;
}>;

export function toBodyWeightHistoryCursor(
  entry: BodyWeightEntry,
): BodyWeightHistoryCursor {
  return Object.freeze({
    id: entry.id.value,
    localCalendarDate: entry.localCalendarDate,
    occurredAtEpochMilliseconds: entry.occurredAtEpochMilliseconds,
  });
}

export function isAfterBodyWeightEntry(
  candidate: BodyWeightEntry,
  other: BodyWeightEntry,
): boolean {
  if (candidate.localCalendarDate !== other.localCalendarDate)
    return candidate.localCalendarDate > other.localCalendarDate;
  if (
    candidate.occurredAtEpochMilliseconds !== other.occurredAtEpochMilliseconds
  )
    return (
      candidate.occurredAtEpochMilliseconds > other.occurredAtEpochMilliseconds
    );
  return candidate.id.value >= other.id.value;
}
