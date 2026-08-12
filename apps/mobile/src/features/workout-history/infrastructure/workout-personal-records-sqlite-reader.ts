import { DomainId, type ExerciseLoggingMode } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseValue,
} from '../../../infrastructure/persistence/database';
import {
  PersistenceError,
  toPersistenceError,
} from '../../../infrastructure/persistence/persistence-error';
import {
  isPersonalRecordLoggingModeSupported,
  personalRecordCategories,
  personalRecordDescriptors,
  type ExercisePersonalRecord,
  type ExercisePersonalRecords,
  type PersonalRecordCategory,
  type PersonalRecordDescriptor,
  type PersonalRecordDimension,
} from '../application/exercise-personal-records';
import type { WorkoutPersonalRecordsReader } from '../application/workout-personal-records-reader';

type RecordRow = Readonly<{
  canonical_value: number;
  category: string;
  exercise_name_snapshot: string;
  logging_mode_snapshot: ExerciseLoggingMode;
  session_id: string;
  session_name_snapshot: string;
  set_position: number;
  started_local_calendar_date: string;
}>;

type LoggingModeRow = Readonly<{
  exercise_name_snapshot: string;
  logging_mode_snapshot: ExerciseLoggingMode;
}>;

const comparedColumns: Readonly<Record<PersonalRecordDimension, string>> =
  Object.freeze({
    distance: 'actual.distance_millimeters',
    duration: 'actual.duration_seconds',
    repetitions: 'actual.repetitions',
    resistance: 'actual.resistance_grams',
  });

/**
 * One row per record category, selected by the same total order in every
 * branch: the compared value descending, then the earliest completed
 * occurrence. Equal values therefore report when the record was first achieved,
 * and the identifier tie-break only guarantees a stable answer — it never
 * changes the claim.
 *
 * Each branch is an independent `ORDER BY ... LIMIT 1` subquery so the compound
 * statement returns one candidate per category in a single round trip. Branch
 * count is fixed by the descriptor table, never by how much history exists, and
 * a mode the exercise never used simply contributes no row.
 */
export class WorkoutPersonalRecordsSqliteReader implements WorkoutPersonalRecordsReader {
  constructor(private readonly database: DatabaseConnection) {}

  async readExercisePersonalRecords(
    exerciseDefinitionId: DomainId,
  ): Promise<ExercisePersonalRecords> {
    try {
      const [recordRows, loggingModeRows] = await Promise.all([
        this.database.getAll<RecordRow>(
          recordStatement(),
          recordParameters(exerciseDefinitionId),
        ),
        this.database.getAll<LoggingModeRow>(loggingModeStatement(), [
          exerciseDefinitionId.value,
        ]),
      ]);
      const latest = loggingModeRows.at(0);
      return Object.freeze({
        latestExerciseNameSnapshot:
          latest === undefined
            ? null
            : requiredName(latest.exercise_name_snapshot),
        records: orderedRecords(recordRows),
        unsupportedLoggingModes: Object.freeze(
          loggingModeRows
            .map((row) => row.logging_mode_snapshot)
            .filter((mode) => !isPersonalRecordLoggingModeSupported(mode)),
        ),
      });
    } catch (error: unknown) {
      throw toPersistenceError(error, 'operation-failed');
    }
  }
}

function recordStatement(): string {
  return personalRecordDescriptors.map(recordBranch).join('\nUNION ALL\n');
}

