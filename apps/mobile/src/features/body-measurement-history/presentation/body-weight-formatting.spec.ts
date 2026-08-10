import { BodyWeightEntry, DomainId, Mass, isErr } from '@fitness/domain';
import {
  describeBodyWeight,
  describeBodyWeightChange,
  describeBodyWeightEntry,
  formatBodyWeight,
  formatBodyWeightChange,
  formatMeasurementTime,
  getBodyWeightDisplayUnit,
} from './body-weight-formatting';

function entry(note: string | null, utcOffsetMinutes: number) {
  const id = DomainId.create('123e4567-e89b-42d3-a456-426614174000');
  const mass = Mass.create(82_400, 'gram');
  if (isErr(id) || isErr(mass)) throw new Error('Invalid fixture');
  const created = BodyWeightEntry.create({
    id: id.value,
    localCalendarDate: utcOffsetMinutes === 480 ? '2026-08-04' : '2026-08-03',
    mass: mass.value,
    note,
    occurredAtEpochMilliseconds: Date.UTC(2026, 7, 4, 4),
    utcOffsetMinutes,
  });
  if (isErr(created)) throw new Error('Invalid fixture');
  return created.value;
}

describe('body weight formatting', () => {
  it('selects a display unit from the profile preference', () => {
    expect(getBodyWeightDisplayUnit('imperial')).toBe('pound');
    expect(getBodyWeightDisplayUnit('metric')).toBe('kilogram');
    expect(getBodyWeightDisplayUnit(undefined)).toBe('kilogram');
  });

  it('renders the same canonical grams in either unit', () => {
    expect(formatBodyWeight(82_400, 'kilogram')).toBe('82.4 kg');
    expect(formatBodyWeight(82_400, 'pound')).toBe('181.7 lb');
  });

  it('signs a recorded change without implying a trend', () => {
    expect(formatBodyWeightChange(-1_200, 'kilogram')).toBe('−1.2 kg');
    expect(formatBodyWeightChange(500, 'kilogram')).toBe('+0.5 kg');
    expect(formatBodyWeightChange(0, 'kilogram')).toBe('0.0 kg');
  });

  it('spells units and direction for assistive technology', () => {
    expect(describeBodyWeight(82_400, 'kilogram')).toBe('82.4 kilograms');
    expect(describeBodyWeightChange(-1_200, 'kilogram')).toBe(
      'minus 1.2 kilograms',
    );
    expect(describeBodyWeightChange(1_200, 'pound')).toBe('plus 2.6 pounds');
  });

  it('renders the captured time from the stored offset', () => {
    expect(formatMeasurementTime(entry(null, 480))).toBe('12:00');
    expect(formatMeasurementTime(entry(null, -420))).toBe('21:00');
  });

  it('builds a combined label including an optional note', () => {
    expect(
      describeBodyWeightEntry(entry('Morning', 480), 'kilogram'),
    ).toContain('Weight check-in 82.4 kilograms');
    expect(
      describeBodyWeightEntry(entry('Morning', 480), 'kilogram'),
    ).toContain('note Morning');
    expect(describeBodyWeightEntry(entry(null, 480), 'kilogram')).not.toContain(
      'note',
    );
  });
});
