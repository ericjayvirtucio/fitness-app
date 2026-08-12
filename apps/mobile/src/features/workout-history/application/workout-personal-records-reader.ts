import type { DomainId } from '@fitness/domain';
import type { ExercisePersonalRecords } from './exercise-personal-records';

/**
 * Workout History's own projection for deterministic personal records.
 *
 * It is a separate contract rather than another `WorkoutHistoryRepository`
 * method because the two answer different questions: the repository pages
 * through history, while this reader returns one bounded record set per
 * exercise and is the only place per-set maxima are selected. The export reader
 * is split from the repository for the same reason.
 */
export interface WorkoutPersonalRecordsReader {
  readExercisePersonalRecords(
    exerciseDefinitionId: DomainId,
  ): Promise<ExercisePersonalRecords>;
}
