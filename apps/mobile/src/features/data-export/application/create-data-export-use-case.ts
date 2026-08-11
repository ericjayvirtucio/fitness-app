import type {
  BodyWeightEntry,
  ConsumptionEntry,
  HydrationEntry,
  WorkoutSession,
} from '@fitness/domain';
import {
  exportPagePolicy,
  type ExportPage,
  type ExportPageQuery,
  type NameExportCursor,
  type OccurrenceExportCursor,
} from '../../../application/persistence/export-paging';
import type { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import type { NutritionCatalogItem } from '../../nutrition-logging/application/nutrition-catalog-item';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import type { DataExportCounts } from './data-export-contract';
import { DataExportError } from './data-export-error';
import type { DataExportFile, DataExportFileWriter } from './data-export-file';
import { DataExportSerializer } from './data-export-serializer';
import type { DataExportTransactionContext } from './data-export-transaction-context';

export type DataExportCancellation = Readonly<{ isCancelled: boolean }>;

export type DataExportResult = Readonly<{
  counts: DataExportCounts;
  file: DataExportFile;
}>;

export type ApplicationVersionReader = () => string | null;

const applicationName = 'Fitness App';

export class CreateDataExportUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<DataExportTransactionContext>,
    private readonly fileWriter: DataExportFileWriter,
    private readonly readApplicationVersion: ApplicationVersionReader,
    private readonly now: () => Date,
  ) {}

  async execute(
    cancellation: DataExportCancellation,
  ): Promise<DataExportResult> {
    await this.prepareDirectory();
    const generatedAt = this.now();
    const { counts, text } = await this.collect(generatedAt, cancellation);
    const file = await this.write(toFileName(generatedAt), text);

    if (cancellation.isCancelled) {
      await this.discard(file.uri);
      throw new DataExportError('cancelled');
    }

    return Object.freeze({ counts, file });
  }

  /**
   * Reads and serializes inside one exclusive transaction. Everything is
   * all-or-nothing: a capability is never silently omitted because its read
   * failed, and no file exists until the whole document is built.
   */
  private async collect(
    generatedAt: Date,
    cancellation: DataExportCancellation,
  ): Promise<Readonly<{ counts: DataExportCounts; text: string }>> {
    const serializer = new DataExportSerializer();
    try {
      return await this.transactionRunner.run(async (context) => {
        serializer.begin({
          applicationName,
          applicationVersion: this.readApplicationVersion(),
          generatedAt,
        });

        assertNotCancelled(cancellation);
        serializer.writeProfileSection(await context.profile.get());
        serializer.writeGoalsSection(await context.goals.get());

        serializer.openNutritionSection();
        await forEachPage<ConsumptionEntry, OccurrenceExportCursor>(
          (query) => context.nutrition.listEntriesPage(query),
          (entry) => serializer.writeNutritionEntry(entry),
          cancellation,
        );
        serializer.openNutritionCatalog();
        await forEachPage<NutritionCatalogItem, NameExportCursor>(
          (query) => context.nutrition.listCatalogItemsPage(query),
          (item) => serializer.writeNutritionCatalogItem(item),
          cancellation,
        );
        serializer.closeNutritionSection();

        serializer.openHydrationSection();
        await forEachPage<HydrationEntry, OccurrenceExportCursor>(
          (query) => context.hydrationEntries.listEntriesPage(query),
          (entry) => serializer.writeHydrationEntry(entry),
          cancellation,
        );
        serializer.closeHydrationSection(await context.hydrationTarget.get());

        serializer.openExerciseCatalogSection();
        await forEachPage<ExerciseCatalogItem, NameExportCursor>(
          (query) => context.exerciseCatalog.listExercisesPage(query),
          (item) => serializer.writeExercise(item),
          cancellation,
        );
        serializer.closeExerciseCatalogSection();

        assertNotCancelled(cancellation);
        serializer.openWorkoutPlannerSection();
        // A whole week is at most seven plans, so the planner needs no paging.
        for (const details of await context.planner.getWeeklyWorkouts()) {
          serializer.writePlannedWorkout(details.workout);
        }
        serializer.closeWorkoutPlannerSection();

        serializer.openWorkoutSessionsSection(
          await context.workoutSessions.getActive(),
        );
        await forEachPage<WorkoutSession, OccurrenceExportCursor>(
          (query) => context.workoutHistory.listCompletedSessionsPage(query),
          (session) => serializer.writeCompletedSession(session),
          cancellation,
          exportPagePolicy.nestedPageSize,
        );
        serializer.closeWorkoutSessionsSection();

        serializer.openBodyMeasurementsSection();
        await forEachPage<BodyWeightEntry, OccurrenceExportCursor>(
          (query) => context.bodyWeight.listCheckInsPage(query),
          (entry) => serializer.writeBodyWeightCheckIn(entry),
          cancellation,
        );
        serializer.closeBodyMeasurementsSection();

        return serializer.finish();
      });
    } catch (error: unknown) {
      throw toCollectionError(error);
    }
  }

  private async prepareDirectory(): Promise<void> {
    try {
      await this.fileWriter.prepareDirectory();
    } catch (error: unknown) {
      throw new DataExportError('file-write-failed', { cause: error });
    }
  }

  private async write(
    fileName: string,
    content: string,
  ): Promise<DataExportFile> {
    try {
      return await this.fileWriter.write(fileName, content);
    } catch (error: unknown) {
      throw new DataExportError('file-write-failed', { cause: error });
    }
  }

  /** Cleanup never turns a cancellation or failure into a different outcome. */
  private async discard(uri: string): Promise<void> {
    try {
      await this.fileWriter.remove(uri);
    } catch {
      // The next preparation removes whatever is left behind.
    }
  }
}

async function forEachPage<TItem, TCursor>(
  read: (
    query: ExportPageQuery<TCursor>,
  ) => Promise<ExportPage<TItem, TCursor>>,
  write: (item: TItem) => void,
  cancellation: DataExportCancellation,
  limit: number = exportPagePolicy.pageSize,
): Promise<void> {
  let cursor: TCursor | undefined;
  do {
    assertNotCancelled(cancellation);
    const query: ExportPageQuery<TCursor> =
      cursor === undefined ? { limit } : { cursor, limit };
    const page: ExportPage<TItem, TCursor> = await read(query);
    for (const item of page.items) write(item);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);
}

function assertNotCancelled(cancellation: DataExportCancellation): void {
  if (cancellation.isCancelled) throw new DataExportError('cancelled');
}

function toCollectionError(error: unknown): DataExportError {
  if (error instanceof DataExportError) return error;
  return error instanceof PersistenceError
    ? new DataExportError('read-failed', { cause: error })
    : new DataExportError('serialization-failed', { cause: error });
}

/**
 * Derived from the same instant as `generatedAt`, so the file name and the
 * document agree. It carries no personal information.
 */
export function toFileName(generatedAt: Date): string {
  const compact = generatedAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `fitness-app-export-${compact}.json`;
}
