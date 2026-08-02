import { Energy, isOk } from '@fitness/domain';
import {
  formatEntryTime,
  formatNutrient,
  formatNutritionEnergy,
} from './nutrition-formatting';

describe('nutrition formatting', () => {
  it('formats presentation values without changing unknown semantics', () => {
    const energy = Energy.create(100.4, 'kilocalorie');
    if (!isOk(energy)) throw new Error('Invalid fixture.');
    expect(formatNutritionEnergy(energy.value)).toBe('100 kcal');
    expect(formatNutrient(null, 'g')).toBe('Incomplete');
    expect(formatNutrient(2.25, 'g')).toBe('2.3 g');
  });

  it('formats time using the captured offset', () => {
    expect(formatEntryTime(Date.UTC(2026, 7, 2, 4), 480)).toBe('12:00 PM');
  });
});
