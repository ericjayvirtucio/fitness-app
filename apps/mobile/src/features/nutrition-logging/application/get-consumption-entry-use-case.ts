import { DomainId, isErr } from '@fitness/domain';
import type { ConsumptionEntryRepository } from './consumption-entry-repository';

export class GetConsumptionEntryUseCase {
  constructor(private readonly repository: ConsumptionEntryRepository) {}

  async execute(idValue: unknown) {
    const id = DomainId.create(idValue);
    if (isErr(id)) return null;
    return this.repository.getById(id.value);
  }
}
