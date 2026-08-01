import { getTabDestination, tabDestinations } from './tab-destinations';

describe('tab destinations', () => {
  it('starts with Today and exposes the five primary destinations', () => {
    expect(tabDestinations.map(({ title }) => title)).toEqual([
      'Today',
      'Nutrition',
      'Workout',
      'Progress',
      'Profile',
    ]);
    expect(tabDestinations[0]?.route).toBe('index');
  });

  it('provides future-facing copy without fake fitness data', () => {
    for (const destination of tabDestinations) {
      expect(destination.description).toMatch(/later phase/);
    }
  });

  it('fails explicitly for an unknown destination', () => {
    expect(() => getTabDestination('unknown' as never)).toThrow(
      'Unknown tab destination',
    );
  });
});
