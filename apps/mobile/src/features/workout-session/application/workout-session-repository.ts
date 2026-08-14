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
   * Writes an explicitly corrected completed aggregate.
   *
   * Deliberately separate from `replace`, which rewrites the parent name,
   * status, and completion timestamp. A correction changes recorded results
   * only, so this contract confirms the stored workout is still completed with
   * the same start and completion instants and then rewrites child rows alone.
   * No correction path can reach a parent lifecycle column.
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
