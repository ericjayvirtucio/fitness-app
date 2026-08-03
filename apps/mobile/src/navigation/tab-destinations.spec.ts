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

  it('provides future-facing copy only for unfinished destinations', () => {
    for (const destination of tabDestinations.filter(
      ({ route }) => route !== 'nutrition' && route !== 'index',
    )) {
      expect(destination.description).toMatch(/later phase/);
    }
    expect(getTabDestination('nutrition').description).toMatch(/offline/);
    expect(getTabDestination('index').description).toMatch(
      /hydration.*offline/,
    );
  });

  it('fails explicitly for an unknown destination', () => {
    expect(() => getTabDestination('unknown' as never)).toThrow(
      'Unknown tab destination',
    );
  });
});
