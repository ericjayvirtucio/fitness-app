import { DomainId, type WorkoutSession } from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type {
  CompletedWorkoutLifecycle,
  WorkoutSessionRepository,
} from '../../workout-session/application/workout-session-repository';

export type CompletedWorkoutDeletionContext = Readonly<{
  sessions: WorkoutSessionRepository;
}>;

/**
 * Why a deletion was refused. Every reason maps to one fixed sentence in
 * presentation, so no message can carry a name, a value, a date, or an
 * identifier.
 */
export type CompletedWorkoutDeletionRefusal =
  'changed' | 'not-completed' | 'not-found';

export type CompletedWorkoutDeletionOutcome =
  | Readonly<{ status: 'deleted' }>
  | Readonly<{ reason: CompletedWorkoutDeletionRefusal; status: 'refused' }>;

export type DeleteCompletedWorkoutInput = Readonly<{
  expected: CompletedWorkoutLifecycle;
  sessionId: unknown;
}>;

export function completedWorkoutLifecycle(
  session: WorkoutSession,
): CompletedWorkoutLifecycle | null {
  return session.completedAtEpochMilliseconds === null
    ? null
    : Object.freeze({
        completedAtEpochMilliseconds: session.completedAtEpochMilliseconds,
        startedAtEpochMilliseconds: session.startedAtEpochMilliseconds,
      });
}

/**
 * The only way a completed workout may be removed.
 *
 * Workout History owns this workflow because the deletion starts from completed
 * history and every read model it disturbs belongs here, while Workout Session
 * keeps ownership of writes to its own aggregate through `deleteCompleted`. The
 * stored workout is reloaded inside the transaction and checked against the
 * lifecycle facts the screen loaded, so a stale screen refuses rather than
 * deleting whatever aggregate now holds that identifier.
 */
export class DeleteCompletedWorkoutUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<CompletedWorkoutDeletionContext>,
  ) {}

  execute(
    input: DeleteCompletedWorkoutInput,
  ): Promise<CompletedWorkoutDeletionOutcome> {
    const id = DomainId.create(input.sessionId);
    if (!id.isSuccess) return Promise.resolve(refused('not-found'));
    return this.transactionRunner.run(async ({ sessions }) => {
      const stored = await sessions.getById(id.value);
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
      await sessions.deleteCompleted(id.value, lifecycle);
      return Object.freeze({ status: 'deleted' as const });
    });
  }
}

function refused(
  reason: CompletedWorkoutDeletionRefusal,
): Readonly<{ reason: CompletedWorkoutDeletionRefusal; status: 'refused' }> {
  return Object.freeze({ reason, status: 'refused' as const });
}
