import type { HydrationTarget } from '@fitness/domain';

export interface HydrationTargetRepository {
  get(): Promise<HydrationTarget | null>;
  save(target: HydrationTarget): Promise<void>;
}
