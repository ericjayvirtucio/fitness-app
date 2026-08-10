import {
  formatProgressEnergy,
  formatProgressMass,
  formatProgressVolume,
} from './progress-formatting';

describe('progress formatting', () => {
  it('formats canonical units for compact summaries', () => {
    expect(formatProgressEnergy(4_184)).toBe('1000 kcal');
    expect(formatProgressMass(null)).toBe('Incomplete');
    expect(formatProgressMass(12.25)).toBe('12.3 g');
    expect(formatProgressVolume(2_500)).toBe('2.5 L');
  });
});
