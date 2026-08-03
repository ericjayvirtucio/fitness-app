import { DomainError } from '../shared/domain-error';
import { DomainId } from '../shared/domain-id';
import { err, isErr, ok, type Result } from '../shared/result';
import {
  NutritionFacts,
  scaleNutritionFacts,
  type NutritionReference,
} from './nutrition-facts';

export const consumptionEntryKinds = Object.freeze([
  'food',
  'beverage',
] as const);

export type ConsumptionEntryKind = (typeof consumptionEntryKinds)[number];

export interface ConsumptionEntryInput {
  readonly consumedQuantity: unknown;
  readonly facts: unknown;
  readonly id: unknown;
  readonly kind: unknown;
  readonly localCalendarDate: unknown;
  readonly occurredAtEpochMilliseconds: unknown;
  readonly utcOffsetMinutes: unknown;
}

export class ConsumptionEntry {
  private constructor(
    readonly id: DomainId,
    readonly kind: ConsumptionEntryKind,
    readonly facts: NutritionFacts,
    readonly consumedQuantity: NutritionReference,
    readonly occurredAtEpochMilliseconds: number,
    readonly localCalendarDate: string,
    readonly utcOffsetMinutes: number,
    readonly consumedFacts: NutritionFacts,
  ) {
    Object.freeze(this);
  }

  static create(
    input: ConsumptionEntryInput,
  ): Result<ConsumptionEntry, DomainError> {
    if (!(input.id instanceof DomainId)) {
      return err(
        DomainError.create(
          'invalid-identifier',
          'Consumption entry identifier is invalid.',
          'id',
        ),
      );
    }

    if (
      typeof input.kind !== 'string' ||
      !consumptionEntryKinds.includes(input.kind as ConsumptionEntryKind)
    ) {
      return err(
        DomainError.create(
          'unsupported-option',
          'Choose food or beverage.',
          'kind',
        ),
      );
    }

    if (!(input.facts instanceof NutritionFacts)) {
      return err(
        DomainError.create(
          'required-field',
          'Nutrition facts are required.',
          'facts',
        ),
      );
    }

    const consumedFacts = scaleNutritionFacts(
      input.facts,
      input.consumedQuantity,
    );
    if (isErr(consumedFacts)) return consumedFacts;

    if (
      typeof input.occurredAtEpochMilliseconds !== 'number' ||
      !Number.isSafeInteger(input.occurredAtEpochMilliseconds) ||
      input.occurredAtEpochMilliseconds < 0
    ) {
      return err(
        DomainError.create(
          'invalid-date',
          'Consumption time is invalid.',
          'occurredAtEpochMilliseconds',
        ),
      );
    }

    if (
      typeof input.utcOffsetMinutes !== 'number' ||
      !Number.isInteger(input.utcOffsetMinutes) ||
      input.utcOffsetMinutes < -840 ||
      input.utcOffsetMinutes > 840
    ) {
      return err(
        DomainError.create(
          'invalid-date',
          'Consumption timezone offset is invalid.',
          'utcOffsetMinutes',
        ),
      );
    }

    if (
      typeof input.localCalendarDate !== 'string' ||
      !isMatchingLocalCalendarDate(
        input.localCalendarDate,
        input.occurredAtEpochMilliseconds,
        input.utcOffsetMinutes,
      )
    ) {
      return err(
        DomainError.create(
          'invalid-date',
          'Consumption calendar date is invalid.',
          'localCalendarDate',
        ),
      );
    }

    return ok(
      new ConsumptionEntry(
        input.id,
        input.kind as ConsumptionEntryKind,
        input.facts,
        consumedFacts.value.reference,
        input.occurredAtEpochMilliseconds,
        input.localCalendarDate,
        input.utcOffsetMinutes,
        consumedFacts.value,
      ),
    );
  }
}

function isMatchingLocalCalendarDate(
  value: string,
  epochMilliseconds: number,
  utcOffsetMinutes: number,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const shiftedDate = new Date(epochMilliseconds + utcOffsetMinutes * 60_000);
  if (!Number.isFinite(shiftedDate.getTime())) return false;

  return shiftedDate.toISOString().slice(0, 10) === value;
}
