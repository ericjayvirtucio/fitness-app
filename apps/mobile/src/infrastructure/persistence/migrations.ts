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
  {
    description: 'Add reusable nutrition catalog items.',
    up: async (transaction) => {
      await transaction.exec(`
        CREATE TABLE nutrition_catalog_item (
          id TEXT PRIMARY KEY,
          item_kind TEXT NOT NULL CHECK (item_kind IN ('food', 'beverage')),
          display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
          normalized_name TEXT NOT NULL CHECK (length(normalized_name) > 0),
          reference_kind TEXT NOT NULL CHECK (
            reference_kind IN ('mass', 'volume')
          ),
          reference_amount REAL NOT NULL CHECK (reference_amount > 0),
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
          is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
          last_used_at_epoch_ms INTEGER CHECK (
            last_used_at_epoch_ms IS NULL OR last_used_at_epoch_ms >= 0
          ),
          use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
          CHECK (
            (item_kind = 'food' AND reference_kind = 'mass')
            OR
            (item_kind = 'beverage' AND reference_kind = 'volume')
          ),
          CHECK (
            (use_count = 0 AND last_used_at_epoch_ms IS NULL)
            OR
            (use_count > 0 AND last_used_at_epoch_ms IS NOT NULL)
          )
        )
      `);
      await transaction.exec(`
        CREATE INDEX nutrition_catalog_item_normalized_name
        ON nutrition_catalog_item (normalized_name, id)
      `);
      await transaction.exec(`
        CREATE INDEX nutrition_catalog_item_favorites
        ON nutrition_catalog_item (is_favorite, normalized_name, id)
      `);
      await transaction.exec(`
        CREATE INDEX nutrition_catalog_item_recents
        ON nutrition_catalog_item (
          last_used_at_epoch_ms DESC,
          use_count DESC,
          normalized_name,
          id
        )
      `);
    },
    version: 5,
  },
  {
    description: 'Add offline hydration entries and target.',
    up: async (transaction) => {
      await transaction.exec(`
        CREATE TABLE hydration_entry (
          id TEXT PRIMARY KEY,
          fluid_type TEXT NOT NULL CHECK (
            fluid_type IN ('plain-water', 'other-fluid')
          ),
          volume_milliliters REAL NOT NULL CHECK (
            volume_milliliters > 0 AND volume_milliliters <= 10000
          ),
          description TEXT CHECK (
            description IS NULL OR (
              length(trim(description)) > 0 AND length(trim(description)) <= 80
            )
          ),
          occurred_at_epoch_ms INTEGER NOT NULL CHECK (
            occurred_at_epoch_ms >= 0
          ),
          local_calendar_date TEXT NOT NULL,
          utc_offset_minutes INTEGER NOT NULL CHECK (
            utc_offset_minutes BETWEEN -840 AND 840
          ),
          CHECK (
            (fluid_type = 'plain-water' AND description IS NULL)
            OR fluid_type = 'other-fluid'
          )
        )
      `);
      await transaction.exec(`
        CREATE INDEX hydration_entry_local_date_occurred_at
        ON hydration_entry (
          local_calendar_date,
          occurred_at_epoch_ms DESC,
          id
        )
      `);
      await transaction.exec(`
        CREATE TABLE hydration_target (
          singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
          target_milliliters REAL NOT NULL CHECK (
            target_milliliters > 0 AND target_milliliters <= 20000
          )
        )
      `);
    },
    version: 6,
  },
  {
    description: 'Add the offline exercise catalog.',
    up: async (transaction) => {
      await transaction.exec(`
        CREATE TABLE exercise_catalog_item (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL CHECK (
            length(trim(display_name)) BETWEEN 1 AND 80
          ),
          normalized_name TEXT NOT NULL CHECK (length(normalized_name) > 0),
          equipment TEXT NOT NULL CHECK (equipment IN (
            'none', 'bodyweight', 'barbell', 'dumbbell', 'kettlebell',
            'machine', 'cable', 'resistance-band', 'cardio-machine', 'other'
          )),
          primary_muscle_group TEXT NOT NULL CHECK (primary_muscle_group IN (
            'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps',
            'hamstrings', 'glutes', 'calves', 'core', 'full-body',
            'conditioning', 'other'
          )),
          logging_mode TEXT NOT NULL CHECK (logging_mode IN (
            'repetitions', 'external-load-and-repetitions',
            'bodyweight-and-repetitions',
            'bodyweight-plus-load-and-repetitions',
            'assistance-and-repetitions', 'duration', 'distance',
            'distance-and-duration'
          )),
          notes TEXT CHECK (
            notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 500
          ),
          is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
          CHECK (
            logging_mode NOT IN (
              'bodyweight-and-repetitions',
              'bodyweight-plus-load-and-repetitions'
            ) OR equipment = 'bodyweight'
          ),
          CHECK (
            logging_mode != 'assistance-and-repetitions'
            OR equipment IN ('machine', 'resistance-band', 'other')
          ),
          CHECK (
            logging_mode NOT IN ('distance', 'distance-and-duration')
            OR equipment IN ('none', 'cardio-machine', 'other')
          )
        )
      `);
      await transaction.exec(`
        CREATE INDEX exercise_catalog_item_normalized_name
        ON exercise_catalog_item (normalized_name, id)
      `);
      await transaction.exec(`
        CREATE INDEX exercise_catalog_item_favorites
        ON exercise_catalog_item (is_favorite, normalized_name, id)
      `);
    },
    version: 7,
  },
  {
    description: 'Add the recurring offline workout planner.',
    up: async (transaction) => {
      await transaction.exec(`
        CREATE TABLE planned_workout (
          id TEXT PRIMARY KEY,
          weekday INTEGER NOT NULL UNIQUE CHECK (weekday BETWEEN 0 AND 6),
          display_name TEXT NOT NULL CHECK (
            length(trim(display_name)) BETWEEN 1 AND 80
          )
        )
      `);
      await transaction.exec(`
        CREATE TABLE planned_exercise (
          id TEXT PRIMARY KEY,
          planned_workout_id TEXT NOT NULL REFERENCES planned_workout(id)
            ON DELETE CASCADE,
          exercise_definition_id TEXT NOT NULL REFERENCES exercise_catalog_item(id)
            ON DELETE RESTRICT,
          position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 99),
          prescription_kind TEXT NOT NULL CHECK (prescription_kind IN (
            'repetitions', 'resistance-and-repetitions', 'duration',
            'distance', 'distance-and-duration'
          )),
          planned_sets INTEGER NOT NULL CHECK (planned_sets BETWEEN 1 AND 100),
          planned_repetitions INTEGER CHECK (
            planned_repetitions IS NULL OR planned_repetitions BETWEEN 1 AND 10000
          ),
          planned_resistance_grams REAL CHECK (
            planned_resistance_grams IS NULL OR
            planned_resistance_grams > 0 AND planned_resistance_grams <= 1000000
          ),
          planned_duration_seconds REAL CHECK (
            planned_duration_seconds IS NULL OR
            planned_duration_seconds > 0 AND planned_duration_seconds <= 604800
          ),
          planned_distance_millimeters REAL CHECK (
            planned_distance_millimeters IS NULL OR
            planned_distance_millimeters > 0 AND
            planned_distance_millimeters <= 1000000000
          ),
          UNIQUE (planned_workout_id, position),
          CHECK (
            (prescription_kind = 'repetitions'
              AND planned_repetitions IS NOT NULL
              AND planned_resistance_grams IS NULL
              AND planned_duration_seconds IS NULL
              AND planned_distance_millimeters IS NULL)
            OR
            (prescription_kind = 'resistance-and-repetitions'
              AND planned_repetitions IS NOT NULL
              AND planned_duration_seconds IS NULL
              AND planned_distance_millimeters IS NULL)
            OR
            (prescription_kind = 'duration'
              AND planned_repetitions IS NULL
              AND planned_resistance_grams IS NULL
              AND planned_duration_seconds IS NOT NULL
              AND planned_distance_millimeters IS NULL)
            OR
            (prescription_kind = 'distance'
              AND planned_repetitions IS NULL
              AND planned_resistance_grams IS NULL
              AND planned_duration_seconds IS NULL
              AND planned_distance_millimeters IS NOT NULL)
            OR
            (prescription_kind = 'distance-and-duration'
              AND planned_repetitions IS NULL
              AND planned_resistance_grams IS NULL
              AND planned_duration_seconds IS NOT NULL
              AND planned_distance_millimeters IS NOT NULL)
          )
        )
      `);
      await transaction.exec(`
        CREATE INDEX planned_exercise_definition_reference
        ON planned_exercise (exercise_definition_id, planned_workout_id)
      `);
      await transaction.exec(`
        CREATE TRIGGER prevent_referenced_exercise_logging_mode_change
        BEFORE UPDATE OF logging_mode ON exercise_catalog_item
        WHEN OLD.logging_mode != NEW.logging_mode
          AND EXISTS (
            SELECT 1 FROM planned_exercise
            WHERE exercise_definition_id = OLD.id
          )
        BEGIN
          SELECT RAISE(ABORT, 'referenced exercise logging mode');
        END
      `);
    },
    version: 8,
  },
  {
    description: 'Add durable offline workout sessions and actual sets.',
    up: async (transaction) => {
      await transaction.exec(`
        CREATE TABLE workout_session (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL CHECK (
            length(trim(display_name)) BETWEEN 1 AND 80
          ),
          status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
          started_at_epoch_ms INTEGER NOT NULL CHECK (started_at_epoch_ms >= 0),
          started_local_calendar_date TEXT NOT NULL CHECK (
            started_local_calendar_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
          ),
          started_utc_offset_minutes INTEGER NOT NULL CHECK (
            started_utc_offset_minutes BETWEEN -840 AND 840
          ),
          completed_at_epoch_ms INTEGER CHECK (
            completed_at_epoch_ms IS NULL OR
            completed_at_epoch_ms >= started_at_epoch_ms
          ),
          source_planned_workout_id TEXT,
          source_weekday INTEGER CHECK (
            source_weekday IS NULL OR source_weekday BETWEEN 0 AND 6
          ),
          CHECK (
            (status = 'active' AND completed_at_epoch_ms IS NULL) OR
            (status = 'completed' AND completed_at_epoch_ms IS NOT NULL)
          ),
          CHECK (
            (source_planned_workout_id IS NULL AND source_weekday IS NULL) OR
            (source_planned_workout_id IS NOT NULL AND source_weekday IS NOT NULL)
          )
        )
      `);
      await transaction.exec(`
        CREATE UNIQUE INDEX workout_session_single_active
        ON workout_session(status) WHERE status = 'active'
      `);
      await transaction.exec(`
        CREATE INDEX workout_session_status_started
        ON workout_session(status, started_at_epoch_ms DESC, id)
      `);
      await transaction.exec(`
        CREATE TABLE workout_session_exercise (
          id TEXT PRIMARY KEY,
          workout_session_id TEXT NOT NULL REFERENCES workout_session(id)
            ON DELETE CASCADE,
          source_exercise_definition_id TEXT NOT NULL,
          source_planned_exercise_id TEXT,
          position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 99),
          exercise_name_snapshot TEXT NOT NULL CHECK (
            length(trim(exercise_name_snapshot)) BETWEEN 1 AND 80
          ),
          logging_mode_snapshot TEXT NOT NULL CHECK (logging_mode_snapshot IN (
            'repetitions', 'external-load-and-repetitions',
            'bodyweight-and-repetitions',
            'bodyweight-plus-load-and-repetitions',
            'assistance-and-repetitions', 'duration', 'distance',
            'distance-and-duration'
          )),
          planned_kind TEXT CHECK (planned_kind IS NULL OR planned_kind IN (
            'repetitions', 'resistance-and-repetitions', 'duration',
            'distance', 'distance-and-duration'
          )),
          planned_sets INTEGER CHECK (
            planned_sets IS NULL OR planned_sets BETWEEN 1 AND 100
          ),
          planned_repetitions INTEGER CHECK (
            planned_repetitions IS NULL OR planned_repetitions BETWEEN 1 AND 10000
          ),
          planned_resistance_grams REAL CHECK (
            planned_resistance_grams IS NULL OR
            planned_resistance_grams > 0 AND planned_resistance_grams <= 1000000
          ),
          planned_duration_seconds REAL CHECK (
            planned_duration_seconds IS NULL OR
            planned_duration_seconds > 0 AND planned_duration_seconds <= 604800
          ),
          planned_distance_millimeters REAL CHECK (
            planned_distance_millimeters IS NULL OR
            planned_distance_millimeters > 0 AND
            planned_distance_millimeters <= 1000000000
          ),
          UNIQUE(workout_session_id, position),
          CHECK (
            (planned_kind IS NULL AND planned_sets IS NULL
              AND planned_repetitions IS NULL
              AND planned_resistance_grams IS NULL
              AND planned_duration_seconds IS NULL
              AND planned_distance_millimeters IS NULL)
            OR
            (planned_kind = 'repetitions' AND planned_sets IS NOT NULL
              AND planned_repetitions IS NOT NULL
              AND planned_resistance_grams IS NULL
              AND planned_duration_seconds IS NULL
              AND planned_distance_millimeters IS NULL)
            OR
            (planned_kind = 'resistance-and-repetitions'
              AND planned_sets IS NOT NULL AND planned_repetitions IS NOT NULL
              AND planned_duration_seconds IS NULL
              AND planned_distance_millimeters IS NULL)
            OR
            (planned_kind = 'duration' AND planned_sets IS NOT NULL
              AND planned_repetitions IS NULL
              AND planned_resistance_grams IS NULL
              AND planned_duration_seconds IS NOT NULL
              AND planned_distance_millimeters IS NULL)
            OR
            (planned_kind = 'distance' AND planned_sets IS NOT NULL
              AND planned_repetitions IS NULL
              AND planned_resistance_grams IS NULL
              AND planned_duration_seconds IS NULL
              AND planned_distance_millimeters IS NOT NULL)
            OR
            (planned_kind = 'distance-and-duration'
              AND planned_sets IS NOT NULL AND planned_repetitions IS NULL
              AND planned_resistance_grams IS NULL
              AND planned_duration_seconds IS NOT NULL
              AND planned_distance_millimeters IS NOT NULL)
          )
        )
      `);
      await transaction.exec(`
        CREATE INDEX workout_session_exercise_order
        ON workout_session_exercise(workout_session_id, position)
      `);
      await transaction.exec(`
        CREATE TABLE workout_set (
          id TEXT PRIMARY KEY,
          workout_session_exercise_id TEXT NOT NULL
            REFERENCES workout_session_exercise(id) ON DELETE CASCADE,
          position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 99),
          result_kind TEXT NOT NULL CHECK (result_kind IN (
            'repetitions', 'resistance-and-repetitions', 'duration',
            'distance', 'distance-and-duration'
          )),
          repetitions INTEGER CHECK (
            repetitions IS NULL OR repetitions BETWEEN 1 AND 10000
          ),
          resistance_grams REAL CHECK (
            resistance_grams IS NULL OR
            resistance_grams > 0 AND resistance_grams <= 1000000
          ),
          duration_seconds REAL CHECK (
            duration_seconds IS NULL OR
            duration_seconds > 0 AND duration_seconds <= 604800
          ),
          distance_millimeters REAL CHECK (
            distance_millimeters IS NULL OR
            distance_millimeters > 0 AND distance_millimeters <= 1000000000
          ),
          UNIQUE(workout_session_exercise_id, position),
          CHECK (
            (result_kind = 'repetitions' AND repetitions IS NOT NULL
              AND resistance_grams IS NULL AND duration_seconds IS NULL
              AND distance_millimeters IS NULL)
            OR
            (result_kind = 'resistance-and-repetitions'
              AND repetitions IS NOT NULL AND resistance_grams IS NOT NULL
              AND duration_seconds IS NULL AND distance_millimeters IS NULL)
            OR
            (result_kind = 'duration' AND repetitions IS NULL
              AND resistance_grams IS NULL AND duration_seconds IS NOT NULL
              AND distance_millimeters IS NULL)
            OR
            (result_kind = 'distance' AND repetitions IS NULL
              AND resistance_grams IS NULL AND duration_seconds IS NULL
              AND distance_millimeters IS NOT NULL)
            OR
            (result_kind = 'distance-and-duration' AND repetitions IS NULL
              AND resistance_grams IS NULL AND duration_seconds IS NOT NULL
              AND distance_millimeters IS NOT NULL)
          )
        )
      `);
      await transaction.exec(`
        CREATE INDEX workout_set_order
        ON workout_set(workout_session_exercise_id, position)
      `);
    },
    version: 9,
  },
  {
    description: 'Add bounded workout history query indexes.',
    up: async (transaction) => {
      await transaction.exec(`
        CREATE INDEX workout_session_completed_local_date
        ON workout_session (
          status, started_local_calendar_date DESC,
          started_at_epoch_ms DESC, id DESC
        )
      `);
      await transaction.exec(`
        CREATE INDEX workout_session_exercise_source_history
        ON workout_session_exercise (
          source_exercise_definition_id, workout_session_id
        )
      `);
    },
    version: 10,
  },
  {
    description: 'Add historical body weight check-ins.',
    up: async (transaction) => {
      await transaction.exec(`
        CREATE TABLE body_weight_entry (
          id TEXT PRIMARY KEY,
          mass_grams REAL NOT NULL CHECK (
            mass_grams >= 2000 AND mass_grams <= 500000
          ),
          note TEXT CHECK (
            note IS NULL OR length(trim(note)) BETWEEN 1 AND 200
          ),
          occurred_at_epoch_ms INTEGER NOT NULL CHECK (
            occurred_at_epoch_ms >= 0
          ),
          local_calendar_date TEXT NOT NULL CHECK (
            local_calendar_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
          ),
          utc_offset_minutes INTEGER NOT NULL CHECK (
            utc_offset_minutes BETWEEN -840 AND 840
          )
        )
      `);
      await transaction.exec(`
        CREATE INDEX body_weight_entry_local_date_occurred_at
        ON body_weight_entry (
          local_calendar_date DESC,
          occurred_at_epoch_ms DESC,
          id DESC
        )
      `);
    },
    version: 11,
  },
];
