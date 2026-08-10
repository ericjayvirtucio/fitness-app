import type { LocalCalendarDateRange } from '../../../application/date/local-calendar-date';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type {
  BodyWeightProgressReader,
  BodyWeightProgressSummary,
} from '../application/body-weight-progress-reader';

type Row = Readonly<{
  entry_count: number;
  first_local_calendar_date: string;
  first_mass_grams: number;
  latest_local_calendar_date: string;
  latest_mass_grams: number;
}>;

/**
 * Both boundary sub-selects return at most one row, so the cross join yields
 * exactly one row when the period holds a check-in and no row when it does
 * not. An empty period is absence of data, never a zero weight.
 */
const summaryStatement = `
  SELECT
    (SELECT COUNT(*) FROM body_weight_entry
      WHERE local_calendar_date BETWEEN ? AND ?) AS entry_count,
    first_entry.mass_grams AS first_mass_grams,
    first_entry.local_calendar_date AS first_local_calendar_date,
    latest_entry.mass_grams AS latest_mass_grams,
    latest_entry.local_calendar_date AS latest_local_calendar_date
  FROM
    (SELECT mass_grams, local_calendar_date FROM body_weight_entry
      WHERE local_calendar_date BETWEEN ? AND ?
      ORDER BY local_calendar_date ASC, occurred_at_epoch_ms ASC, id ASC
      LIMIT 1) AS first_entry,
    (SELECT mass_grams, local_calendar_date FROM body_weight_entry
      WHERE local_calendar_date BETWEEN ? AND ?
      ORDER BY local_calendar_date DESC, occurred_at_epoch_ms DESC, id DESC
      LIMIT 1) AS latest_entry`;

export class BodyWeightProgressSqliteReader implements BodyWeightProgressReader {
  constructor(private readonly database: DatabaseConnection) {}

  async summarizeRange(
    range: LocalCalendarDateRange,
  ): Promise<BodyWeightProgressSummary | null> {
    const bounds = [
      range.startLocalCalendarDate,
      range.endLocalCalendarDate,
    ] as const;
    try {
      const row = await this.database.getFirst<Row>(summaryStatement, [
        ...bounds,
        ...bounds,
        ...bounds,
      ]);
      return row === null ? null : mapRow(row);
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}

function mapRow(row: Row): BodyWeightProgressSummary {
  const entryCount = row.entry_count;
  if (!Number.isInteger(entryCount) || entryCount < 1)
    throw new Error('Corrupt body weight progress row.');
  const firstGrams = positiveMass(row.first_mass_grams);
  const latestGrams = positiveMass(row.latest_mass_grams);
  return Object.freeze({
    changeGrams: entryCount < 2 ? null : latestGrams - firstGrams,
    entryCount,
    firstGrams,
    firstLocalCalendarDate: row.first_local_calendar_date,
    latestGrams,
    latestLocalCalendarDate: row.latest_local_calendar_date,
  });
}

function positiveMass(value: number): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error('Corrupt body weight progress row.');
  return value;
}
