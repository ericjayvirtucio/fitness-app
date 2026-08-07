import type { DomainId, WorkoutSession } from '@fitness/domain';

export interface WorkoutSessionRepository {
  complete(session: WorkoutSession): Promise<WorkoutSession>;
  discard(id: DomainId): Promise<boolean>;
  getActive(): Promise<WorkoutSession | null>;
  getById(id: DomainId): Promise<WorkoutSession | null>;
  insert(session: WorkoutSession): Promise<void>;
  replace(session: WorkoutSession): Promise<void>;
}

export type WorkoutSessionTransactionContext = Readonly<{
  sessions: WorkoutSessionRepository;
}>;
