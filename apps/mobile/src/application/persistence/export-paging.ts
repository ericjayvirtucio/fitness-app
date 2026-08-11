/**
 * Keyset paging vocabulary shared by capability-owned export readers.
 *
 * Export reads walk whole tables, so they must never load lifetime history at
 * once and must never use OFFSET. Every reader returns one page plus the cursor
 * that resumes it, ordered so the order is total and stable.
 */

export const exportPagePolicy = Object.freeze({
  pageSize: 200,
});

export type ExportPage<TItem, TCursor> = Readonly<{
  items: readonly TItem[];
  nextCursor: TCursor | null;
}>;

export type ExportPageQuery<TCursor> = Readonly<{
  cursor?: TCursor;
  limit: number;
}>;

/** Ordering key for records that store the occurrence triple. */
export type OccurrenceExportCursor = Readonly<{
  id: string;
  localCalendarDate: string;
  occurredAtEpochMilliseconds: number;
}>;

/** Ordering key for name-ordered catalog records. */
export type NameExportCursor = Readonly<{
  id: string;
  normalizedName: string;
}>;
