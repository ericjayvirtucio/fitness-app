import type { LocalCalendarDateRange } from '../../../application/date/local-calendar-date';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type {
  HydrationProgressDay,
  HydrationProgressReader,
} from '../application/hydration-progress-reader';

type Row = Readonly<{
  entry_count: number;
  local_calendar_date: string;
  other_fluid_milliliters: number;
  plain_water_milliliters: number;
  total_fluid_milliliters: number;
}>;

export class HydrationProgressSqliteReader implements HydrationProgressReader {
  constructor(private readonly database: DatabaseConnection) {}

  async summarizeRange(
    range: LocalCalendarDateRange,
  ): Promise<readonly HydrationProgressDay[]> {
    try {
      const rows = await this.database.getAll<Row>(
        `SELECT local_calendar_date, COUNT(*) AS entry_count,
          SUM(volume_milliliters) AS total_fluid_milliliters,
          SUM(CASE WHEN fluid_type = 'plain-water' THEN volume_milliliters ELSE 0 END) AS plain_water_milliliters,
          SUM(CASE WHEN fluid_type = 'other-fluid' THEN volume_milliliters ELSE 0 END) AS other_fluid_milliliters
        FROM hydration_entry
        WHERE local_calendar_date BETWEEN ? AND ?
        GROUP BY local_calendar_date
        ORDER BY local_calendar_date ASC`,
        [range.startLocalCalendarDate, range.endLocalCalendarDate],
      );
      return Object.freeze(rows.map(mapRow));
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}

function mapRow(row: Row): HydrationProgressDay {
  return Object.freeze({
    entryCount: positiveInteger(row.entry_count),
    localCalendarDate: row.local_calendar_date,
    otherFluidMilliliters: nonnegative(row.other_fluid_milliliters),
    plainWaterMilliliters: nonnegative(row.plain_water_milliliters),
    totalFluidMilliliters: nonnegative(row.total_fluid_milliliters),
  });
}

function nonnegative(value: number): number {
  if (!Number.isFinite(value) || value < 0)
    throw new Error('Corrupt hydration progress row.');
  return value;
}

function positiveInteger(value: number): number {
  if (!Number.isInteger(value) || value < 1)
    throw new Error('Corrupt hydration progress row.');
  return value;
}
