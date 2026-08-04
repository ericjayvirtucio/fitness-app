import { describe, expect, it } from 'vitest';
import { DomainId } from '../shared/domain-id';
import { Volume } from '../shared/measurement/volume';
import { HydrationEntry, type HydrationFluidType } from './hydration-entry';
import { HydrationTarget } from './hydration-target';
import { summarizeHydrationEntries } from './daily-hydration-summary';

function entry(amount: number, fluidType: HydrationFluidType, suffix: string) {
  const id = DomainId.create(`123e4567-e89b-42d3-a456-4266141740${suffix}`);
  const volume = Volume.create(amount, 'milliliter');
  if (!id.isSuccess || !volume.isSuccess) throw new Error('Invalid fixture');
  const result = HydrationEntry.create({
    fluidType,
    id: id.value,
    localCalendarDate: '2026-08-04',
    occurredAtEpochMilliseconds: Date.UTC(2026, 7, 4, 4),
    utcOffsetMinutes: 480,
    volume: volume.value,
  });
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function target(amount: number) {
  const volume = Volume.create(amount, 'milliliter');
  if (!volume.isSuccess) throw new Error('Invalid fixture');
  const result = HydrationTarget.create(volume.value);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('summarizeHydrationEntries', () => {
  it('returns zero totals and no progress without a target', () => {
    const result = summarizeHydrationEntries([], null);
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.totalFluidVolume.milliliters).toBe(0);
    expect(result.value.completionPercentage).toBeNull();
    expect(result.value.remainingVolume).toBeNull();
  });

  it('separates water and other fluid and calculates progress', () => {
    const result = summarizeHydrationEntries(
      [entry(500, 'plain-water', '00'), entry(250, 'other-fluid', '01')],
      target(3_000),
    );
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.entryCount).toBe(2);
    expect(result.value.totalFluidVolume.milliliters).toBe(750);
    expect(result.value.plainWaterVolume.milliliters).toBe(500);
    expect(result.value.otherFluidVolume.milliliters).toBe(250);
    expect(result.value.remainingVolume?.milliliters).toBe(2_250);
    expect(result.value.completionPercentage).toBe(25);
  });

  it('keeps actual over-target progress and clamps only remaining', () => {
    const result = summarizeHydrationEntries(
      [entry(4_000, 'plain-water', '00')],
      target(3_000),
    );
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.totalFluidVolume.milliliters).toBe(4_000);
    expect(result.value.remainingVolume?.milliliters).toBe(0);
    expect(result.value.completionPercentage).toBeCloseTo(133.3333);
  });
});
