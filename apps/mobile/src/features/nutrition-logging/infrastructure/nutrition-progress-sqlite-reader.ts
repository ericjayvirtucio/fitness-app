import type { LocalCalendarDateRange } from '../../../application/date/local-calendar-date';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type {
  NutrientProgressValue,
  NutritionProgressDay,
  NutritionProgressReader,
} from '../application/nutrition-progress-reader';

type Row = Readonly<{
  carbohydrate_grams: number | null;
  carbohydrate_known_count: number;
  energy_kilojoules: number;
  entry_count: number;
  fat_grams: number | null;
  fat_known_count: number;
  local_calendar_date: string;
  protein_grams: number | null;
  protein_known_count: number;
}>;

export class NutritionProgressSqliteReader implements NutritionProgressReader {
  constructor(private readonly database: DatabaseConnection) {}

  async summarizeRange(
    range: LocalCalendarDateRange,
  ): Promise<readonly NutritionProgressDay[]> {
    try {
      const rows = await this.database.getAll<Row>(
        `SELECT local_calendar_date, COUNT(*) AS entry_count,
          SUM(energy_kilojoules) AS energy_kilojoules,
          SUM(protein_grams) AS protein_grams,
          COUNT(protein_grams) AS protein_known_count,
          SUM(carbohydrate_grams) AS carbohydrate_grams,
          COUNT(carbohydrate_grams) AS carbohydrate_known_count,
          SUM(fat_grams) AS fat_grams,
          COUNT(fat_grams) AS fat_known_count
        FROM nutrition_consumption_entry
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

function mapRow(row: Row): NutritionProgressDay {
  const entryCount = nonnegativeInteger(row.entry_count);
  if (entryCount < 1) throw new Error('Corrupt nutrition progress row.');
  return Object.freeze({
    carbohydrate: nutrient(
      row.carbohydrate_grams,
      row.carbohydrate_known_count,
      entryCount,
    ),
    energyKilojoules: nonnegative(row.energy_kilojoules),
    entryCount,
    fat: nutrient(row.fat_grams, row.fat_known_count, entryCount),
    localCalendarDate: row.local_calendar_date,
    protein: nutrient(row.protein_grams, row.protein_known_count, entryCount),
  });
}

function nutrient(
  total: number | null,
  knownCount: number,
  entryCount: number,
): NutrientProgressValue {
  // The comparison decides the null and is not published beside it. A caller
  // reading the absence learns exactly what a boolean would have told it.
  const isComplete = nonnegativeInteger(knownCount) === entryCount;
  return Object.freeze({ total: isComplete ? nonnegative(total) : null });
}

function nonnegative(value: number | null): number {
  if (value === null || !Number.isFinite(value) || value < 0)
    throw new Error('Corrupt nutrition progress row.');
  return value;
}

function nonnegativeInteger(value: number): number {
  if (!Number.isInteger(value) || value < 0)
    throw new Error('Corrupt nutrition progress row.');
  return value;
}
