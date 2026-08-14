import type { DomainId, WorkoutSession } from '@fitness/domain';

/**
 * The lifecycle instants a caller believes a completed workout still holds.
 *
 * Comparing them inside the transaction stops a screen left open through
 * another deletion, a restore, or a replacement from removing whatever
 * aggregate now holds that identifier. It needs no stored timestamp, revision,
 * or version.
 */
export type CompletedWorkoutLifecycle = Readonly<{
  completedAtEpochMilliseconds: number;
  startedAtEpochMilliseconds: number;
}>;

export interface WorkoutSessionRepository {
  complete(session: WorkoutSession): Promise<WorkoutSession>;
  /**
   * Rewrites the complete child set of a completed aggregate.
   *
   * Deliberately separate from `replace`, which rewrites the parent name,
   * status, and completion timestamp. This contract confirms the stored workout
   * is still completed with the same start and completion instants and then
   * rewrites child rows alone, deleting every one of them before inserting any,
   * so no caller can reach a parent lifecycle column and no renumbering can
   * transiently violate a position constraint.
   *
   * Two workflows depend on it, both owned by `workout-history`: correcting a
   * recorded set, and removing one completed session exercise. Which children
   * the rebuilt aggregate holds is application policy that belongs to those use
   * cases; this contract validates lifecycle, not intent.
   */
  correctCompleted(session: WorkoutSession): Promise<void>;
  /**
   * Removes one completed aggregate and every row it owns.
   *
   * Deliberately separate from `discard`, which abandons an active session.
   * That method's only lifecycle guard is the `status = 'active'` predicate in
   * its own SQL, so widening it would let the active workout screen delete
   * completed history. This contract states its policy in its name, confirms
   * the stored workout is still completed with the same start and completion
   * instants, deletes children before parents, and verifies that no owned row
   * survives before returning.
   */
  deleteCompleted(
    id: DomainId,
    expected: CompletedWorkoutLifecycle,
  ): Promise<void>;
  discard(id: DomainId): Promise<boolean>;
  getActive(): Promise<WorkoutSession | null>;
  getById(id: DomainId): Promise<WorkoutSession | null>;
  insert(session: WorkoutSession): Promise<void>;
  replace(session: WorkoutSession): Promise<void>;
}

export type WorkoutSessionTransactionContext = Readonly<{
  sessions: WorkoutSessionRepository;
}>;
