import type { DomainId, WorkoutSession } from '@fitness/domain';

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
  discard(id: DomainId): Promise<boolean>;
  getActive(): Promise<WorkoutSession | null>;
  getById(id: DomainId): Promise<WorkoutSession | null>;
  insert(session: WorkoutSession): Promise<void>;
  replace(session: WorkoutSession): Promise<void>;
}

export type WorkoutSessionTransactionContext = Readonly<{
  sessions: WorkoutSessionRepository;
}>;
