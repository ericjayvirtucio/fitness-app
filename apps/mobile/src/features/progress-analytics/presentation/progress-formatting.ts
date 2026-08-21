export function formatProgressEnergy(kilojoules: number): string {
  return `${Math.round(kilojoules / 4.184)} kcal`;
}

/**
 * A nutrient's period value in the unit it was recorded in. Five nutrients are
 * stored in grams and sodium in milligrams, so the unit is supplied by the
 * caller that knows which nutrient it is labelling rather than baked into a
 * second formatter that would differ by one character of output.
 */
export function formatProgressMass(
  value: number | null,
  unit: 'g' | 'mg',
): string {
  if (value === null) return 'Incomplete';
  return `${formatNumber(value, 1)} ${unit}`;
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
