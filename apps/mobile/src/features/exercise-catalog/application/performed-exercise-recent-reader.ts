import type { DomainId } from '@fitness/domain';

export interface PerformedExerciseRecentReader {
  listRecentlyPerformedExerciseIds(limit: number): Promise<readonly DomainId[]>;
}
