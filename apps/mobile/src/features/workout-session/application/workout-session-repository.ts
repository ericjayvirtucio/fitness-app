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
   * Three workflows depend on it, all owned by `workout-history`: correcting a
   * recorded set, removing one completed session exercise, and adding one
   * completed session exercise. Which children the rebuilt aggregate holds is
   * application policy that belongs to those use cases; this contract validates
   * lifecycle, not intent.
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
  /**
   * Abandons one active aggregate and every row it owns.
   *
   * Deliberately separate from `deleteCompleted`, which removes recorded
   * history. Its lifecycle policy is the `status = 'active'` predicate,
   * asserted both when the session is looked up and again on the statement that
   * deletes it, so no caller reaching this method can remove a completed
   * workout. Children are deleted before the parent, and the caller runs the
   * whole method inside one exclusive transaction, so an interrupted discard
   * leaves the session, its exercises, and its sets exactly as they were rather
   * than a workout that recovers with its recorded sets missing.
   *
   * Reports whether an active session was found. Nothing is written when it was
   * not.
   */
  discard(id: DomainId): Promise<boolean>;
  getActive(): Promise<WorkoutSession | null>;
  getById(id: DomainId): Promise<WorkoutSession | null>;
  insert(session: WorkoutSession): Promise<void>;
  replace(session: WorkoutSession): Promise<void>;
}

/**
 * The narrowest context a session write can run in: the session repository and
 * nothing else. Discarding an active workout needs no Catalog and no Planner,
 * so it is given neither.
 */
export type WorkoutSessionTransactionContext = Readonly<{
  sessions: WorkoutSessionRepository;
}>;
