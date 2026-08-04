import type { HydrationTargetRepository } from './hydration-target-repository';

export class GetHydrationTargetUseCase {
  constructor(private readonly repository: HydrationTargetRepository) {}

  execute() {
    return this.repository.get();
  }
}
