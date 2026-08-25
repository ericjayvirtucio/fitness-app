import { isErr } from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { buildExerciseCatalogItem } from './build-exercise-catalog-item';
import type { ExerciseCatalogItem } from './exercise-catalog-item';
import { normalizeExerciseName } from './exercise-catalog-name';
import type { StarterExerciseImportContext } from './starter-exercise-import-context';
import { starterExercises, type StarterExercise } from './starter-exercises';

/**
 * Only what can actually happen. Storage being unavailable is not a third
 * refusal: the composition root has already opened the database by the time this
 * control exists, so a failure at press time is a failed write, and a failure
 * before that leaves the library in the error state it already had.
 */
export type StarterExerciseImportRefusal = 'content-invalid' | 'write-failed';

export type StarterExerciseImportOutcome =
  | Readonly<{ addedCount: number; skippedCount: number; status: 'imported' }>
  | Readonly<{ reason: StarterExerciseImportRefusal; status: 'refused' }>
  | Readonly<{ skippedCount: number; status: 'unchanged' }>;

/**
 * Writes the starter definitions the catalog does not already hold, in one
 * exclusive transaction, and only because the person asked.
 *
 * Nothing here is a second creation path. Every entry goes through
 * `buildExerciseCatalogItem` and therefore through `DomainId`,
 * `ExerciseDefinition`, and `ExerciseCatalogItem`, so the content obeys the same
 * validation and the same equipment/logging-mode compatibility rule a typed
 * definition does. What is written is an ordinary catalog row that no read model
 * can tell from one the person authored.
 *
 * `unchanged` is a distinct outcome from `imported` with a zero count, so the
 * interface cannot accidentally claim an addition that did not happen.
 */
export class AddStarterExercisesUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<StarterExerciseImportContext>,
    private readonly content: readonly StarterExercise[] = starterExercises,
  ) {}

  async execute(): Promise<StarterExerciseImportOutcome> {
    // Built before the transaction opens, so invalid content refuses without
    // ever having started a write that could be applied in part.
    const candidates = this.build();
    if (candidates === null)
      return { reason: 'content-invalid', status: 'refused' };

    try {
      return await this.transactionRunner.run(({ catalog }) =>
        importInto(catalog, candidates),
      );
    } catch {
      return { reason: 'write-failed', status: 'refused' };
    }
  }

  private build(): readonly ExerciseCatalogItem[] | null {
    const items: ExerciseCatalogItem[] = [];
    for (const entry of this.content) {
      const item = buildExerciseCatalogItem(entry.id, {
        equipment: entry.equipment,
        // Never favorited on arrival: a favorite is the person's statement
        // about their own training, not something content may assert.
        isFavorite: false,
        loggingMode: entry.loggingMode,
        name: entry.name,
        primaryMuscleGroup: entry.primaryMuscleGroup,
      });
      if (isErr(item)) return null;
      items.push(item.value);
    }
    return items;
  }
}

/**
 * Presence is read inside the transaction rather than trusted from whatever the
 * screen last loaded, for the same reason the restore write rechecks emptiness
 * inside its own transaction: a definition can be created between a read and a
 * press.
 */
async function importInto(
  catalog: StarterExerciseImportContext['catalog'],
  candidates: readonly ExerciseCatalogItem[],
): Promise<StarterExerciseImportOutcome> {
  const identifiers = candidates.map((item) => item.definition.id);
  const heldIdentifiers = new Set(
    (await catalog.getByIds(identifiers)).map(
      (item) => item.definition.id.value,
    ),
  );

  const additions: ExerciseCatalogItem[] = [];
  for (const item of candidates) {
    if (heldIdentifiers.has(item.definition.id.value)) continue;
    // A hand-authored definition sharing the name is left exactly as it is. The
    // catalog permits duplicate names deliberately, so adding anyway would hand
    // the person a second row they never asked for.
    const matches = await catalog.findByNormalizedName(
      normalizeExerciseName(item.definition.name),
    );
    if (matches.length > 0) continue;
    additions.push(item);
  }

  for (const item of additions) {
    // The identifier may still physically exist as a tombstoned row, because
    // Specification 0042 made deletion a tombstone rather than a hard delete.
    // Explicitly asking for this definition again is consent to bring that
    // row back, not to overwrite whatever the person had stored on it, so a
    // restore is tried first and only a genuinely absent identifier falls
    // through to an ordinary insert.
    if (await catalog.restore(item.definition.id)) continue;
    await catalog.insert(item);
  }

  const skippedCount = candidates.length - additions.length;
  return additions.length === 0
    ? { skippedCount, status: 'unchanged' }
    : { addedCount: additions.length, skippedCount, status: 'imported' };
}
