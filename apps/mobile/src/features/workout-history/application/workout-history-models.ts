import type { DomainId, WorkoutSession } from '@fitness/domain';

export const workoutHistoryPagePolicy = Object.freeze({
  defaultLimit: 20,
  maximumLimit: 50,
});

export type WorkoutHistoryCursor = Readonly<{
  id: string;
  startedAtEpochMilliseconds: number;
  startedLocalCalendarDate: string;
}>;

export type WorkoutHistoryListItem = Readonly<{
  actualSetCount: number;
  completedAtEpochMilliseconds: number;
  elapsedSeconds: number;
  exerciseCount: number;
  nameSnapshot: string;
  performedExerciseCount: number;
  sessionId: DomainId;
  startedAtEpochMilliseconds: number;
  startedLocalCalendarDate: string;
  startedUtcOffsetMinutes: number;
}>;

export type WorkoutHistoryPage = Readonly<{
  items: readonly WorkoutHistoryListItem[];
  nextCursor: WorkoutHistoryCursor | null;
}>;

export type WorkoutHistoryPageQuery = Readonly<{
  cursor?: WorkoutHistoryCursor;
  limit?: number;
}>;

export type WorkoutHistoryRange = Readonly<{
  endLocalCalendarDate: string;
  startLocalCalendarDate: string;
}>;

/**
 * A completed-workout page request, optionally bounded to a captured local date
 * range.
 *
 * This is deliberately not `WorkoutHistoryPageQuery` with one more field.
 * That type is shared with the exercise performance reader, which has no period
 * control and therefore honours no range, and a shared optional field would
 * declare a capability one of its two readers silently ignores. The completed
 * list owns the range because the completed list is the only reader that
 * applies it.
 *
 * The range bounds membership by `startedLocalCalendarDate`, the same date the
 * range summary groups by, so a workout crossing midnight belongs to the period
 * it started in and is counted and listed by the same one.
 */
export type CompletedWorkoutPageQuery = WorkoutHistoryPageQuery &
  Readonly<{ range?: WorkoutHistoryRange }>;

export type WorkoutProgressSummary = Readonly<{
  actualSetCount: number;
  completedWorkoutCount: number;
  distanceMillimeters: number | null;
  durationSeconds: number | null;
  elapsedWorkoutSeconds: number;
  performedExerciseCount: number;
  recordedLoadVolumeGramRepetitions: number | null;
  repetitions: number | null;
}>;

export type WorkoutProgressDay = Readonly<{
  actualSetCount: number;
  completedWorkoutCount: number;
  localCalendarDate: string;
  performedExerciseCount: number;
}>;

export type ExercisePerformanceItem = Readonly<{
  actualSetCount: number;
  distanceMillimeters: number | null;
  durationSeconds: number | null;
  exerciseNameSnapshot: string;
  loggingModeSnapshot: WorkoutSession['exercises'][number]['loggingModeSnapshot'];
  maximumResistanceGrams: number | null;
  recordedLoadVolumeGramRepetitions: number | null;
  repetitions: number | null;
  sessionId: DomainId;
  sessionNameSnapshot: string;
  startedAtEpochMilliseconds: number;
  startedLocalCalendarDate: string;
}>;

/**
 * A performed exercise as completed history knows it.
 *
 * The name is the snapshot captured at the most recent completed occurrence
 * rather than a current Catalog name, so a renamed definition keeps its
 * historical label and a deleted one stays reachable.
 */
export type PerformedExerciseSummary = Readonly<{
  exerciseNameSnapshot: string;
  latestStartedLocalCalendarDate: string;
  sourceExerciseDefinitionId: DomainId;
}>;

export type ExercisePerformancePage = Readonly<{
  items: readonly ExercisePerformanceItem[];
  nextCursor: WorkoutHistoryCursor | null;
}>;
