import {
  DomainId,
  WorkoutSession,
  WorkoutSessionExercise,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type {
  CompletedWorkoutLifecycle,
  WorkoutSessionRepository,
} from '../../workout-session/application/workout-session-repository';
import { completedWorkoutLifecycle } from './delete-completed-workout-use-case';

export type CompletedExerciseRemovalContext = Readonly<{
  sessions: WorkoutSessionRepository;
}>;

/**
 * Why a removal was refused. Every reason maps to one fixed sentence in
 * presentation, so no message can carry a name, a value, a date, or an
 * identifier.
 */
export type CompletedExerciseRemovalRefusal =
  | 'changed'
  | 'exercise-not-found'
  | 'not-completed'
  | 'not-found'
  | 'would-empty-workout';

export type CompletedExerciseRemovalOutcome =
  | Readonly<{ session: WorkoutSession; status: 'removed' }>
  | Readonly<{ reason: CompletedExerciseRemovalRefusal; status: 'refused' }>;

export type RemoveCompletedExerciseInput = Readonly<{
  exerciseId: unknown;
  expected: CompletedWorkoutLifecycle;
  sessionId: unknown;
}>;

/**
 * The only way a completed session exercise may be removed.
 *
 * Workout History owns this workflow because the removal starts from completed
 * history and every read model it disturbs belongs here, while Workout Session
 * keeps ownership of writes to its own aggregate. The removal is expressed as a
 * rebuilt aggregate spread from the loaded one, so no lifecycle field and no
 * surviving snapshot has a path to change, and the stored lifecycle instants are
 * compared inside the transaction so a stale screen refuses rather than removing
 * an exercise from whatever aggregate now holds that identifier.
 */
export class RemoveCompletedWorkoutExerciseUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<CompletedExerciseRemovalContext>,
  ) {}

  execute(
    input: RemoveCompletedExerciseInput,
  ): Promise<CompletedExerciseRemovalOutcome> {
    const session = DomainId.create(input.sessionId);
    if (!session.isSuccess) return Promise.resolve(refused('not-found'));
    const exercise = DomainId.create(input.exerciseId);
    if (!exercise.isSuccess)
      return Promise.resolve(refused('exercise-not-found'));
    return this.transactionRunner.run(async ({ sessions }) => {
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
      const survivors = stored.exercises.filter(
        (candidate) => !candidate.id.equals(exercise.value),
      );
      if (survivors.length === stored.exercises.length)
        return refused('exercise-not-found');
      // Checked before anything is written, because a completed workout keeps at
      // least one recorded set and the aggregate would otherwise reject the
      // rebuild as an error rather than as an answerable refusal.
      if (performedSetCount(survivors) === 0)
        return refused('would-empty-workout');
      const rebuilt = WorkoutSession.create({
        ...stored,
        exercises: renumber(survivors),
      });
      if (!rebuilt.isSuccess)
        throw new Error('A completed workout could not drop one exercise.');
      await sessions.correctCompleted(rebuilt.value);
      return Object.freeze({
        session: rebuilt.value,
        status: 'removed' as const,
      });
    });
  }
}

/**
 * Survivors keep their identifiers and every captured snapshot, and take
 * contiguous positions, because the aggregate refuses a gap and stored history
 * must never depend on row order.
 */
function renumber(
  exercises: readonly WorkoutSessionExercise[],
): readonly WorkoutSessionExercise[] {
  return exercises.map((exercise, position) => {
    const rebuilt = WorkoutSessionExercise.create({ ...exercise, position });
    if (!rebuilt.isSuccess)
      throw new Error('A surviving exercise could not be renumbered.');
    return rebuilt.value;
  });
}

function performedSetCount(
  exercises: readonly WorkoutSessionExercise[],
): number {
  return exercises.reduce((count, exercise) => count + exercise.sets.length, 0);
}

function refused(
  reason: CompletedExerciseRemovalRefusal,
): Readonly<{ reason: CompletedExerciseRemovalRefusal; status: 'refused' }> {
  return Object.freeze({ reason, status: 'refused' as const });
}
