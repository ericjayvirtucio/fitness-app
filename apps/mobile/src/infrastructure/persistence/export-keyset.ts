import type { DatabaseValue } from './database';
import type {
  ExportPage,
  NameExportCursor,
  OccurrenceExportCursor,
} from '../../application/persistence/export-paging';

/**
 * Ascending keyset predicates shared by export readers. Export walks every
 * record exactly once, so the comparison must reproduce the declared order
 * exactly and must never fall back to OFFSET.
 */

export type KeysetClause = Readonly<{
  parameters: readonly DatabaseValue[];
  sql: string;
}>;

export function occurrenceKeyset(
  columns: Readonly<{ date: string; id: string; occurredAt: string }>,
  cursor: OccurrenceExportCursor | undefined,
): KeysetClause {
  if (!cursor) return Object.freeze({ parameters: [], sql: '' });
  return Object.freeze({
    parameters: [
      cursor.localCalendarDate,
      cursor.localCalendarDate,
      cursor.occurredAtEpochMilliseconds,
      cursor.localCalendarDate,
      cursor.occurredAtEpochMilliseconds,
      cursor.id,
    ],
    sql: `${columns.date} > ?
       OR (${columns.date} = ? AND ${columns.occurredAt} > ?)
       OR (${columns.date} = ? AND ${columns.occurredAt} = ? AND ${columns.id} > ?)`,
  });
}

export function nameKeyset(
  columns: Readonly<{ id: string; name: string }>,
  cursor: NameExportCursor | undefined,
): KeysetClause {
  if (!cursor) return Object.freeze({ parameters: [], sql: '' });
  return Object.freeze({
    parameters: [cursor.normalizedName, cursor.normalizedName, cursor.id],
    sql: `${columns.name} > ?
       OR (${columns.name} = ? AND ${columns.id} > ?)`,
  });
}

/**
 * Reads one extra row so the presence of a further page is known without a
 * second count query.
 */
export function toExportPage<TRow, TItem, TCursor>(
  rows: readonly TRow[],
  limit: number,
  map: (row: TRow) => TItem,
  toCursor: (row: TRow) => TCursor,
): ExportPage<TItem, TCursor> {
  const page = rows.slice(0, limit);
  const lastRow = page.at(-1);
  return Object.freeze({
    items: Object.freeze(page.map(map)),
    nextCursor:
      rows.length > limit && lastRow !== undefined ? toCursor(lastRow) : null,
  });
}
