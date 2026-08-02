import type { ConsumptionEntry, DomainId } from '@fitness/domain';

export interface ConsumptionEntryRepository {
  delete(id: DomainId): Promise<boolean>;
  getById(id: DomainId): Promise<ConsumptionEntry | null>;
  insert(entry: ConsumptionEntry): Promise<void>;
  listByLocalDate(date: string): Promise<readonly ConsumptionEntry[]>;
  update(entry: ConsumptionEntry): Promise<boolean>;
}

export type ConsumptionEntryTransactionContext = Readonly<{
  consumptionEntryRepository: ConsumptionEntryRepository;
}>;
