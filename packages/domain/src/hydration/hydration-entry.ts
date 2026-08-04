import { DomainError } from '../shared/domain-error';
import { DomainId } from '../shared/domain-id';
import { Volume } from '../shared/measurement/volume';
import { err, ok, type Result } from '../shared/result';

export const hydrationFluidTypes = Object.freeze([
  'plain-water',
  'other-fluid',
] as const);

export type HydrationFluidType = (typeof hydrationFluidTypes)[number];

export const hydrationEntryPolicy = Object.freeze({
  maximumDescriptionLength: 80,
  maximumVolumeMilliliters: 10_000,
});

export interface HydrationEntryInput {
  readonly description?: unknown;
  readonly fluidType: unknown;
  readonly id: unknown;
  readonly localCalendarDate: unknown;
  readonly occurredAtEpochMilliseconds: unknown;
  readonly utcOffsetMinutes: unknown;
  readonly volume: unknown;
}

export class HydrationEntry {
  private constructor(
    readonly id: DomainId,
    readonly fluidType: HydrationFluidType,
    readonly volume: Volume,
    readonly description: string | null,
    readonly occurredAtEpochMilliseconds: number,
    readonly localCalendarDate: string,
    readonly utcOffsetMinutes: number,
  ) {
    Object.freeze(this);
  }

  static create(
    input: HydrationEntryInput,
  ): Result<HydrationEntry, DomainError> {
    if (!(input.id instanceof DomainId)) {
      return err(
        DomainError.create(
          'invalid-identifier',
          'Hydration entry identifier is invalid.',
          'id',
        ),
      );
    }
    if (
      typeof input.fluidType !== 'string' ||
      !hydrationFluidTypes.includes(input.fluidType as HydrationFluidType)
    ) {
      return err(
        DomainError.create(
          'unsupported-option',
          'Choose water or another fluid.',
          'fluidType',
        ),
      );
    }
    if (!(input.volume instanceof Volume)) {
      return err(
        DomainError.create('required-field', 'Volume is required.', 'volume'),
      );
    }
    if (
      input.volume.milliliters <= 0 ||
      input.volume.milliliters > hydrationEntryPolicy.maximumVolumeMilliliters
    ) {
      return err(
        DomainError.create(
          'out-of-range',
          `Volume must be greater than 0 and no more than ${hydrationEntryPolicy.maximumVolumeMilliliters} mL.`,
          'volume',
        ),
      );
    }

    const description = validateDescription(input.fluidType, input.description);
    if (!description.isSuccess) return description;

    if (
      typeof input.occurredAtEpochMilliseconds !== 'number' ||
      !Number.isSafeInteger(input.occurredAtEpochMilliseconds) ||
      input.occurredAtEpochMilliseconds < 0
    ) {
      return err(
        DomainError.create(
          'invalid-date',
          'Hydration time is invalid.',
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
          'Hydration timezone offset is invalid.',
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
          'Hydration calendar date is invalid.',
          'localCalendarDate',
        ),
      );
    }

    return ok(
      new HydrationEntry(
        input.id,
        input.fluidType as HydrationFluidType,
        input.volume,
        description.value,
        input.occurredAtEpochMilliseconds,
        input.localCalendarDate,
        input.utcOffsetMinutes,
      ),
    );
  }
}

function validateDescription(
  fluidType: unknown,
  value: unknown,
): Result<string | null, DomainError> {
  if (fluidType === 'plain-water') {
    if (value !== undefined && value !== null && value !== '') {
      return err(
        DomainError.create(
          'unsupported-option',
          'Plain water does not use a description.',
          'description',
        ),
      );
    }
    return ok(null);
  }
  if (value === undefined || value === null) return ok(null);
  if (typeof value !== 'string') {
    return err(
      DomainError.create(
        'required-field',
        'Description must be text.',
        'description',
      ),
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return ok(null);
  if (trimmed.length > hydrationEntryPolicy.maximumDescriptionLength) {
    return err(
      DomainError.create(
        'out-of-range',
        `Description must be ${hydrationEntryPolicy.maximumDescriptionLength} characters or fewer.`,
        'description',
      ),
    );
  }
  return ok(trimmed);
}

function isMatchingLocalCalendarDate(
  value: string,
  epochMilliseconds: number,
  utcOffsetMinutes: number,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const shiftedDate = new Date(epochMilliseconds + utcOffsetMinutes * 60_000);
  return (
    Number.isFinite(shiftedDate.getTime()) &&
    shiftedDate.toISOString().slice(0, 10) === value
  );
}
