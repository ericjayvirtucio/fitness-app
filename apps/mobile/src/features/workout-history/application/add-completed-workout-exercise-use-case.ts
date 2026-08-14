import {
  DomainId,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  workoutSessionPolicy,
  type WorkoutResult,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type { ExerciseCatalogRepository } from '../../exercise-catalog/application/exercise-catalog-repository';
import type {
  CompletedWorkoutLifecycle,
  WorkoutSessionRepository,
} from '../../workout-session/application/workout-session-repository';
import { completedWorkoutLifecycle } from './delete-completed-workout-use-case';

export type CompletedExerciseAdditionContext = Readonly<{
  catalog: ExerciseCatalogRepository;
  sessions: WorkoutSessionRepository;
}>;

/**
 * Why an addition was refused. Every reason maps to one fixed sentence in
 * presentation, so no message can carry a name, a value, a date, or an
 * identifier.
 */
export type CompletedExerciseAdditionRefusal =
  | 'changed'
  | 'definition-not-found'
  | 'invalid-result'
  | 'not-completed'
  | 'not-found'
  | 'workout-full';

export type CompletedExerciseAdditionOutcome =
  | Readonly<{ session: WorkoutSession; status: 'added' }>
  | Readonly<{ reason: CompletedExerciseAdditionRefusal; status: 'refused' }>;

export type AddCompletedExerciseInput = Readonly<{
  definitionId: unknown;
  expected: CompletedWorkoutLifecycle;
  result: WorkoutResult;
  sessionId: unknown;
}>;

/**
 * The only way a session exercise may be added to a completed workout.
 *
 * Workout History owns this workflow because the addition starts from completed
 * history and every read model it disturbs belongs here, while Workout Session
 * keeps ownership of writes to its own aggregate. The exercise is appended, so
 * no existing identifier, position, or captured snapshot is rewritten, and the
 * stored lifecycle instants are compared inside the transaction so a stale
 * screen refuses rather than appending to whatever aggregate now holds that
 * identifier.
 *
 * The Exercise Catalog is read for one purpose only: to capture a new snapshot
 * for an exercise entering the session at the moment the person says it entered.
 * No existing snapshot is re-read, so history still never asks current catalog
 * state to interpret work it already recorded.
 */
export class AddCompletedWorkoutExerciseUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<CompletedExerciseAdditionContext>,
    private readonly generateId: () => string,
  ) {}

  execute(
    input: AddCompletedExerciseInput,
  ): Promise<CompletedExerciseAdditionOutcome> {
    const session = DomainId.create(input.sessionId);
    if (!session.isSuccess) return Promise.resolve(refused('not-found'));
    const definition = DomainId.create(input.definitionId);
    if (!definition.isSuccess)
      return Promise.resolve(refused('definition-not-found'));
    return this.transactionRunner.run(async ({ catalog, sessions }) => {
      const stored = await sessions.getById(session.value);
      if (stored === null) return refused('not-found');
      if (stored.status !== 'completed') return refused('not-completed');
      const lifecycle = completedWorkoutLifecycle(stored);
      if (
        lifecycle === null ||
        lifecycle.startedAtEpochMilliseconds !==
          input.expected.startedAtEpochMilliseconds ||
        lifecycle.completedAtEpochMilliseconds !==
          input.expected.completedAtEpochMilliseconds
      )
        return refused('changed');
      // Checked before the catalog is read, because a workout already holding
      // the maximum cannot accept any definition and the aggregate would
      // otherwise reject the rebuild as an error rather than as an answerable
      // refusal.
      if (stored.exercises.length >= workoutSessionPolicy.maximumExercises)
        return refused('workout-full');
      const item = await catalog.getById(definition.value);
      if (item === null) return refused('definition-not-found');
      const recorded = WorkoutSet.create({
        id: requiredId(this.generateId()),
        position: 0,
        result: input.result,
      });
      if (!recorded.isSuccess) return refused('invalid-result');
      // A completed workout never gains an exercise that recorded nothing, so
      // the first set is built into the exercise rather than added afterwards.
      const added = WorkoutSessionExercise.create({
        exerciseNameSnapshot: item.definition.name,
        id: requiredId(this.generateId()),
        loggingModeSnapshot: item.definition.loggingMode,
        plannedPrescriptionSnapshot: null,
        position: stored.exercises.length,
        sets: [recorded.value],
        sourceExerciseDefinitionId: item.definition.id,
        sourcePlannedExerciseId: null,
      });
      if (!added.isSuccess) return refused('invalid-result');
      const rebuilt = WorkoutSession.create({
        ...stored,
        exercises: [...stored.exercises, added.value],
      });
      if (!rebuilt.isSuccess) return refused('invalid-result');
      await sessions.correctCompleted(rebuilt.value);
      return Object.freeze({
        session: rebuilt.value,
        status: 'added' as const,
      });
    });
  }
}

function requiredId(value: string): DomainId {
  const id = DomainId.create(value);
  if (!id.isSuccess)
    throw new Error('Identifier generator returned an invalid UUID.');
  return id.value;
}

function refused(
  reason: CompletedExerciseAdditionRefusal,
): Readonly<{ reason: CompletedExerciseAdditionRefusal; status: 'refused' }> {
  return Object.freeze({ reason, status: 'refused' as const });
}
