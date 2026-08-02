import type { DatabaseConnection } from './database';

export type Migration = Readonly<{
  description: string;
  up: (transaction: DatabaseConnection) => Promise<void>;
  version: number;
}>;

export const migrations: readonly Migration[] = [
  {
    description: 'Establish the local persistence schema baseline.',
    up: () => Promise.resolve(),
    version: 1,
  },
  {
    description: 'Add the single personal profile record.',
    up: (transaction) =>
      transaction.exec(`
        CREATE TABLE personal_profile (
          singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
          height_millimeters REAL NOT NULL,
          weight_grams REAL NOT NULL,
          biological_sex TEXT NOT NULL CHECK (
            biological_sex IN ('female', 'male', 'intersex', 'prefer-not-to-say')
          ),
          date_of_birth TEXT NOT NULL,
          activity_level TEXT NOT NULL CHECK (
            activity_level IN (
              'sedentary',
              'lightly-active',
              'moderately-active',
              'very-active',
              'extremely-active'
            )
          ),
          preferred_unit_system TEXT NOT NULL CHECK (
            preferred_unit_system IN ('metric', 'imperial')
          )
        )
      `),
    version: 2,
  },
  {
    description: 'Add the single goals and energy configuration.',
    up: (transaction) =>
      transaction.exec(`
        CREATE TABLE goal_configuration (
          singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
          goal_type TEXT NOT NULL CHECK (
            goal_type IN ('lose-weight', 'maintain-weight', 'gain-weight')
          ),
          adjustment_kilocalories INTEGER NOT NULL CHECK (
            adjustment_kilocalories >= 0 AND adjustment_kilocalories <= 500
          ),
          CHECK (
            (goal_type = 'maintain-weight' AND adjustment_kilocalories = 0)
            OR
            (goal_type IN ('lose-weight', 'gain-weight')
              AND adjustment_kilocalories >= 100)
          )
        )
      `),
    version: 3,
  },
  {
    description: 'Add offline nutrition consumption entries.',
    up: async (transaction) => {
      await transaction.exec(`
        CREATE TABLE nutrition_consumption_entry (
          id TEXT PRIMARY KEY,
          entry_kind TEXT NOT NULL CHECK (entry_kind IN ('food', 'beverage')),
          description TEXT NOT NULL CHECK (length(trim(description)) > 0),
          reference_kind TEXT NOT NULL CHECK (
            reference_kind IN ('mass', 'volume')
          ),
          reference_amount REAL NOT NULL CHECK (reference_amount > 0),
          consumed_amount REAL NOT NULL CHECK (consumed_amount > 0),
          energy_kilojoules REAL NOT NULL CHECK (energy_kilojoules >= 0),
          protein_grams REAL CHECK (protein_grams IS NULL OR protein_grams >= 0),
          carbohydrate_grams REAL CHECK (
            carbohydrate_grams IS NULL OR carbohydrate_grams >= 0
          ),
          fat_grams REAL CHECK (fat_grams IS NULL OR fat_grams >= 0),
          fiber_grams REAL CHECK (fiber_grams IS NULL OR fiber_grams >= 0),
          sugar_grams REAL CHECK (sugar_grams IS NULL OR sugar_grams >= 0),
          sodium_milligrams REAL CHECK (
            sodium_milligrams IS NULL OR sodium_milligrams >= 0
          ),
          provenance TEXT NOT NULL CHECK (
            provenance IN ('provided', 'estimated')
          ),
          occurred_at_epoch_ms INTEGER NOT NULL CHECK (
            occurred_at_epoch_ms >= 0
          ),
          local_calendar_date TEXT NOT NULL,
          utc_offset_minutes INTEGER NOT NULL CHECK (
            utc_offset_minutes BETWEEN -840 AND 840
          )
        )
      `);
      await transaction.exec(`
        CREATE INDEX nutrition_consumption_entry_local_date_occurred_at
        ON nutrition_consumption_entry (
          local_calendar_date,
          occurred_at_epoch_ms DESC,
          id
        )
      `);
    },
    version: 4,
  },
];
