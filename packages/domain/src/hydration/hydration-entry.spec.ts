import { describe, expect, it } from 'vitest';
import { DomainId } from '../shared/domain-id';
import { Volume } from '../shared/measurement/volume';
import { HydrationEntry } from './hydration-entry';

const id = DomainId.create('123e4567-e89b-42d3-a456-426614174000');
const volume = Volume.create(500, 'milliliter');

function validInput() {
  if (!id.isSuccess || !volume.isSuccess) throw new Error('Invalid fixture');
  return {
    description: undefined,
    fluidType: 'plain-water',
    id: id.value,
    localCalendarDate: '2026-08-04',
    occurredAtEpochMilliseconds: Date.UTC(2026, 7, 4, 4),
    utcOffsetMinutes: 480,
    volume: volume.value,
  } as const;
}

describe('HydrationEntry', () => {
  it('creates an immutable canonical plain-water event', () => {
    const result = HydrationEntry.create(validInput());
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.volume.milliliters).toBe(500);
    expect(result.value.description).toBeNull();
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('trims an optional other-fluid description', () => {
    const result = HydrationEntry.create({
      ...validInput(),
      description: '  Tea  ',
      fluidType: 'other-fluid',
    });
    expect(result.isSuccess && result.value.description).toBe('Tea');
  });

  it.each([
    [{ ...validInput(), id: 'bad' }, 'id'],
    [{ ...validInput(), fluidType: 'juice' }, 'fluidType'],
    [{ ...validInput(), volume: null }, 'volume'],
    [{ ...validInput(), localCalendarDate: '2026-08-03' }, 'localCalendarDate'],
    [{ ...validInput(), utcOffsetMinutes: 841 }, 'utcOffsetMinutes'],
    [
      { ...validInput(), occurredAtEpochMilliseconds: Number.NaN },
      'occurredAtEpochMilliseconds',
    ],
  ])('rejects invalid entry state', (input, field) => {
    const result = HydrationEntry.create(input);
    expect(result.isSuccess).toBe(false);
    if (!result.isSuccess) expect(result.error.field).toBe(field);
  });

  it('rejects zero and excessive event volume', () => {
    for (const amount of [0, 10_001]) {
      const invalidVolume = Volume.create(amount, 'milliliter');
      if (!invalidVolume.isSuccess) throw new Error('Invalid fixture');
      const result = HydrationEntry.create({
        ...validInput(),
        volume: invalidVolume.value,
      });
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) expect(result.error.field).toBe('volume');
    }
  });

  it('rejects description on water and overly long other-fluid text', () => {
    const water = HydrationEntry.create({
      ...validInput(),
      description: 'Tap water',
    });
    const other = HydrationEntry.create({
      ...validInput(),
      description: 'x'.repeat(81),
      fluidType: 'other-fluid',
    });
    expect(water.isSuccess).toBe(false);
    expect(other.isSuccess).toBe(false);
  });
});
