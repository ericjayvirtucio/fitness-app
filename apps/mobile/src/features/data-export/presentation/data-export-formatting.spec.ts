import { emptyDataExportCounts } from '../application/data-export-contract';
import {
  describeExportCounts,
  formatExportSize,
} from './data-export-formatting';

describe('formatExportSize', () => {
  it('describes small files in bytes', () => {
    expect(formatExportSize(1)).toBe('1 byte');
    expect(formatExportSize(512)).toBe('512 bytes');
  });

  it('describes larger files in kilobytes and megabytes', () => {
    expect(formatExportSize(2_048)).toBe('2.0 KB');
    expect(formatExportSize(1_572_864)).toBe('1.5 MB');
  });

  it('does not invent a size it cannot describe', () => {
    expect(formatExportSize(Number.NaN)).toBe('Unknown size');
    expect(formatExportSize(-1)).toBe('Unknown size');
  });
});

describe('describeExportCounts', () => {
  it('describes every exported record group in a fixed order', () => {
    expect(
      describeExportCounts(emptyDataExportCounts).map((row) => row.label),
    ).toEqual([
      'Nutrition entries',
      'Saved nutrition items',
      'Fluid entries',
      'Exercises',
      'Planned days',
      'Completed workouts',
      'Weight check-ins',
    ]);
  });

  it('reports zero rather than omitting an empty group', () => {
    expect(
      describeExportCounts({
        ...emptyDataExportCounts,
        nutritionEntries: 3,
      }),
    ).toContainEqual({ label: 'Fluid entries', value: 0 });
  });
});
