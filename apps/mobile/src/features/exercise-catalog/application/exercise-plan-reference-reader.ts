import type { DomainId, Weekday } from '@fitness/domain';

export type PlannedExerciseUsage = Readonly<{
  weekday: Weekday;
  workoutName: string;
}>;

export interface ExercisePlanReferenceReader {
  listUsages(
    exerciseDefinitionId: DomainId,
  ): Promise<readonly PlannedExerciseUsage[]>;
}
