import { plannedWorkoutPolicy, workoutSessionPolicy } from '@fitness/domain';
import { dataExportFormatVersion } from '../../data-export/application/data-export-contract';

/**
 * Technical ceilings that bound the work a selected file can cause. They are
 * resource protection, not fitness advice, and they sit far above realistic
 * use: nothing here tells a person how much they may record.
 *
 * The file ceiling matches the whole-document buffering limit already
 * documented for export, so a file this application produced always fits.
 * Per-workout and per-session limits are the domain's own policies rather than
 * new numbers, so a record the application can create can always be restored.
 */
export const dataRestorePolicy = Object.freeze({
  /**
   * The newest format version this build writes and reads. Version 1 is also
   * accepted — see the dispatch in `parse-data-export.ts` — so this is
   * deliberately not named "supported": both versions are supported, and only
   * one of them is current.
   */
  currentFormatVersion: dataExportFormatVersion,
  maximumBodyWeightCheckIns: 200_000,
  maximumCompletedSessions: 50_000,
  maximumExercises: 20_000,
  maximumExercisesPerPlannedWorkout: plannedWorkoutPolicy.maximumExercises,
  maximumExercisesPerSession: workoutSessionPolicy.maximumExercises,
  maximumFileBytes: 25 * 1024 * 1024,
  maximumHydrationEntries: 200_000,
  maximumNutritionCatalogItems: 20_000,
  maximumNutritionEntries: 200_000,
  maximumPlannedWorkouts: 7,
  maximumSetsPerSessionExercise: workoutSessionPolicy.maximumSetsPerExercise,
  maximumStringLength: 4096,
});
