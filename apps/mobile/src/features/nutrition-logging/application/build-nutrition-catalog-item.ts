import {
  DomainError,
  DomainId,
  Energy,
  Mass,
  NutritionFacts,
  Volume,
  err,
  isErr,
  type Result,
} from '@fitness/domain';
import { NutritionCatalogItem } from './nutrition-catalog-item';

export type SaveNutritionCatalogItemInput = Readonly<{
  carbohydrateGrams: unknown;
  description: unknown;
  energyKilocalories: unknown;
  fatGrams: unknown;
  fiberGrams: unknown;
  isFavorite: unknown;
  kind: unknown;
  proteinGrams: unknown;
  referenceAmount: unknown;
  sodiumMilligrams: unknown;
  sugarGrams: unknown;
}>;

export type SaveNutritionCatalogItemResult = Result<
  NutritionCatalogItem,
  readonly DomainError[]
>;

export function buildNutritionCatalogItem(
  idValue: unknown,
  input: SaveNutritionCatalogItemInput,
  existing?: NutritionCatalogItem,
): SaveNutritionCatalogItemResult {
  const id = DomainId.create(idValue);
  if (isErr(id)) return err([id.error]);
  const reference = createReference(input.kind, input.referenceAmount);
  if (isErr(reference)) return err([reference.error]);
  const energy = Energy.create(
    parseRequiredNumber(input.energyKilocalories),
    'kilocalorie',
  );
  if (isErr(energy)) {
    return err([withField(energy.error, 'energyKilocalories')]);
  }
  const facts = NutritionFacts.create({
    description: input.description,
    energy: energy.value,
    nutrients: {
      carbohydrateGrams: parseOptionalNumber(input.carbohydrateGrams),
      fatGrams: parseOptionalNumber(input.fatGrams),
      fiberGrams: parseOptionalNumber(input.fiberGrams),
      proteinGrams: parseOptionalNumber(input.proteinGrams),
      sodiumMilligrams: parseOptionalNumber(input.sodiumMilligrams),
      sugarGrams: parseOptionalNumber(input.sugarGrams),
    },
    provenance: existing?.facts.provenance ?? 'provided',
    reference: reference.value,
  });
  if (isErr(facts)) return err([facts.error]);

  const item = NutritionCatalogItem.create({
    facts: facts.value,
    id: id.value,
    isFavorite: input.isFavorite,
    kind: input.kind,
    lastUsedAtEpochMilliseconds:
      existing?.usage.lastUsedAtEpochMilliseconds ?? null,
    useCount: existing?.usage.useCount ?? 0,
  });
  return isErr(item) ? err([item.error]) : item;
}

function createReference(kind: unknown, input: unknown) {
  const value = parseRequiredNumber(input);
  if (kind === 'food') {
    const mass = Mass.create(value, 'gram');
    return isErr(mass)
      ? err(withField(mass.error, 'referenceAmount'))
      : ({
          isSuccess: true,
          value: Object.freeze({ amount: mass.value, kind: 'mass' as const }),
        } as const);
  }
  if (kind === 'beverage') {
    const volume = Volume.create(value, 'milliliter');
    return isErr(volume)
      ? err(withField(volume.error, 'referenceAmount'))
      : ({
          isSuccess: true,
          value: Object.freeze({
            amount: volume.value,
            kind: 'volume' as const,
          }),
        } as const);
  }
  return err(
    DomainError.create(
      'unsupported-option',
      'Choose food or beverage.',
      'kind',
    ),
  );
}

function parseRequiredNumber(value: unknown): number {
  return typeof value === 'string' && value.trim() !== ''
    ? Number(value.trim())
    : typeof value === 'number'
      ? value
      : Number.NaN;
}

function parseOptionalNumber(value: unknown): number | null {
  return typeof value === 'string' && value.trim() === ''
    ? null
    : value === null || value === undefined
      ? null
      : parseRequiredNumber(value);
}

function withField(error: DomainError, field: string): DomainError {
  return DomainError.create(error.code, error.message, field);
}
