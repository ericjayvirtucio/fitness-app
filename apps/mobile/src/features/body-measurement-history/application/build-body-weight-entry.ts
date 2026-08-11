import {
  BodyWeightEntry,
  DomainError,
  DomainId,
  Mass,
  err,
  isErr,
  massUnits,
  type MassUnit,
  type Result,
} from '@fitness/domain';

export type SaveBodyWeightEntryInput = Readonly<{
  localCalendarDate: unknown;
  massUnit: unknown;
  massValue: unknown;
  note: unknown;
  occurredAtEpochMilliseconds: unknown;
  utcOffsetMinutes: unknown;
}>;

export type SaveBodyWeightEntryResult = Result<
  BodyWeightEntry,
  readonly DomainError[]
>;

export function buildBodyWeightEntry(
  idValue: unknown,
  input: SaveBodyWeightEntryInput,
  latestAllowedEpochMilliseconds: number,
): SaveBodyWeightEntryResult {
  const id = DomainId.create(idValue);
  if (isErr(id)) return err(Object.freeze([id.error]));

  if (!isMassUnit(input.massUnit)) {
    return err(
      Object.freeze([
        DomainError.create(
          'unsupported-unit',
          'Choose a supported weight unit.',
          'mass',
        ),
      ]),
    );
  }
  const mass = Mass.create(parseNumber(input.massValue), input.massUnit);
  if (isErr(mass)) {
    return err(
      Object.freeze([
        DomainError.create(mass.error.code, 'Enter a valid weight.', 'mass'),
      ]),
    );
  }

  if (
    typeof input.occurredAtEpochMilliseconds === 'number' &&
    input.occurredAtEpochMilliseconds > latestAllowedEpochMilliseconds
  ) {
    return err(
      Object.freeze([
        DomainError.create(
          'invalid-date',
          'Measurement time cannot be in the future.',
          'occurredAtEpochMilliseconds',
        ),
      ]),
    );
  }

  const entry = BodyWeightEntry.create({
    id: id.value,
    localCalendarDate: input.localCalendarDate,
    mass: mass.value,
    note: input.note,
    occurredAtEpochMilliseconds: input.occurredAtEpochMilliseconds,
    utcOffsetMinutes: input.utcOffsetMinutes,
  });
  return isErr(entry) ? err(Object.freeze([entry.error])) : entry;
}

function isMassUnit(value: unknown): value is MassUnit {
  return typeof value === 'string' && massUnits.includes(value as MassUnit);
}

function parseNumber(value: unknown): number {
  return typeof value === 'string' && value.trim() !== ''
    ? Number(value.trim())
    : typeof value === 'number'
      ? value
      : Number.NaN;
}
