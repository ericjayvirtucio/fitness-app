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
];
