import {
  buildHydrationEntry,
  type SaveHydrationEntryInput,
} from './build-hydration-entry';
import type { HydrationEntryRepository } from './hydration-entry-repository';

export class CreateHydrationEntryUseCase {
  constructor(
    private readonly repository: HydrationEntryRepository,
    private readonly generateId: () => string,
    private readonly getCurrentTime: () => number,
  ) {}

  async execute(input: SaveHydrationEntryInput) {
    const result = buildHydrationEntry(
      this.generateId(),
      input,
      this.getCurrentTime(),
    );
    if (result.isSuccess) await this.repository.insert(result.value);
    return result;
  }
}
