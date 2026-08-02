import type { GoalRepository } from './goal-repository';

export class GetGoalUseCase {
  constructor(private readonly repository: GoalRepository) {}

  execute() {
    return this.repository.get();
  }
}
