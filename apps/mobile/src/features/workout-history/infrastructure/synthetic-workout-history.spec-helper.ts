import {
  createWorkoutResult,
  DomainId,
  Duration,
  Length,
  Mass,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  type ExerciseLoggingMode,
  type PlannedPrescription,
  type Result,
  type WorkoutResult,
  type WorkoutSessionStatus,
} from '@fitness/domain';
import { initializeDatabase } from '../../../infrastructure/persistence/database-initializer';
import { migrations } from '../../../infrastructure/persistence/migrations';
import { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { WorkoutSessionSqliteRepository } from '../../workout-session/infrastructure/workout-session-sqlite-repository';

/**
 * Synthetic completed history on a real SQLite engine, built through the domain
 * and written through the repository the application itself writes sessions
 * with. Nothing here touches the Exercise Catalog, because history is the only
 * authority a derived history claim may use.
 */

export const syntheticExerciseIds = Object.freeze({
  pushUp: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
});

export type SyntheticSet = Readonly<{
  distanceMillimeters?: number;
  durationSeconds?: number;
  repetitions?: number;
  repsInReserve?: number;
  resistanceGrams?: number;
}>;

export type SyntheticExercise = Readonly<{
  definitionId?: string;
  loggingMode: ExerciseLoggingMode;
  name?: string;
  planned?: PlannedPrescription;
  sets: readonly SyntheticSet[];
}>;

export type SyntheticSession = Readonly<{
  dayIndex: number;
  exercises: readonly SyntheticExercise[];
  name?: string;
  /** Hour the session starts, so a session can be made to finish after midnight. */
  startHour?: number;
  status?: WorkoutSessionStatus;
}>;

export class SyntheticWorkoutHistory {
  private identifierCount = 0;

  private constructor(readonly database: NodeSqliteDatabase) {}

  static async create(): Promise<SyntheticWorkoutHistory> {
    const database = new NodeSqliteDatabase();
    await initializeDatabase(database, migrations);
    return new SyntheticWorkoutHistory(database);
  }

  async store(...sessions: readonly SyntheticSession[]): Promise<void> {
    const repository = new WorkoutSessionSqliteRepository(
      this.database,
      'synthetic-device',
      () => new Date(),
    );
    for (const session of sessions) {
      await repository.insert(this.buildSession(session));
    }
  }

  close(): void {
    this.database.close();
  }

  private buildSession(input: SyntheticSession): WorkoutSession {
    const startedAt = Date.UTC(
      2026,
      0,
      1 + input.dayIndex,
      input.startHour ?? 9,
    );
    const status = input.status ?? 'completed';
    return unwrap(
      WorkoutSession.create({
        completedAtEpochMilliseconds:
          status === 'completed' ? startedAt + 3_600_000 : null,
        exercises: input.exercises.map((exercise, position) =>
          this.buildExercise(exercise, position),
        ),
        id: this.nextId(),
        name: input.name ?? `Workout ${input.dayIndex}`,
        sourcePlannedWorkoutId: null,
        sourceWeekday: null,
        startedAtEpochMilliseconds: startedAt,
        startedLocalCalendarDate: localDate(startedAt),
        startedUtcOffsetMinutes: 0,
        status,
      }),
    );
  }

  private buildExercise(
    input: SyntheticExercise,
    position: number,
  ): WorkoutSessionExercise {
    return unwrap(
      WorkoutSessionExercise.create({
        exerciseNameSnapshot: input.name ?? 'Push-up',
        id: this.nextId(),
        loggingModeSnapshot: input.loggingMode,
        plannedPrescriptionSnapshot: input.planned ?? null,
        position,
        sets: input.sets.map((set, setPosition) =>
          unwrap(
            WorkoutSet.create({
              id: this.nextId(),
              position: setPosition,
              repsInReserve: set.repsInReserve ?? null,
              result: buildResult(input.loggingMode, set),
            }),
          ),
        ),
        sourceExerciseDefinitionId: unwrap(
          DomainId.create(input.definitionId ?? syntheticExerciseIds.pushUp),
        ),
        sourcePlannedExerciseId: null,
      }),
    );
  }

  private nextId(): DomainId {
    this.identifierCount += 1;
    return unwrap(
      DomainId.create(
        `00000000-0000-4000-8000-${String(this.identifierCount).padStart(12, '0')}`,
      ),
    );
  }
}

function buildResult(
  loggingMode: ExerciseLoggingMode,
  set: SyntheticSet,
): WorkoutResult {
  return unwrap(
    createWorkoutResult({
      distance:
        set.distanceMillimeters === undefined
          ? undefined
          : unwrap(Length.create(set.distanceMillimeters, 'millimeter')),
      duration:
        set.durationSeconds === undefined
          ? undefined
          : unwrap(Duration.create(set.durationSeconds, 'second')),
      loggingMode,
      repetitions: set.repetitions,
      resistance:
        set.resistanceGrams === undefined
          ? undefined
          : unwrap(Mass.create(set.resistanceGrams, 'gram')),
    }),
  );
}

function localDate(epochMilliseconds: number): string {
  const value = new Date(epochMilliseconds);
  const year = String(value.getUTCFullYear()).padStart(4, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess)
    throw new Error('Synthetic workout history is invalid.');
  return result.value;
}
