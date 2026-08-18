import {
  DomainError,
  DomainId,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  Weekday,
  type WorkoutResult,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import type { ExerciseCatalogRepository } from '../../exercise-catalog/application/exercise-catalog-repository';
import type { WorkoutPlannerRepository } from '../../workout-planner/application/workout-planner-repository';
import type {
  WorkoutSessionRepository,
  WorkoutSessionTransactionContext,
} from './workout-session-repository';

export type WorkoutSessionContext = Readonly<{
  catalog: ExerciseCatalogRepository;
  planner: WorkoutPlannerRepository;
  sessions: WorkoutSessionRepository;
}>;

export type StartSessionOutcome =
  | Readonly<{ session: WorkoutSession; status: 'active-exists' }>
  | Readonly<{ error: DomainError; status: 'invalid' }>
  | Readonly<{ session: WorkoutSession; status: 'started' }>;

export class StartWorkoutSessionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<WorkoutSessionContext>,
    private readonly generateId: () => string,
    private readonly getCurrentTime: () => number,
  ) {}

  executeEmpty(): Promise<StartSessionOutcome> {
    return this.transactionRunner.run(async ({ sessions }) => {
      const active = await sessions.getActive();
      if (active) return { session: active, status: 'active-exists' };
      const session = createSession(
        this.generateId,
        this.getCurrentTime(),
        'Workout',
        null,
      );
      if (!session.isSuccess)
        return { error: session.error, status: 'invalid' };
      await sessions.insert(session.value);
      return { session: session.value, status: 'started' };
    });
  }

  executePlanned(weekdayValue: unknown): Promise<StartSessionOutcome> {
    const weekday = Weekday.create(weekdayValue);
    if (!weekday.isSuccess)
      return Promise.resolve({ error: weekday.error, status: 'invalid' });
    return this.transactionRunner.run(async ({ planner, sessions }) => {
      const active = await sessions.getActive();
      if (active) return { session: active, status: 'active-exists' };
      const details = await planner.getByWeekday(weekday.value);
      if (!details)
        return {
          error: DomainError.create(
            'unsupported-option',
            'The planned workout is no longer available.',
            'weekday',
          ),
          status: 'invalid' as const,
        };
      const exercises: WorkoutSessionExercise[] = [];
      for (const [position, detail] of details.exercises.entries()) {
        const exercise = WorkoutSessionExercise.create({
          exerciseNameSnapshot: detail.definition.name,
          id: requiredId(this.generateId()),
          loggingModeSnapshot: detail.definition.loggingMode,
          plannedPrescriptionSnapshot: detail.plannedExercise.prescription,
          position,
          sets: [],
          sourceExerciseDefinitionId: detail.definition.id,
          sourcePlannedExerciseId: detail.plannedExercise.id,
        });
        if (!exercise.isSuccess)
          return { error: exercise.error, status: 'invalid' as const };
        exercises.push(exercise.value);
      }
      const session = createSession(
        this.generateId,
        this.getCurrentTime(),
        details.workout.name,
        {
          exercises,
          plannedWorkoutId: details.workout.id,
          weekday: details.workout.weekday,
        },
      );
      if (!session.isSuccess)
        return { error: session.error, status: 'invalid' };
      await sessions.insert(session.value);
      return { session: session.value, status: 'started' };
    });
  }
}

export class GetActiveWorkoutSessionUseCase {
  constructor(private readonly repository: WorkoutSessionRepository) {}
  execute() {
    return this.repository.getActive();
  }
}

/**
 * Loads one workout of either status.
 *
 * Naming is the only workflow that reaches an active workout and a completed
 * one through the same screen, so it is the only caller that cannot ask for a
 * status it already knows. Nothing derived is read: it is the repository's own
 * `getById`, refusing an identifier that is not one before it looks.
 */
export class GetWorkoutSessionUseCase {
  constructor(private readonly repository: WorkoutSessionRepository) {}
  execute(sessionId: unknown): Promise<WorkoutSession | null> {
    const id = DomainId.create(sessionId);
    if (!id.isSuccess) return Promise.resolve(null);
    return this.repository.getById(id.value);
  }
}

export class WorkoutSessionMutationUseCases {
  constructor(
    private readonly transactionRunner: TransactionRunner<WorkoutSessionContext>,
    private readonly generateId: () => string,
  ) {}

