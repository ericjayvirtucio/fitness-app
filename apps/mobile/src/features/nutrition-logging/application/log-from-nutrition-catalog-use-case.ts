import {
  ConsumptionEntry,
  DomainError,
  DomainId,
  Mass,
  Volume,
  err,
  isErr,
  ok,
  type Result,
} from '@fitness/domain';
import {
  formatLocalCalendarDate,
  noonOnLocalCalendarDate,
} from '../../../application/date/local-calendar-date';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import type { NutritionCatalogTransactionContext } from './nutrition-catalog-use-cases';

export class LogFromNutritionCatalogUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<NutritionCatalogTransactionContext>,
    private readonly generateId: () => string,
    private readonly getCurrentTime: () => number,
  ) {}

  /**
   * A recording screen may ask for a day other than today. The request is
   * untrusted, so it is re-validated here rather than trusted from the screen.
   * Omitting it keeps the original behaviour: the entry occurs now, on today.
   */
  async execute(
    catalogIdValue: unknown,
    consumedAmountInput: unknown,
    localCalendarDateInput?: unknown,
  ): Promise<Result<ConsumptionEntry, readonly DomainError[]>> {
    const catalogId = DomainId.create(catalogIdValue);
    if (isErr(catalogId)) return err([catalogId.error]);
    const entryId = DomainId.create(this.generateId());
    if (isErr(entryId)) return err([entryId.error]);
    const now = this.getCurrentTime();
    const recordedAt = resolveRecordedInstant(localCalendarDateInput, now);
    if (isErr(recordedAt)) return err([recordedAt.error]);

    return this.transactionRunner.run(async (context) => {
      const item = await context.nutritionCatalogRepository.getById(
        catalogId.value,
      );
      if (item === null) {
        return err([
          DomainError.create(
            'invalid-identifier',
            'Saved nutrition item no longer exists.',
            'id',
          ),
        ]);
      }
      const consumedQuantity = createConsumedQuantity(
        item.facts.reference.kind,
        consumedAmountInput,
      );
      if (isErr(consumedQuantity)) return err([consumedQuantity.error]);
      const entry = ConsumptionEntry.create({
        consumedQuantity: consumedQuantity.value,
        facts: item.facts,
        id: entryId.value,
        kind: item.kind,
        ...recordedAt.value,
      });
      if (isErr(entry)) return err([entry.error]);
      await context.consumptionEntryRepository.insert(entry.value);
      /*
       * Usage recency is when the item was reached for, not the day the entry
       * was attributed to, so it keeps the clock rather than the chosen day.
       */
      const recorded = await context.nutritionCatalogRepository.recordUsage(
        catalogId.value,
        now,
      );
      if (!recorded) {
        throw new Error('Catalog item disappeared during transaction.');
      }
      return entry;
    });
  }
}

type RecordedInstant = Readonly<{
  localCalendarDate: string;
  occurredAtEpochMilliseconds: number;
  utcOffsetMinutes: number;
}>;

function resolveRecordedInstant(
  localCalendarDateInput: unknown,
  now: number,
): Result<RecordedInstant, DomainError> {
  if (localCalendarDateInput === undefined) {
    const date = new Date(now);
    return ok({
      localCalendarDate: formatLocalCalendarDate(date),
      occurredAtEpochMilliseconds: now,
      utcOffsetMinutes: -date.getTimezoneOffset(),
    });
  }
  const noon =
    typeof localCalendarDateInput === 'string'
      ? noonOnLocalCalendarDate(localCalendarDateInput)
      : null;
  if (typeof localCalendarDateInput !== 'string' || noon === null) {
    return err(
      DomainError.create(
        'invalid-date',
        'Consumption calendar date is invalid.',
      ),
    );
  }
  if (noon.getTime() > now) {
    return err(
      DomainError.create(
        'invalid-date',
        'Consumption time cannot be in the future.',
      ),
    );
  }
  return ok({
    localCalendarDate: localCalendarDateInput,
    occurredAtEpochMilliseconds: noon.getTime(),
    utcOffsetMinutes: -noon.getTimezoneOffset(),
  });
}

function createConsumedQuantity(kind: 'mass' | 'volume', input: unknown) {
  const value =
    typeof input === 'string' && input.trim() !== ''
      ? Number(input.trim())
      : typeof input === 'number'
        ? input
        : Number.NaN;
  if (kind === 'mass') {
    const mass = Mass.create(value, 'gram');
    return isErr(mass)
      ? err(withField(mass.error))
      : ({
          isSuccess: true,
          value: Object.freeze({ amount: mass.value, kind }),
        } as const);
  }
  const volume = Volume.create(value, 'milliliter');
  return isErr(volume)
    ? err(withField(volume.error))
    : ({
        isSuccess: true,
        value: Object.freeze({ amount: volume.value, kind }),
      } as const);
}

function withField(error: DomainError): DomainError {
  return DomainError.create(error.code, error.message, 'consumedAmount');
}
