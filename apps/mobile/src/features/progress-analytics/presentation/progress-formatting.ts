export function formatProgressEnergy(kilojoules: number): string {
  return `${Math.round(kilojoules / 4.184)} kcal`;
}

export function formatProgressMass(grams: number | null): string {
  if (grams === null) return 'Incomplete';
  return `${formatNumber(grams, 1)} g`;
}

export function formatProgressVolume(milliliters: number): string {
  return milliliters >= 1_000
    ? `${formatNumber(milliliters / 1_000, 2)} L`
    : `${formatNumber(milliliters, 0)} mL`;
}

export function formatProgressDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1),
  ).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
  });
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(
    value,
  );
}
