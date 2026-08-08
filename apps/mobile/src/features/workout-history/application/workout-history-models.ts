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

export type ExercisePerformanceItem = Readonly<{
  actualSetCount: number;
  exerciseNameSnapshot: string;
  loggingModeSnapshot: WorkoutSession['exercises'][number]['loggingModeSnapshot'];
  sessionId: DomainId;
  sessionNameSnapshot: string;
  startedAtEpochMilliseconds: number;
  startedLocalCalendarDate: string;
}>;

export type ExercisePerformancePage = Readonly<{
  items: readonly ExercisePerformanceItem[];
  nextCursor: WorkoutHistoryCursor | null;
}>;
