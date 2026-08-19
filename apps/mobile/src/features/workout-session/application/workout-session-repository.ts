import type {
  DomainId,
  WorkoutSession,
  WorkoutSessionStatus,
} from '@fitness/domain';

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

/**
 * The lifecycle facts a caller believes a workout of any status still holds.
 *
 * Wider than `CompletedWorkoutLifecycle` because a rename is the one workflow
 * that reaches both an active and a completed workout, so its guard has to
 * carry the status the caller saw as well as the instants. A caller holding a
 * screen opened while the workout was active cannot rename it after it was
 * finished, because the status it names no longer matches the stored row.
 */
export type WorkoutSessionLifecycle = Readonly<{
  completedAtEpochMilliseconds: number | null;
  startedAtEpochMilliseconds: number;
  status: WorkoutSessionStatus;
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
  /**
   * Rewrites one workout's name and nothing else.
   *
   * Deliberately separate from `replace`, which also rewrites status and
   * completion and then deletes and reinserts every child row. Renaming
   * through that method would rewrite every recorded set to change a label.
   * This contract issues one guarded `UPDATE` against the parent row, so no
   * exercise, set, position, or timestamp is touched on any path.
   *
   * Unlike `deleteCompleted` and `discard` this one method serves both
   * statuses. Those two are split because destruction must never reach the
   * wrong lifecycle; a rename destroys nothing, and the status the caller
   * expects is a bound predicate on the statement itself, so a caller cannot
   * rename a workout whose lifecycle moved underneath it.
   *
   * Reports whether a row matched the expected lifecycle. Nothing is written
   * when none did.
   */
  rename(
    id: DomainId,
    name: string,
    expected: WorkoutSessionLifecycle,
  ): Promise<boolean>;
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
