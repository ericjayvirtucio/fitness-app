import type { DataExportCounts } from '../application/data-export-contract';

const kilobyte = 1_024;
const megabyte = kilobyte * kilobyte;

export function formatExportSize(byteSize: number): string {
  if (!Number.isFinite(byteSize) || byteSize < 0) return 'Unknown size';
  if (byteSize < kilobyte) {
    return `${String(byteSize)} ${byteSize === 1 ? 'byte' : 'bytes'}`;
  }
  const isMegabytes = byteSize >= megabyte;
  const value = byteSize / (isMegabytes ? megabyte : kilobyte);
  return `${value.toFixed(1)} ${isMegabytes ? 'MB' : 'KB'}`;
}

export type ExportCountRow = Readonly<{ label: string; value: number }>;

/** Fixed order so the summary reads the same way after every export. */
export function describeExportCounts(
  counts: DataExportCounts,
): readonly ExportCountRow[] {
  return [
    { label: 'Nutrition entries', value: counts.nutritionEntries },
    { label: 'Saved nutrition items', value: counts.nutritionCatalogItems },
    { label: 'Fluid entries', value: counts.hydrationEntries },
    { label: 'Exercises', value: counts.exercises },
    { label: 'Planned days', value: counts.plannedWorkouts },
    { label: 'Completed workouts', value: counts.completedWorkouts },
    { label: 'Weight check-ins', value: counts.bodyWeightCheckIns },
  ];
}
