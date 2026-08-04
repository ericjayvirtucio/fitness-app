import {
  DomainId,
  ExerciseDefinition,
  isErr,
  type DomainError,
  type Result,
} from '@fitness/domain';
import { ExerciseCatalogItem } from './exercise-catalog-item';

export type SaveExerciseInput = Readonly<{
  equipment: unknown;
  isFavorite: unknown;
  loggingMode: unknown;
  name: unknown;
  notes?: unknown;
  primaryMuscleGroup: unknown;
}>;

export function buildExerciseCatalogItem(
  idValue: unknown,
  input: SaveExerciseInput,
  existing?: ExerciseCatalogItem,
): Result<ExerciseCatalogItem, DomainError> {
  const id = DomainId.create(idValue);
  if (isErr(id)) return id;
  const definition = ExerciseDefinition.create({ ...input, id: id.value });
  if (isErr(definition)) return definition;
  return ExerciseCatalogItem.create({
    definition: definition.value,
    isFavorite: existing?.isFavorite ?? input.isFavorite,
  });
}
