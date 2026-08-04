import {
  DomainError,
  ExerciseDefinition,
  err,
  ok,
  type Result,
} from '@fitness/domain';

export class ExerciseCatalogItem {
  private constructor(
    readonly definition: ExerciseDefinition,
    readonly isFavorite: boolean,
  ) {
    Object.freeze(this);
  }

  static create(
    input: Readonly<{ definition: unknown; isFavorite: unknown }>,
  ): Result<ExerciseCatalogItem, DomainError> {
    if (!(input.definition instanceof ExerciseDefinition)) {
      return err(
        DomainError.create(
          'required-field',
          'Exercise definition is required.',
          'definition',
        ),
      );
    }
    if (typeof input.isFavorite !== 'boolean') {
      return err(
        DomainError.create(
          'unsupported-option',
          'Favorite state is invalid.',
          'isFavorite',
        ),
      );
    }
    return ok(new ExerciseCatalogItem(input.definition, input.isFavorite));
  }
}
