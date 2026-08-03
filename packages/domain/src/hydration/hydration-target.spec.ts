import { describe, expect, it } from 'vitest';
import { Volume } from '../shared/measurement/volume';
import { HydrationTarget } from './hydration-target';

describe('HydrationTarget', () => {
  it('retains a canonical positive target', () => {
    const volume = Volume.create(3, 'liter');
    if (!volume.isSuccess) throw new Error('Invalid fixture');
    const result = HydrationTarget.create(volume.value);
    expect(result.isSuccess && result.value.volume.milliliters).toBe(3_000);
    if (result.isSuccess) expect(Object.isFrozen(result.value)).toBe(true);
  });

  it.each([0, 20_001])('rejects an out-of-range target', (amount) => {
    const volume = Volume.create(amount, 'milliliter');
    if (!volume.isSuccess) throw new Error('Invalid fixture');
    const result = HydrationTarget.create(volume.value);
    expect(result.isSuccess).toBe(false);
    if (!result.isSuccess) expect(result.error.field).toBe('targetVolume');
  });

  it('rejects a missing Volume value', () => {
    expect(HydrationTarget.create(3_000).isSuccess).toBe(false);
  });
});
