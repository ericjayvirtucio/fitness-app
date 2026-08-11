import type { DataRestorePreview } from '../application/restore-data';
import {
  describeRestorePreview,
  formatExportCreatedAt,
} from './data-restore-formatting';

const preview: DataRestorePreview = Object.freeze({
  bodyWeightCheckIns: 12,
  completedWorkouts: 4,
  exercises: 9,
  generatedAt: '2026-08-11T09:15:04.123Z',
  hasActiveWorkout: false,
  hasGoal: true,
  hasHydrationTarget: false,
  hasProfile: true,
  hydrationEntries: 30,
  nutritionCatalogItems: 7,
  nutritionEntries: 120,
  plannedWorkouts: 3,
});

describe('describeRestorePreview', () => {
  it('reports counts and presence in a fixed order', () => {
    expect(describeRestorePreview(preview).map((row) => row.label)).toEqual([
      'Profile',
      'Goal',
      'Nutrition entries',
      'Saved nutrition items',
      'Fluid entries',
      'Daily fluid target',
      'Exercises',
      'Planned days',
      'Completed workouts',
      'Workout in progress',
      'Weight check-ins',
    ]);
  });

  it('describes presence in words rather than by colour or a symbol', () => {
    const rows = describeRestorePreview(preview);

    expect(rows[0]).toEqual({ label: 'Profile', value: 'Included' });
    expect(rows[5]).toEqual({
      label: 'Daily fluid target',
      value: 'Not included',
    });
  });

  it('exposes no stored value beyond a count', () => {
    const values = describeRestorePreview(preview).map((row) => row.value);

    expect(values).toEqual([
      'Included',
      'Included',
      '120',
      '7',
      '30',
      'Not included',
      '9',
      '3',
      '4',
      'Not included',
      '12',
    ]);
  });
});

describe('formatExportCreatedAt', () => {
  it('describes when the export was created', () => {
    expect(formatExportCreatedAt('2026-08-11T09:15:04.123Z')).toContain(
      'Created',
    );
  });

  it('does not guess at an unreadable instant', () => {
    expect(formatExportCreatedAt('whenever')).toBe(
      'Created at an unknown time',
    );
  });
});
