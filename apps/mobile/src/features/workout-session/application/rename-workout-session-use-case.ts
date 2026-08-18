import { DomainId, WorkoutSession } from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type {
  WorkoutSessionLifecycle,
  WorkoutSessionRepository,
} from './workout-session-repository';

export type WorkoutSessionRenameContext = Readonly<{
  sessions: WorkoutSessionRepository;
}>;

/**
 * Why a rename was refused. Every reason maps to one fixed sentence in
 * presentation, so no message can carry a name, a value, a date, or an
 * identifier.
 */
export type WorkoutSessionRenameRefusal =
  'changed' | 'invalid-name' | 'not-found';

export type WorkoutSessionRenameOutcome =
  | Readonly<{ reason: WorkoutSessionRenameRefusal; status: 'refused' }>
  | Readonly<{ session: WorkoutSession; status: 'renamed' }>;

export type RenameWorkoutSessionInput = Readonly<{
  expected: WorkoutSessionLifecycle;
  name: unknown;
  sessionId: unknown;
}>;

export function workoutSessionLifecycle(
  session: WorkoutSession,
): WorkoutSessionLifecycle {
  return Object.freeze({
    completedAtEpochMilliseconds: session.completedAtEpochMilliseconds,
    startedAtEpochMilliseconds: session.startedAtEpochMilliseconds,
    status: session.status,
  });
}

/**
 * The only way a workout's name may change after it is started.
 *
 * A name is the one thing about a workout its owner chooses rather than
 * something the workout observed, so this workflow reaches an active workout
 * and a completed one alike. It is deliberately not correction: it writes no
 * recorded value and passes through neither `correctCompleted` nor `replace`.
 *
 * The proposed name is validated by rebuilding the loaded aggregate through
 * `WorkoutSession.create`, which is how every other write in this feature
 * produces a changed session. That re-runs every invariant the aggregate
 * holds, so a rename cannot be the write that lets an otherwise invalid
 * session through, and it needs no mutator on an aggregate that has never had
 * one. Only the trimmed name the aggregate accepted is written.
 *
 * The stored workout is reloaded inside the transaction and checked against
 * the lifecycle the screen loaded, so a workout finished, discarded, deleted,
 * restored, or replaced since then is refused rather than renamed.
 */
export class RenameWorkoutSessionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<WorkoutSessionRenameContext>,
  ) {}

  execute(
    input: RenameWorkoutSessionInput,
  ): Promise<WorkoutSessionRenameOutcome> {
    const id = DomainId.create(input.sessionId);
    if (!id.isSuccess) return Promise.resolve(refused('not-found'));
    return this.transactionRunner.run(async ({ sessions }) => {
      const stored = await sessions.getById(id.value);
      if (stored === null) return refused('not-found');
      const lifecycle = workoutSessionLifecycle(stored);
      if (
        lifecycle.status !== input.expected.status ||
        lifecycle.startedAtEpochMilliseconds !==
          input.expected.startedAtEpochMilliseconds ||
        lifecycle.completedAtEpochMilliseconds !==
          input.expected.completedAtEpochMilliseconds
      )
        return refused('changed');
      const renamed = WorkoutSession.create({ ...stored, name: input.name });
      if (!renamed.isSuccess) return refused('invalid-name');
      const written = await sessions.rename(
        id.value,
        renamed.value.name,
        lifecycle,
      );
      if (!written) return refused('changed');
      return Object.freeze({
        session: renamed.value,
        status: 'renamed' as const,
      });
    });
  }
}

function refused(
  reason: WorkoutSessionRenameRefusal,
): Readonly<{ reason: WorkoutSessionRenameRefusal; status: 'refused' }> {
  return Object.freeze({ reason, status: 'refused' as const });
}
