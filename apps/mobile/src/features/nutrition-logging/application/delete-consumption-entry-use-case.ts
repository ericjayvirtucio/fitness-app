import { DomainId, isErr } from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type { ConsumptionEntryTransactionContext } from './consumption-entry-repository';

export class DeleteConsumptionEntryUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<ConsumptionEntryTransactionContext>,
  ) {}

  async execute(idValue: unknown): Promise<boolean> {
    const id = DomainId.create(idValue);
    if (isErr(id)) return false;
    return this.transactionRunner.run((context) =>
      context.consumptionEntryRepository.delete(id.value),
    );
  }
}
