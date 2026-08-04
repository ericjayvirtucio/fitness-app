import type { Volume } from '@fitness/domain';

export function formatHydrationVolume(volume: Volume): string {
  return volume.milliliters >= 1_000
    ? `${formatNumber(volume.in('liter'), 2)} L`
    : `${formatNumber(volume.milliliters, 0)} mL`;
}

export function formatHydrationTime(
  epochMilliseconds: number,
  utcOffsetMinutes: number,
): string {
  const shifted = new Date(epochMilliseconds + utcOffsetMinutes * 60_000);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(
    shifted.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

export function formatHydrationPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(
    value,
  );
}
