import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { DomainError, err } from '@fitness/domain';
import {
  buildConsumptionEntry,
  type SaveConsumptionEntryInput,
} from './build-consumption-entry';
import type { ConsumptionEntryTransactionContext } from './consumption-entry-repository';

export class UpdateConsumptionEntryUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<ConsumptionEntryTransactionContext>,
    private readonly getCurrentTime: () => number,
  ) {}

  async execute(id: unknown, input: SaveConsumptionEntryInput) {
    const result = buildConsumptionEntry(id, input, this.getCurrentTime());
    if (!result.isSuccess) return result;
    const didUpdate = await this.transactionRunner.run((context) =>
      context.consumptionEntryRepository.update(result.value),
    );
    return didUpdate
      ? result
      : err([
          DomainError.create(
            'invalid-identifier',
            'Consumption entry no longer exists.',
            'id',
          ),
        ]);
  }
}
