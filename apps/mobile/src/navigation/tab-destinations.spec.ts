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
    expect(tabDestinations.map(({ testID }) => testID)).toEqual([
      'tab-today',
      'tab-nutrition',
      'tab-workout',
      'tab-progress',
      'tab-profile',
    ]);
  });

  it('provides future-facing copy only for unfinished destinations', () => {
    for (const destination of tabDestinations.filter(({ route }) =>
      ['profile', 'progress'].includes(route),
    )) {
      expect(destination.description).toMatch(/later phase/);
    }
    expect(getTabDestination('nutrition').description).toMatch(/offline/);
    expect(getTabDestination('workout').description).toMatch(/offline/);
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