function recordBranch(descriptor: PersonalRecordDescriptor): string {
  const comparedColumn = comparedColumns[descriptor.dimension];
  const modePlaceholders = descriptor.eligibleLoggingModes
    .map(() => '?')
    .join(', ');
  return `SELECT * FROM (
    SELECT ? AS category,
      ${comparedColumn} AS canonical_value,
      exercise.exercise_name_snapshot,
      exercise.logging_mode_snapshot,
      actual.position AS set_position,
      session.id AS session_id,
      session.display_name AS session_name_snapshot,
      session.started_local_calendar_date
    FROM workout_session_exercise exercise
    JOIN workout_session session ON session.id = exercise.workout_session_id
    JOIN workout_set actual
      ON actual.workout_session_exercise_id = exercise.id
    WHERE exercise.source_exercise_definition_id = ?
      AND session.status = 'completed'
      AND exercise.logging_mode_snapshot IN (${modePlaceholders})
      AND ${comparedColumn} IS NOT NULL
    ORDER BY ${comparedColumn} DESC,
      session.started_local_calendar_date ASC,
      session.started_at_epoch_ms ASC,
      exercise.position ASC,
      actual.position ASC,
      actual.id ASC
    LIMIT 1
  )`;
}

function recordParameters(exerciseDefinitionId: DomainId): DatabaseValue[] {
  return personalRecordDescriptors.flatMap((descriptor) => [
    descriptor.category,
    exerciseDefinitionId.value,
    ...descriptor.eligibleLoggingModes,
  ]);
}

/**
 * The logging modes this exercise was actually recorded under, newest first, so
 * the latest captured name leads and unsupported modes can be explained rather
 * than silently omitted.
 */
function loggingModeStatement(): string {
  return `SELECT logging_mode_snapshot, exercise_name_snapshot FROM (
    SELECT exercise.logging_mode_snapshot,
      exercise.exercise_name_snapshot,
      ROW_NUMBER() OVER (
        PARTITION BY exercise.logging_mode_snapshot
        ORDER BY session.started_at_epoch_ms DESC, exercise.id DESC
      ) AS mode_rank,
      MAX(session.started_at_epoch_ms) OVER (
        PARTITION BY exercise.logging_mode_snapshot
      ) AS latest_started_at_epoch_ms
    FROM workout_session_exercise exercise
    JOIN workout_session session ON session.id = exercise.workout_session_id
    WHERE exercise.source_exercise_definition_id = ?
      AND session.status = 'completed'
      AND EXISTS (
        SELECT 1 FROM workout_set actual
        WHERE actual.workout_session_exercise_id = exercise.id
      )
  )
  WHERE mode_rank = 1
  ORDER BY latest_started_at_epoch_ms DESC, logging_mode_snapshot ASC`;
}

/**
 * Presentation renders categories in a stable, product-defined order rather
 * than whichever branch the engine returned first.
 */
function orderedRecords(
  rows: readonly RecordRow[],
): readonly ExercisePersonalRecord[] {
  const byCategory = new Map(rows.map((row) => [row.category, row]));
  return Object.freeze(
    personalRecordCategories.flatMap((category) => {
      const row = byCategory.get(category);
      return row === undefined ? [] : [mapRecordRow(category, row)];
    }),
  );
}

function mapRecordRow(
  category: PersonalRecordCategory,
  row: RecordRow,
): ExercisePersonalRecord {
  return Object.freeze({
    canonicalValue: positiveValue(row.canonical_value),
    category,
    loggingMode: row.logging_mode_snapshot,
    occurrence: Object.freeze({
      exerciseNameSnapshot: requiredName(row.exercise_name_snapshot),
      sessionId: requiredId(row.session_id),
      sessionNameSnapshot: requiredName(row.session_name_snapshot),
      setPosition: nonnegativeInteger(row.set_position),
      startedLocalCalendarDate: requiredDate(row.started_local_calendar_date),
    }),
  });
}

function requiredId(value: string): DomainId {
  const result = DomainId.create(value);
  return result.isSuccess ? result.value : corrupt();
}

function requiredName(value: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : corrupt();
}

function requiredDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return corrupt();
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  )
    return corrupt();
  return value;
}

function nonnegativeInteger(value: number): number {
  return Number.isInteger(value) && value >= 0 ? value : corrupt();
}

/**
 * Every recorded quantity is strictly positive in the domain and in the
 * schema, so a zero or negative stored value is corruption rather than a
 * record worth claiming.
 */
function positiveValue(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : corrupt();
}

function corrupt(): never {
  throw new PersistenceError('operation-failed');
}
