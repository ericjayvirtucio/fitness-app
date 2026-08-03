import { DomainId, isErr } from '@fitness/domain';
import type { HydrationEntryRepository } from './hydration-entry-repository';

export class GetHydrationEntryUseCase {
  constructor(private readonly repository: HydrationEntryRepository) {}

  async execute(idValue: unknown) {
    const id = DomainId.create(idValue);
    return isErr(id) ? null : this.repository.getById(id.value);
  }
}
