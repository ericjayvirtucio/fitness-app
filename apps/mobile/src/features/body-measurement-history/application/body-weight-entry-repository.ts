import type { BodyWeightEntry, DomainId } from '@fitness/domain';
import type {
  BodyWeightHistoryPage,
  BodyWeightHistoryPageQuery,
} from './body-weight-history-models';

export interface BodyWeightEntryRepository {
  delete(id: DomainId): Promise<boolean>;
  getById(id: DomainId): Promise<BodyWeightEntry | null>;
  getLatest(): Promise<BodyWeightEntry | null>;
  insert(entry: BodyWeightEntry): Promise<void>;
  listPage(query: BodyWeightHistoryPageQuery): Promise<BodyWeightHistoryPage>;
  update(entry: BodyWeightEntry): Promise<boolean>;
}
