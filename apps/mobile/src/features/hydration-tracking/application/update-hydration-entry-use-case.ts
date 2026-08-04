import { DomainError, err } from '@fitness/domain';
import {
  buildHydrationEntry,
  type SaveHydrationEntryInput,
} from './build-hydration-entry';
import type { HydrationEntryRepository } from './hydration-entry-repository';

export class UpdateHydrationEntryUseCase {
  constructor(
    private readonly repository: HydrationEntryRepository,
    private readonly getCurrentTime: () => number,
  ) {}

  async execute(id: unknown, input: SaveHydrationEntryInput) {
    const result = buildHydrationEntry(id, input, this.getCurrentTime());
    if (!result.isSuccess) return result;
    return (await this.repository.update(result.value))
      ? result
      : err(
          Object.freeze([
            DomainError.create(
              'invalid-identifier',
              'Hydration entry no longer exists.',
              'id',
            ),
          ]),
        );
  }
}
