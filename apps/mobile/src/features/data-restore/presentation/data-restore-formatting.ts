import type { DataRestorePreview } from '../application/restore-data';

export type RestorePreviewRow = Readonly<{ label: string; value: string }>;

/**
 * Counts and presence only, in a fixed order.
 *
 * The preview exists so the user can recognise their own export before writing
 * it. A weight, a meal name, or a date would answer nothing that "12 weight
 * check-ins" does not, so none of them appear here.
 */
export function describeRestorePreview(
  preview: DataRestorePreview,
): readonly RestorePreviewRow[] {
  return [
    { label: 'Profile', value: presence(preview.hasProfile) },
    { label: 'Goal', value: presence(preview.hasGoal) },
    { label: 'Nutrition entries', value: String(preview.nutritionEntries) },
    {
      label: 'Saved nutrition items',
      value: String(preview.nutritionCatalogItems),
    },
    { label: 'Fluid entries', value: String(preview.hydrationEntries) },
    {
      label: 'Daily fluid target',
      value: presence(preview.hasHydrationTarget),
    },
    { label: 'Exercises', value: String(preview.exercises) },
    { label: 'Planned days', value: String(preview.plannedWorkouts) },
    { label: 'Completed workouts', value: String(preview.completedWorkouts) },
    { label: 'Workout in progress', value: presence(preview.hasActiveWorkout) },
    { label: 'Weight check-ins', value: String(preview.bodyWeightCheckIns) },
  ];
}

/**
 * The export's own creation instant, shown so the user can tell two saved files
 * apart. An unparseable value is described rather than guessed at.
 */
export function formatExportCreatedAt(generatedAt: string): string {
  const createdAt = new Date(generatedAt);
  if (Number.isNaN(createdAt.getTime())) return 'Created at an unknown time';
  return `Created ${createdAt.toLocaleString()}`;
}

function presence(isPresent: boolean): string {
  return isPresent ? 'Included' : 'Not included';
}
