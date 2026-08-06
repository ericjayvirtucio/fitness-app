import type {
  PlannedPrescription,
  UnitSystem,
  WeekdayValue,
} from '@fitness/domain';

export const weekdayLabels: Readonly<Record<WeekdayValue, string>> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export function formatPrescription(
  target: PlannedPrescription,
  units: UnitSystem,
): string {
  const prefix = `${target.sets} × `;
  if (target.kind === 'repetitions')
    return `${prefix}${target.repetitions} reps`;
  if (target.kind === 'resistance-and-repetitions') {
    const resistance = target.resistance
      ? ` at ${formatNumber(
          target.resistance.in(units === 'imperial' ? 'pound' : 'kilogram'),
        )} ${units === 'imperial' ? 'lb' : 'kg'}`
      : '';
    return `${prefix}${target.repetitions} reps${resistance}`;
  }
  if (target.kind === 'duration')
    return `${prefix}${formatDuration(target.duration.seconds)}`;
  const distance = `${formatNumber(
    target.distance.in(units === 'imperial' ? 'mile' : 'kilometer'),
  )} ${units === 'imperial' ? 'mi' : 'km'}`;
  return target.kind === 'distance'
    ? `${prefix}${distance}`
    : `${prefix}${distance} in ${formatDuration(target.duration.seconds)}`;
}

function formatDuration(seconds: number): string {
  return seconds % 60 === 0
    ? `${formatNumber(seconds / 60)} min`
    : `${formatNumber(seconds)} sec`;
}

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}
