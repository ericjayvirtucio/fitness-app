import { DomainError } from '../shared/domain-error';
import { Mass } from '../shared/measurement/mass';
import { Volume } from '../shared/measurement/volume';
import { err, isErr, ok, type Result } from '../shared/result';
import { Energy } from './energy';

export const nutritionProvenances = Object.freeze([
  'provided',
  'estimated',
] as const);

export type NutritionProvenance = (typeof nutritionProvenances)[number];

export type NutritionReference =
  | Readonly<{ amount: Mass; kind: 'mass' }>
  | Readonly<{ amount: Volume; kind: 'volume' }>;

export interface NutrientAmounts {
  readonly carbohydrateGrams: number | null;
  readonly fatGrams: number | null;
  readonly fiberGrams: number | null;
  readonly proteinGrams: number | null;
  readonly sodiumMilligrams: number | null;
  readonly sugarGrams: number | null;
}

export interface NutritionFactsInput {
  readonly description: unknown;
  readonly energy: unknown;
  readonly nutrients: unknown;
  readonly provenance: unknown;
  readonly reference: unknown;
}

const nutrientFields = Object.freeze([
  'carbohydrateGrams',
  'fatGrams',
  'fiberGrams',
  'proteinGrams',
  'sodiumMilligrams',
  'sugarGrams',
] as const satisfies readonly (keyof NutrientAmounts)[]);

export class NutritionFacts {
  private constructor(
    readonly description: string,
    readonly reference: NutritionReference,
    readonly energy: Energy,
    readonly nutrients: NutrientAmounts,
    readonly provenance: NutritionProvenance,
  ) {
    Object.freeze(this);
  }

  static create(
    input: NutritionFactsInput,
  ): Result<NutritionFacts, DomainError> {
    if (
      typeof input.description !== 'string' ||
      input.description.trim() === ''
    ) {
      return err(
        DomainError.create(
          'required-field',
          'Nutrition description is required.',
          'description',
        ),
      );
    }

    const referenceResult = validateReference(input.reference, 'reference');
    if (isErr(referenceResult)) {
      return referenceResult;
    }

    if (!(input.energy instanceof Energy)) {
      return err(
        DomainError.create(
          'required-field',
          'Nutrition energy is required.',
          'energy',
        ),
      );
    }

    const nutrientsResult = validateNutrients(input.nutrients);
    if (isErr(nutrientsResult)) {
      return nutrientsResult;
    }

    if (
      typeof input.provenance !== 'string' ||
      !nutritionProvenances.includes(input.provenance as NutritionProvenance)
    ) {
      return err(
        DomainError.create(
          'unsupported-option',
          'Choose a supported nutrition provenance.',
          'provenance',
        ),
      );
    }

    return ok(
      new NutritionFacts(
        input.description.trim(),
        referenceResult.value,
        input.energy,
        nutrientsResult.value,
        input.provenance as NutritionProvenance,
      ),
    );
  }
}

export function scaleNutritionFacts(
  facts: NutritionFacts,
  consumedQuantity: unknown,
): Result<NutritionFacts, DomainError> {
  const consumedResult = validateReference(
    consumedQuantity,
    'consumedQuantity',
  );
  if (isErr(consumedResult)) {
    return consumedResult;
  }

  if (facts.reference.kind !== consumedResult.value.kind) {
    return err(
      DomainError.create(
        'unsupported-option',
        'Consumed quantity must use the nutrition reference dimension.',
        'consumedQuantity',
      ),
    );
  }

  const factor =
    getCanonicalAmount(consumedResult.value) /
    getCanonicalAmount(facts.reference);
  const energyResult = Energy.create(
    facts.energy.kilojoules * factor,
    'kilojoule',
  );
  if (isErr(energyResult)) {
    return energyResult;
  }

  return NutritionFacts.create({
    description: facts.description,
    energy: energyResult.value,
    nutrients: scaleNutrients(facts.nutrients, factor),
    provenance: facts.provenance,
    reference: consumedResult.value,
  });
}

function validateReference(
  value: unknown,
  field: 'consumedQuantity' | 'reference',
): Result<NutritionReference, DomainError> {
  if (typeof value !== 'object' || value === null) {
    return invalidReference(field);
  }

  if (
    'kind' in value &&
    value.kind === 'mass' &&
    'amount' in value &&
    value.amount instanceof Mass
  ) {
    if (value.amount.grams <= 0) {
      return nonpositiveReference(field);
    }
    return ok(Object.freeze({ amount: value.amount, kind: 'mass' as const }));
  }

  if (
    'kind' in value &&
    value.kind === 'volume' &&
    'amount' in value &&
    value.amount instanceof Volume
  ) {
    if (value.amount.milliliters <= 0) {
      return nonpositiveReference(field);
    }
    return ok(Object.freeze({ amount: value.amount, kind: 'volume' as const }));
  }

  return invalidReference(field);
}

function validateNutrients(
  value: unknown,
): Result<NutrientAmounts, DomainError> {
  if (typeof value !== 'object' || value === null) {
    return err(
      DomainError.create(
        'required-field',
        'Nutrition nutrients are required.',
        'nutrients',
      ),
    );
  }

  const validated: Record<keyof NutrientAmounts, number | null> = {
    carbohydrateGrams: null,
    fatGrams: null,
    fiberGrams: null,
    proteinGrams: null,
    sodiumMilligrams: null,
    sugarGrams: null,
  };

  for (const field of nutrientFields) {
    if (!(field in value)) {
      return invalidNutrient(field);
    }
    const amount: unknown = Reflect.get(value, field);
    if (
      amount !== null &&
      (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)
    ) {
      return invalidNutrient(field);
    }
    validated[field] = amount;
  }

  return ok(Object.freeze(validated));
}

function scaleNutrients(
  nutrients: NutrientAmounts,
  factor: number,
): NutrientAmounts {
  return Object.freeze({
    carbohydrateGrams: scaleKnown(nutrients.carbohydrateGrams, factor),
    fatGrams: scaleKnown(nutrients.fatGrams, factor),
    fiberGrams: scaleKnown(nutrients.fiberGrams, factor),
    proteinGrams: scaleKnown(nutrients.proteinGrams, factor),
    sodiumMilligrams: scaleKnown(nutrients.sodiumMilligrams, factor),
    sugarGrams: scaleKnown(nutrients.sugarGrams, factor),
  });
}

function scaleKnown(value: number | null, factor: number): number | null {
  return value === null ? null : value * factor;
}

function getCanonicalAmount(reference: NutritionReference): number {
  return reference.kind === 'mass'
    ? reference.amount.grams
    : reference.amount.milliliters;
}

function invalidReference(
  field: 'consumedQuantity' | 'reference',
): Result<never, DomainError> {
  return err(
    DomainError.create(
      'unsupported-option',
      'Nutrition quantity must be a supported physical reference.',
      field,
    ),
  );
}

function nonpositiveReference(
  field: 'consumedQuantity' | 'reference',
): Result<never, DomainError> {
  return err(
    DomainError.create(
      'out-of-range',
      'Nutrition quantity must be greater than zero.',
      field,
    ),
  );
}

function invalidNutrient(
  field: keyof NutrientAmounts,
): Result<never, DomainError> {
  return err(
    DomainError.create(
      'invalid-number',
      'Nutrient must be a finite nonnegative number or unknown.',
      field,
    ),
  );
}
