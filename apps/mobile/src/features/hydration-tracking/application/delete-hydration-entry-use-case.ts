import { DomainId, isErr } from '@fitness/domain';
import type { HydrationEntryRepository } from './hydration-entry-repository';

export class DeleteHydrationEntryUseCase {
  constructor(private readonly repository: HydrationEntryRepository) {}

  async execute(idValue: unknown): Promise<boolean> {
    const id = DomainId.create(idValue);
    return isErr(id) ? false : this.repository.delete(id.value);
  }
}