  addExercise(sessionId: unknown, definitionId: unknown) {
    return this.mutate(sessionId, async (session, context) => {
      const id = DomainId.create(definitionId);
      if (!id.isSuccess) return id;
      const item = await context.catalog.getById(id.value);
      if (!item)
        return invalid(
          'exerciseDefinitionId',
          'Exercise is no longer available.',
        );
      const exercise = WorkoutSessionExercise.create({
        exerciseNameSnapshot: item.definition.name,
        id: requiredId(this.generateId()),
        loggingModeSnapshot: item.definition.loggingMode,
        plannedPrescriptionSnapshot: null,
        position: session.exercises.length,
        sets: [],
        sourceExerciseDefinitionId: item.definition.id,
        sourcePlannedExerciseId: null,
      });
      if (!exercise.isSuccess) return exercise;
      return rebuild(session, [...session.exercises, exercise.value]);
    });
  }

  removeExercise(sessionId: unknown, exerciseId: unknown) {
    return this.mutate(sessionId, (session) => {
      const id = DomainId.create(exerciseId);
      if (!id.isSuccess) return Promise.resolve(id);
      const remaining = session.exercises.filter(
        (exercise) => !exercise.id.equals(id.value),
      );
      if (remaining.length === session.exercises.length)
        return Promise.resolve(
          invalid('exerciseId', 'Exercise is no longer available.'),
        );
      return Promise.resolve(rebuild(session, reindexExercises(remaining)));
    });
  }

  addSet(sessionId: unknown, exerciseId: unknown, result: WorkoutResult) {
    return this.mutateExercise(sessionId, exerciseId, (exercise) => {
      const set = WorkoutSet.create({
        id: requiredId(this.generateId()),
        position: exercise.sets.length,
        result,
      });
      return set.isSuccess
        ? rebuildExercise(exercise, [...exercise.sets, set.value])
        : set;
    });
  }

  updateSet(
    sessionId: unknown,
    exerciseId: unknown,
    setId: unknown,
    result: WorkoutResult,
  ) {
    return this.mutateExercise(sessionId, exerciseId, (exercise) => {
      const id = DomainId.create(setId);
      if (!id.isSuccess) return id;
      let found = false;
      const sets = exercise.sets.map((set) => {
        if (!set.id.equals(id.value)) return set;
        found = true;
        const updated = WorkoutSet.create({
          id: set.id,
          position: set.position,
          result,
        });
        return updated.isSuccess ? updated.value : set;
      });
      return found
        ? rebuildExercise(exercise, sets)
        : invalid('setId', 'Set is no longer available.');
    });
  }

  deleteSet(sessionId: unknown, exerciseId: unknown, setId: unknown) {
    return this.mutateExercise(sessionId, exerciseId, (exercise) => {
      const id = DomainId.create(setId);
      if (!id.isSuccess) return id;
      const remaining = exercise.sets.filter((set) => !set.id.equals(id.value));
      if (remaining.length === exercise.sets.length)
        return invalid('setId', 'Set is no longer available.');
      const sets = remaining.map((set, position) => {
        const rebuilt = WorkoutSet.create({
          id: set.id,
          position,
          result: set.result,
        });
        if (!rebuilt.isSuccess)
          throw new Error('Valid set could not be reordered.');
        return rebuilt.value;
      });
      return rebuildExercise(exercise, sets);
    });
  }

  private mutateExercise(
    sessionId: unknown,
    exerciseId: unknown,
    mutation: (
      exercise: WorkoutSessionExercise,
    ) => ReturnType<typeof rebuildExercise>,
  ) {
    return this.mutate(sessionId, (session) => {
      const result = (() => {
        const id = DomainId.create(exerciseId);
        if (!id.isSuccess) return id;
        const index = session.exercises.findIndex((exercise) =>
          exercise.id.equals(id.value),
        );
        if (index < 0)
          return invalid('exerciseId', 'Exercise is no longer available.');
        const exercise = session.exercises[index];
        if (!exercise)
          return invalid('exerciseId', 'Exercise is no longer available.');
        const updated = mutation(exercise);
        if (!updated.isSuccess) return updated;
        const exercises = [...session.exercises];
        exercises[index] = updated.value;
        return rebuild(session, exercises);
      })();
      return Promise.resolve(result);
    });
  }

