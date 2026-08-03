import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import {
  buildConsumptionEntry,
  type SaveConsumptionEntryInput,
} from './build-consumption-entry';
import type { ConsumptionEntryTransactionContext } from './consumption-entry-repository';

export class CreateConsumptionEntryUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<ConsumptionEntryTransactionContext>,
    private readonly generateId: () => string,
    private readonly getCurrentTime: () => number,
  ) {}

  async execute(input: SaveConsumptionEntryInput) {
    const result = buildConsumptionEntry(
      this.generateId(),
      input,
      this.getCurrentTime(),
    );
    if (!result.isSuccess) return result;
    await this.transactionRunner.run((context) =>
      context.consumptionEntryRepository.insert(result.value),
    );
    return result;
  }
}
