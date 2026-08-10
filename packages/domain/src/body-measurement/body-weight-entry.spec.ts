import { describe, expect, it } from 'vitest';
import { DomainId } from '../shared/domain-id';
import { Mass } from '../shared/measurement/mass';
import { BodyWeightEntry, bodyWeightEntryPolicy } from './body-weight-entry';

const id = DomainId.create('123e4567-e89b-42d3-a456-426614174000');
const mass = Mass.create(82.4, 'kilogram');

function validInput() {
  if (!id.isSuccess || !mass.isSuccess) throw new Error('Invalid fixture');
  return {
    id: id.value,
    localCalendarDate: '2026-08-04',
    mass: mass.value,
    note: undefined,
    occurredAtEpochMilliseconds: Date.UTC(2026, 7, 4, 4),
    utcOffsetMinutes: 480,
  } as const;
}

function massOf(kilograms: number): Mass {
  const result = Mass.create(kilograms, 'kilogram');
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('BodyWeightEntry', () => {
  it('creates an immutable canonical check-in', () => {
    const result = BodyWeightEntry.create(validInput());
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.mass.grams).toBeCloseTo(82_400, 6);
    expect(result.value.note).toBeNull();
    expect(result.value.localCalendarDate).toBe('2026-08-04');
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('keeps canonical grams independent of the entered unit', () => {
    const pounds = Mass.create(181.66, 'pound');
    if (!pounds.isSuccess) throw new Error('Invalid fixture');
    const result = BodyWeightEntry.create({
      ...validInput(),
      mass: pounds.value,
    });
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.mass.in('kilogram')).toBeCloseTo(82.4, 2);
    expect(result.value.mass.in('pound')).toBeCloseTo(181.66, 2);
  });

  it('trims an optional note and treats blank text as absent', () => {
    const trimmed = BodyWeightEntry.create({
      ...validInput(),
      note: '  Morning, before breakfast  ',
    });
    expect(trimmed.isSuccess && trimmed.value.note).toBe(
      'Morning, before breakfast',
    );
    const blank = BodyWeightEntry.create({ ...validInput(), note: '   ' });
    expect(blank.isSuccess && blank.value.note).toBeNull();
  });

  it('keeps the captured calendar date for a negative offset', () => {
    const result = BodyWeightEntry.create({
      ...validInput(),
      localCalendarDate: '2026-08-03',
      occurredAtEpochMilliseconds: Date.UTC(2026, 7, 4, 4),
      utcOffsetMinutes: -420,
    });
    expect(result.isSuccess && result.value.localCalendarDate).toBe(
      '2026-08-03',
    );
  });

  it.each([
    [{ ...validInput(), id: 'not-a-uuid' }, 'id'],
    [{ ...validInput(), mass: null }, 'mass'],
    [{ ...validInput(), mass: 82_400 }, 'mass'],
    [{ ...validInput(), note: 42 }, 'note'],
    [
      {
        ...validInput(),
        note: 'x'.repeat(bodyWeightEntryPolicy.maximumNoteLength + 1),
      },
      'note',
    ],
    [{ ...validInput(), localCalendarDate: '2026-08-05' }, 'localCalendarDate'],
    [{ ...validInput(), localCalendarDate: '04-08-2026' }, 'localCalendarDate'],
    [{ ...validInput(), utcOffsetMinutes: 841 }, 'utcOffsetMinutes'],
    [{ ...validInput(), utcOffsetMinutes: 30.5 }, 'utcOffsetMinutes'],
    [
      { ...validInput(), occurredAtEpochMilliseconds: Number.NaN },
      'occurredAtEpochMilliseconds',
    ],
    [
      { ...validInput(), occurredAtEpochMilliseconds: -1 },
      'occurredAtEpochMilliseconds',
    ],
  ])('rejects invalid check-in state', (input, field) => {
    const result = BodyWeightEntry.create(input);
    expect(result.isSuccess).toBe(false);
    if (!result.isSuccess) expect(result.error.field).toBe(field);
  });

  it('rejects weights outside the shared profile range', () => {
    for (const kilograms of [1.9, 500.1]) {
      const result = BodyWeightEntry.create({
        ...validInput(),
        mass: massOf(kilograms),
      });
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error.code).toBe('out-of-range');
        expect(result.error.field).toBe('mass');
      }
    }
  });

  it('accepts the inclusive range boundaries', () => {
    for (const kilograms of [2, 500]) {
      const result = BodyWeightEntry.create({
        ...validInput(),
        mass: massOf(kilograms),
      });
      expect(result.isSuccess).toBe(true);
    }
  });
});
