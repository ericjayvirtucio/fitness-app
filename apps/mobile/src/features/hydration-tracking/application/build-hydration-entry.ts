import {
  DomainError,
  DomainId,
  HydrationEntry,
  Volume,
  err,
  isErr,
  type Result,
} from '@fitness/domain';

export type SaveHydrationEntryInput = Readonly<{
  description: unknown;
  fluidType: unknown;
  localCalendarDate: unknown;
  occurredAtEpochMilliseconds: unknown;
  utcOffsetMinutes: unknown;
  volumeMilliliters: unknown;
}>;

export type SaveHydrationEntryResult = Result<
  HydrationEntry,
  readonly DomainError[]
>;

export function buildHydrationEntry(
  idValue: unknown,
  input: SaveHydrationEntryInput,
  latestAllowedEpochMilliseconds: number,
): SaveHydrationEntryResult {
  const id = DomainId.create(idValue);
  if (isErr(id)) return err(Object.freeze([id.error]));
  const volume = Volume.create(
    parseNumber(input.volumeMilliliters),
    'milliliter',
  );
  if (isErr(volume)) {
    return err(
      Object.freeze([
        DomainError.create(volume.error.code, volume.error.message, 'volume'),
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
          'Hydration time cannot be in the future.',
          'occurredAtEpochMilliseconds',
        ),
      ]),
    );
  }
  const entry = HydrationEntry.create({
    ...input,
    id: id.value,
    volume: volume.value,
  });
  return isErr(entry) ? err(Object.freeze([entry.error])) : entry;
}

function parseNumber(value: unknown): number {
  return typeof value === 'string' && value.trim() !== ''
    ? Number(value.trim())
    : typeof value === 'number'
      ? value
      : Number.NaN;
}
