import type { GoalConfiguration } from '@fitness/domain';

export interface GoalRepository {
  get(): Promise<GoalConfiguration | null>;
  save(goal: GoalConfiguration): Promise<void>;
}