  private mutate(
    sessionId: unknown,
    mutation: (
      session: WorkoutSession,
      context: WorkoutSessionContext,
    ) => Promise<ReturnType<typeof rebuild>>,
  ) {
    const id = DomainId.create(sessionId);
    if (!id.isSuccess) return Promise.resolve(id);
    return this.transactionRunner.run(async (context) => {
      const session = await context.sessions.getById(id.value);
      if (!session || session.status !== 'active')
        return invalid('sessionId', 'Active workout is no longer available.');
      const updated = await mutation(session, context);
      if (!updated.isSuccess) return updated;
      await context.sessions.replace(updated.value);
      return updated;
    });
  }
}

export class FinishWorkoutSessionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<WorkoutSessionContext>,
    private readonly getCurrentTime: () => number,
  ) {}
  execute(sessionId: unknown) {
    const id = DomainId.create(sessionId);
    if (!id.isSuccess) return Promise.resolve(id);
    return this.transactionRunner.run(async ({ sessions }) => {
      const session = await sessions.getById(id.value);
      if (!session || session.status !== 'active')
        return invalid('sessionId', 'Active workout is no longer available.');
      const completed = WorkoutSession.create({
        ...session,
        completedAtEpochMilliseconds: this.getCurrentTime(),
        status: 'completed',
      });
      if (!completed.isSuccess) return completed;
      const persisted = await sessions.complete(completed.value);
      return { isSuccess: true as const, value: persisted };
    });
  }
}

/**
 * Abandons the active workout, or leaves it exactly as it was.
 *
 * The repository issues a lifecycle check and three deletes. Outside a
 * transaction a failure between them left a workout that still recovered but
 * had silently lost its recorded sets, and no read path could tell that from a
 * workout nothing had been recorded in. One exclusive transaction removes that
 * state: the aggregate is gone, or every set is still there.
 *
 * An invalid identifier is refused before the transaction opens, so a mistyped
 * value never takes an exclusive lock.
 */
export class DiscardWorkoutSessionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<WorkoutSessionTransactionContext>,
  ) {}
  execute(sessionId: unknown): Promise<boolean> {
    const id = DomainId.create(sessionId);
    if (!id.isSuccess) return Promise.resolve(false);
    return this.transactionRunner.run(({ sessions }) =>
      sessions.discard(id.value),
    );
  }
}

function createSession(
  generateId: () => string,
  now: number,
  name: string,
  source: Readonly<{
    exercises: readonly WorkoutSessionExercise[];
    plannedWorkoutId: DomainId;
    weekday: Weekday;
  }> | null,
) {
  const date = new Date(now);
  return WorkoutSession.create({
    completedAtEpochMilliseconds: null,
    exercises: source?.exercises ?? [],
    id: requiredId(generateId()),
    name,
    sourcePlannedWorkoutId: source?.plannedWorkoutId ?? null,
    sourceWeekday: source?.weekday ?? null,
    startedAtEpochMilliseconds: now,
    startedLocalCalendarDate: formatLocalCalendarDate(date),
    startedUtcOffsetMinutes: -date.getTimezoneOffset(),
    status: 'active',
  });
}

function rebuild(
  session: WorkoutSession,
  exercises: readonly WorkoutSessionExercise[],
) {
  return WorkoutSession.create({ ...session, exercises });
}

function rebuildExercise(
  exercise: WorkoutSessionExercise,
  sets: readonly WorkoutSet[],
) {
  return WorkoutSessionExercise.create({ ...exercise, sets });
}

function reindexExercises(exercises: readonly WorkoutSessionExercise[]) {
  return exercises.map((exercise, position) => {
    const result = WorkoutSessionExercise.create({ ...exercise, position });
    if (!result.isSuccess)
      throw new Error('Valid exercise could not be reordered.');
    return result.value;
  });
}

function requiredId(value: string): DomainId {
  const id = DomainId.create(value);
  if (!id.isSuccess)
    throw new Error('Identifier generator returned an invalid UUID.');
  return id.value;
}

function invalid(field: string, message: string) {
  return {
    error: DomainError.create('unsupported-option', message, field),
    isSuccess: false as const,
  };
}
