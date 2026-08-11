import type {
  BodyWeightEntry,
  ConsumptionEntry,
  GoalConfiguration,
  HydrationEntry,
  HydrationTarget,
  PlannedWorkout,
  UserProfile,
  WorkoutSession,
} from '@fitness/domain';
import type { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import type { NutritionCatalogItem } from '../../nutrition-logging/application/nutrition-catalog-item';
import {
  dataExportFormat,
  dataExportFormatVersion,
  emptyDataExportCounts,
  type DataExportCounts,
} from './data-export-contract';
import {
  toExportedBodyWeightCheckIn,
  toExportedExercise,
  toExportedGoal,
  toExportedHydrationEntry,
  toExportedHydrationTarget,
  toExportedNutritionCatalogItem,
  toExportedNutritionEntry,
  toExportedPlannedWorkout,
  toExportedProfile,
  toExportedWorkoutSession,
} from './data-export-mapping';
import { JsonDocumentWriter } from './json-document-writer';

export type DataExportMetadata = Readonly<{
  applicationName: string;
  applicationVersion: string | null;
  generatedAt: Date;
}>;

/**
 * Writes the version 1 export document section by section.
 *
 * Sections and members are emitted in the contract's declared order, and each
 * record is converted to text as it arrives so lifetime history is never held
 * twice. Callers drive the order; the underlying writer rejects a malformed
 * document rather than emitting one.
 */
export class DataExportSerializer {
  private readonly writer = new JsonDocumentWriter();
  private counts: DataExportCounts = emptyDataExportCounts;

  begin(metadata: DataExportMetadata): void {
    this.writer.beginObject();
    this.writer.writeMember('format', dataExportFormat);
    this.writer.writeMember('formatVersion', dataExportFormatVersion);
    this.writer.writeMember('generatedAt', metadata.generatedAt.toISOString());
    this.writer.writeMember('application', {
      name: metadata.applicationName,
      version: metadata.applicationVersion,
    });
  }

  writeProfileSection(profile: UserProfile | null): void {
    this.writer.writeMember(
      'profile',
      profile === null ? null : toExportedProfile(profile),
    );
  }

  writeGoalsSection(goal: GoalConfiguration | null): void {
    this.writer.beginObjectMember('goalsAndEnergy');
    this.writer.writeMember(
      'goal',
      goal === null ? null : toExportedGoal(goal),
    );
    this.writer.end();
  }

  openNutritionSection(): void {
    this.writer.beginObjectMember('nutrition');
    this.writer.beginArrayMember('entries');
  }

  writeNutritionEntry(entry: ConsumptionEntry): void {
    this.writer.writeItem(toExportedNutritionEntry(entry));
    this.counts = {
      ...this.counts,
      nutritionEntries: this.counts.nutritionEntries + 1,
    };
  }

  openNutritionCatalog(): void {
    this.writer.end();
    this.writer.beginArrayMember('catalogItems');
  }

  writeNutritionCatalogItem(item: NutritionCatalogItem): void {
    this.writer.writeItem(toExportedNutritionCatalogItem(item));
    this.counts = {
      ...this.counts,
      nutritionCatalogItems: this.counts.nutritionCatalogItems + 1,
    };
  }

  closeNutritionSection(): void {
    this.writer.end();
    this.writer.end();
  }

  openHydrationSection(): void {
    this.writer.beginObjectMember('hydration');
    this.writer.beginArrayMember('entries');
  }

  writeHydrationEntry(entry: HydrationEntry): void {
    this.writer.writeItem(toExportedHydrationEntry(entry));
    this.counts = {
      ...this.counts,
      hydrationEntries: this.counts.hydrationEntries + 1,
    };
  }

  /**
   * The target is one mutable current value, so it is written outside the
   * entries array and named as current. No past day has a known target.
   */
  closeHydrationSection(target: HydrationTarget | null): void {
    this.writer.end();
    this.writer.writeMember(
      'currentTarget',
      target === null ? null : toExportedHydrationTarget(target),
    );
    this.writer.end();
  }

  openExerciseCatalogSection(): void {
    this.writer.beginObjectMember('exerciseCatalog');
    this.writer.beginArrayMember('exercises');
  }

  writeExercise(item: ExerciseCatalogItem): void {
    this.writer.writeItem(toExportedExercise(item));
    this.counts = { ...this.counts, exercises: this.counts.exercises + 1 };
  }

  closeExerciseCatalogSection(): void {
    this.writer.end();
    this.writer.end();
  }

  openWorkoutPlannerSection(): void {
    this.writer.beginObjectMember('workoutPlanner');
    this.writer.beginArrayMember('plannedWorkouts');
  }

  writePlannedWorkout(workout: PlannedWorkout): void {
    this.writer.writeItem(toExportedPlannedWorkout(workout));
    this.counts = {
      ...this.counts,
      plannedWorkouts: this.counts.plannedWorkouts + 1,
    };
  }

  closeWorkoutPlannerSection(): void {
    this.writer.end();
    this.writer.end();
  }

  /**
   * An active session is written on its own and is never counted or listed as
   * a completed workout.
   */
  openWorkoutSessionsSection(active: WorkoutSession | null): void {
    this.writer.beginObjectMember('workoutSessions');
    this.writer.writeMember(
      'activeSession',
      active === null ? null : toExportedWorkoutSession(active),
    );
    this.writer.beginArrayMember('completedSessions');
  }

  writeCompletedSession(session: WorkoutSession): void {
    this.writer.writeItem(toExportedWorkoutSession(session));
    this.counts = {
      ...this.counts,
      completedWorkouts: this.counts.completedWorkouts + 1,
    };
  }

  closeWorkoutSessionsSection(): void {
    this.writer.end();
    this.writer.end();
  }

  openBodyMeasurementsSection(): void {
    this.writer.beginObjectMember('bodyMeasurements');
    this.writer.beginArrayMember('weightCheckIns');
  }

  writeBodyWeightCheckIn(entry: BodyWeightEntry): void {
    this.writer.writeItem(toExportedBodyWeightCheckIn(entry));
    this.counts = {
      ...this.counts,
      bodyWeightCheckIns: this.counts.bodyWeightCheckIns + 1,
    };
  }

  closeBodyMeasurementsSection(): void {
    this.writer.end();
    this.writer.end();
  }

  finish(): Readonly<{ counts: DataExportCounts; text: string }> {
    this.writer.end();
    return Object.freeze({
      counts: this.counts,
      text: this.writer.toText(),
    });
  }
}
