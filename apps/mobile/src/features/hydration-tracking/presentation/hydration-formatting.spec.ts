import { Volume } from '@fitness/domain';
import {
  formatHydrationPercentage,
  formatHydrationTime,
  formatHydrationVolume,
} from './hydration-formatting';

describe('hydration formatting', () => {
  it('uses mL below one liter and liters at or above it', () => {
    const small = Volume.create(750, 'milliliter');
    const large = Volume.create(2_100, 'milliliter');
    if (!small.isSuccess || !large.isSuccess)
      throw new Error('Invalid fixture');
    expect(formatHydrationVolume(small.value)).toBe('750 mL');
    expect(formatHydrationVolume(large.value)).toContain('2.1 L');
  });

  it('formats captured time and uncapped percentage', () => {
    expect(formatHydrationTime(Date.UTC(2026, 7, 4, 4), 480)).toBe('12:00');
    expect(formatHydrationPercentage(133.4)).toBe('133%');
  });
});
