import type { Energy } from '@fitness/domain';

export function formatNutritionEnergy(energy: Energy): string {
  return `${Math.round(energy.in('kilocalorie'))} kcal`;
}

export function formatNutrient(value: number | null, unit: 'g' | 'mg'): string {
  if (value === null) return 'Incomplete';
  const rounded = Math.round(value * 10) / 10;
  return `${String(rounded)} ${unit}`;
}

export function formatEntryTime(
  epochMilliseconds: number,
  utcOffsetMinutes: number,
): string {
  const shifted = new Date(epochMilliseconds + utcOffsetMinutes * 60_000);
  const hours = shifted.getUTCHours();
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${String(displayHours)}:${minutes} ${period}`;
}
