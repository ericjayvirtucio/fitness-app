import { DomainId, ExerciseDefinition, isErr } from '@fitness/domain';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import { normalizeExerciseName } from '../application/exercise-catalog-name';

export type ExerciseRow = Readonly<{
  display_name: string;
  equipment: string;
  id: string;
  is_favorite: number;
  logging_mode: string;
  normalized_name: string;
  notes: string | null;
  primary_muscle_group: string;
}>;

export const exerciseColumns =
  'id, display_name, normalized_name, equipment, primary_muscle_group, logging_mode, notes, is_favorite';

export function mapExerciseRow(row: ExerciseRow): ExerciseCatalogItem {
  const id = DomainId.create(row.id);
  if (
    isErr(id) ||
    normalizeExerciseName(row.display_name) !== row.normalized_name
  )
    throw new PersistenceError('operation-failed');
  const definition = ExerciseDefinition.create({
    equipment: row.equipment,
    id: id.value,
    loggingMode: row.logging_mode,
    name: row.display_name,
    notes: row.notes,
    primaryMuscleGroup: row.primary_muscle_group,
  });
  const item = definition.isSuccess
    ? ExerciseCatalogItem.create({
        definition: definition.value,
        isFavorite: row.is_favorite === 1,
      })
    : definition;
  if (isErr(item) || (row.is_favorite !== 0 && row.is_favorite !== 1))
    throw new PersistenceError('operation-failed');
  return item.value;
}
