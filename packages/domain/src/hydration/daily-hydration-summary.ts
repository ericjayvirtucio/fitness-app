import type { DomainError } from '../shared/domain-error';
import { Volume } from '../shared/measurement/volume';
import { err, isErr, ok, type Result } from '../shared/result';
import type { HydrationEntry } from './hydration-entry';
import type { HydrationTarget } from './hydration-target';

export type DailyHydrationSummary = Readonly<{
  completionPercentage: number | null;
  entryCount: number;
  otherFluidVolume: Volume;
  plainWaterVolume: Volume;
  remainingVolume: Volume | null;
  targetVolume: Volume | null;
  totalFluidVolume: Volume;
}>;

export function summarizeHydrationEntries(
  entries: readonly HydrationEntry[],
  target: HydrationTarget | null,
): Result<DailyHydrationSummary, DomainError> {
  let plainWaterMilliliters = 0;
  let otherFluidMilliliters = 0;
  for (const entry of entries) {
    if (entry.fluidType === 'plain-water') {
      plainWaterMilliliters += entry.volume.milliliters;
    } else {
      otherFluidMilliliters += entry.volume.milliliters;
    }
  }
  const totalFluidMilliliters = plainWaterMilliliters + otherFluidMilliliters;
  const totalFluidVolume = Volume.create(totalFluidMilliliters, 'milliliter');
  const plainWaterVolume = Volume.create(plainWaterMilliliters, 'milliliter');
  const otherFluidVolume = Volume.create(otherFluidMilliliters, 'milliliter');
  if (isErr(totalFluidVolume)) return err(totalFluidVolume.error);
  if (isErr(plainWaterVolume)) return err(plainWaterVolume.error);
  if (isErr(otherFluidVolume)) return err(otherFluidVolume.error);

  const remainingVolume = target
    ? Volume.create(
        Math.max(target.volume.milliliters - totalFluidMilliliters, 0),
        'milliliter',
      )
    : null;
  if (remainingVolume && isErr(remainingVolume)) {
    return err(remainingVolume.error);
  }

  return ok(
    Object.freeze({
      completionPercentage: target
        ? (totalFluidMilliliters / target.volume.milliliters) * 100
        : null,
      entryCount: entries.length,
      otherFluidVolume: otherFluidVolume.value,
      plainWaterVolume: plainWaterVolume.value,
      remainingVolume: remainingVolume?.value ?? null,
      targetVolume: target?.volume ?? null,
      totalFluidVolume: totalFluidVolume.value,
    }),
  );
}
