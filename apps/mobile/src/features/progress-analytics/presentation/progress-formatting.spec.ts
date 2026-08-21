import {
  formatProgressEnergy,
  formatProgressMass,
  formatProgressVolume,
} from './progress-formatting';

describe('progress formatting', () => {
  it('formats canonical units for compact summaries', () => {
    expect(formatProgressEnergy(4_184)).toBe('1000 kcal');
    expect(formatProgressMass(null, 'g')).toBe('Incomplete');
    expect(formatProgressMass(12.25, 'g')).toBe('12.3 g');
    expect(formatProgressVolume(2_500)).toBe('2.5 L');
  });

  it('renders a nutrient in the unit it was recorded in', () => {
    expect(formatProgressMass(450, 'mg')).toBe('450 mg');
    expect(formatProgressMass(null, 'mg')).toBe('Incomplete');
  });

  it('groups a period sodium total rather than running its digits together', () => {
    // A month of sodium is a five-digit milligram figure. Grouping is why this
    // stays one formatter rather than borrowing the daily screen's, which
    // renders the same number without a separator.
    expect(formatProgressMass(70_300, 'mg')).toBe('70,300 mg');
  });
});
