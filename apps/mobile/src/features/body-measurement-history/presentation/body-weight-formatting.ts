import type { BodyWeightEntry, MassUnit, UnitSystem } from '@fitness/domain';

export type BodyWeightDisplayUnit = Extract<MassUnit, 'kilogram' | 'pound'>;

const unitLabels: Readonly<Record<BodyWeightDisplayUnit, string>> =
  Object.freeze({
    kilogram: 'kg',
    pound: 'lb',
  });

const spokenUnits: Readonly<Record<BodyWeightDisplayUnit, string>> =
  Object.freeze({
    kilogram: 'kilograms',
    pound: 'pounds',
  });

export function getBodyWeightDisplayUnit(
  unitSystem: UnitSystem | undefined,
): BodyWeightDisplayUnit {
  return unitSystem === 'imperial' ? 'pound' : 'kilogram';
}

export function convertGrams(
  grams: number,
  unit: BodyWeightDisplayUnit,
): number {
  return unit === 'pound' ? grams / 453.59237 : grams / 1_000;
}

export function formatBodyWeight(
  grams: number,
  unit: BodyWeightDisplayUnit,
): string {
  return `${formatNumber(convertGrams(grams, unit))} ${unitLabels[unit]}`;
}

export function formatBodyWeightChange(
  grams: number,
  unit: BodyWeightDisplayUnit,
): string {
  const value = convertGrams(grams, unit);
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value))} ${unitLabels[unit]}`;
}

export function describeBodyWeight(
  grams: number,
  unit: BodyWeightDisplayUnit,
): string {
  return `${formatNumber(convertGrams(grams, unit))} ${spokenUnits[unit]}`;
}

export function describeBodyWeightChange(
  grams: number,
  unit: BodyWeightDisplayUnit,
): string {
  const value = convertGrams(grams, unit);
  const direction = value > 0 ? 'plus ' : value < 0 ? 'minus ' : '';
  return `${direction}${formatNumber(Math.abs(value))} ${spokenUnits[unit]}`;
}

export function formatMeasurementDate(localCalendarDate: string): string {
  const [year, month, day] = localCalendarDate.split('-').map(Number);
  return new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1),
  ).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
    year: 'numeric',
  });
}

/** Rendered from the captured offset so a stored time never shifts. */
export function formatMeasurementTime(entry: BodyWeightEntry): string {
  const shifted = new Date(
    entry.occurredAtEpochMilliseconds + entry.utcOffsetMinutes * 60_000,
  );
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(
    shifted.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

export function describeBodyWeightEntry(
  entry: BodyWeightEntry,
  unit: BodyWeightDisplayUnit,
): string {
  const parts = [
    `Weight check-in ${describeBodyWeight(entry.mass.grams, unit)}`,
    `recorded ${formatMeasurementDate(entry.localCalendarDate)} at ${formatMeasurementTime(entry)}`,
  ];
  if (entry.note) parts.push(`note ${entry.note}`);
  return `${parts.join(', ')}.`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value);
}
