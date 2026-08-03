import type { DomainId, HydrationEntry } from '@fitness/domain';

export interface HydrationEntryRepository {
  delete(id: DomainId): Promise<boolean>;
  getById(id: DomainId): Promise<HydrationEntry | null>;
  insert(entry: HydrationEntry): Promise<void>;
  listByLocalDate(date: string): Promise<readonly HydrationEntry[]>;
  update(entry: HydrationEntry): Promise<boolean>;
}
