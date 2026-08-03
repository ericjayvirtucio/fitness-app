import {
  DomainError,
  DomainId,
  NutritionFacts,
  err,
  ok,
  type ConsumptionEntryKind,
  type Result,
} from '@fitness/domain';

export type NutritionCatalogUsage = Readonly<{
  lastUsedAtEpochMilliseconds: number | null;
  useCount: number;
}>;

export type NutritionCatalogItemInput = Readonly<{
  facts: unknown;
  id: unknown;
  isFavorite: unknown;
  kind: unknown;
  lastUsedAtEpochMilliseconds: unknown;
  useCount: unknown;
}>;

export class NutritionCatalogItem {
  private constructor(
    readonly id: DomainId,
    readonly kind: ConsumptionEntryKind,
    readonly facts: NutritionFacts,
    readonly isFavorite: boolean,
    readonly usage: NutritionCatalogUsage,
  ) {
    Object.freeze(this);
  }

  static create(
    input: NutritionCatalogItemInput,
  ): Result<NutritionCatalogItem, DomainError> {
    if (!(input.id instanceof DomainId)) {
      return err(
        DomainError.create(
          'invalid-identifier',
          'Saved nutrition item identifier is invalid.',
          'id',
        ),
      );
    }
    if (input.kind !== 'food' && input.kind !== 'beverage') {
      return err(
        DomainError.create(
          'unsupported-option',
          'Choose food or beverage.',
          'kind',
        ),
      );
    }
    if (!(input.facts instanceof NutritionFacts)) {
      return err(
        DomainError.create(
          'required-field',
          'Nutrition facts are required.',
          'facts',
        ),
      );
    }
    if (
      (input.kind === 'food' && input.facts.reference.kind !== 'mass') ||
      (input.kind === 'beverage' && input.facts.reference.kind !== 'volume')
    ) {
      return err(
        DomainError.create(
          'unsupported-option',
          'Food uses grams and beverage uses milliliters.',
          'kind',
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
    if (
      typeof input.useCount !== 'number' ||
      !Number.isSafeInteger(input.useCount) ||
      input.useCount < 0
    ) {
      return invalidUsage();
    }
    const lastUsed = input.lastUsedAtEpochMilliseconds;
    if (
      lastUsed !== null &&
      (typeof lastUsed !== 'number' ||
        !Number.isSafeInteger(lastUsed) ||
        lastUsed < 0)
    ) {
      return invalidUsage();
    }
    if (
      (input.useCount === 0 && lastUsed !== null) ||
      (input.useCount > 0 && lastUsed === null)
    ) {
      return invalidUsage();
    }

    return ok(
      new NutritionCatalogItem(
        input.id,
        input.kind,
        input.facts,
        input.isFavorite,
        Object.freeze({
          lastUsedAtEpochMilliseconds: lastUsed,
          useCount: input.useCount,
        }),
      ),
    );
  }
}

function invalidUsage(): Result<never, DomainError> {
  return err(
    DomainError.create(
      'invalid-number',
      'Saved nutrition item usage is invalid.',
      'usage',
    ),
  );
}
