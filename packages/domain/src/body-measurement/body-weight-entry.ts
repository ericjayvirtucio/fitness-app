import { profileLimits } from '../personal-profile/user-profile';
import { DomainError } from '../shared/domain-error';
import { DomainId } from '../shared/domain-id';
import { Mass } from '../shared/measurement/mass';
import { err, ok, type Result } from '../shared/result';

// Historical check-ins share the profile's accepted weight range so a value the
// profile considers valid can never be rejected as history, or the reverse.
export const bodyWeightEntryPolicy = Object.freeze({
  maximumGrams: profileLimits.weightGrams.maximum,
  maximumNoteLength: 200,
  minimumGrams: profileLimits.weightGrams.minimum,
});

export interface BodyWeightEntryInput {
  readonly id: unknown;
  readonly localCalendarDate: unknown;
  readonly mass: unknown;
  readonly note?: unknown;
  readonly occurredAtEpochMilliseconds: unknown;
  readonly utcOffsetMinutes: unknown;
}

export class BodyWeightEntry {
  private constructor(
    readonly id: DomainId,
    readonly mass: Mass,
    readonly note: string | null,
    readonly occurredAtEpochMilliseconds: number,
    readonly localCalendarDate: string,
    readonly utcOffsetMinutes: number,
  ) {
    Object.freeze(this);
  }

  static create(
    input: BodyWeightEntryInput,
  ): Result<BodyWeightEntry, DomainError> {
    if (!(input.id instanceof DomainId)) {
      return err(
        DomainError.create(
          'invalid-identifier',
          'Body weight entry identifier is invalid.',
          'id',
        ),
      );
    }
    if (!(input.mass instanceof Mass)) {
      return err(
        DomainError.create('required-field', 'Weight is required.', 'mass'),
      );
    }
    if (
      input.mass.grams < bodyWeightEntryPolicy.minimumGrams ||
      input.mass.grams > bodyWeightEntryPolicy.maximumGrams
    ) {
      return err(
        DomainError.create(
          'out-of-range',
          'Weight must be between 2 and 500 kilograms.',
          'mass',
        ),
      );
    }

    const note = validateNote(input.note);
    if (!note.isSuccess) return note;

    if (
      typeof input.occurredAtEpochMilliseconds !== 'number' ||
      !Number.isSafeInteger(input.occurredAtEpochMilliseconds) ||
      input.occurredAtEpochMilliseconds < 0
    ) {
      return err(
        DomainError.create(
          'invalid-date',
          'Measurement time is invalid.',
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
          'Measurement timezone offset is invalid.',
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
          'Measurement calendar date is invalid.',
          'localCalendarDate',
        ),
      );
    }

    return ok(
      new BodyWeightEntry(
        input.id,
        input.mass,
        note.value,
        input.occurredAtEpochMilliseconds,
        input.localCalendarDate,
        input.utcOffsetMinutes,
      ),
    );
  }
}

function validateNote(value: unknown): Result<string | null, DomainError> {
  if (value === undefined || value === null) return ok(null);
  if (typeof value !== 'string') {
    return err(
      DomainError.create('required-field', 'Note must be text.', 'note'),
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return ok(null);
  if (trimmed.length > bodyWeightEntryPolicy.maximumNoteLength) {
    return err(
      DomainError.create(
        'out-of-range',
        `Note must be ${bodyWeightEntryPolicy.maximumNoteLength} characters or fewer.`,
        'note',
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
