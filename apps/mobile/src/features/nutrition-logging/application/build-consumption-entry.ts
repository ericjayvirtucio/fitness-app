import {
  ConsumptionEntry,
  DomainError,
  DomainId,
  Energy,
  Mass,
  NutritionFacts,
  Volume,
  err,
  isErr,
  type NutritionReference,
  type Result,
} from '@fitness/domain';

export type SaveConsumptionEntryInput = Readonly<{
  carbohydrateGrams: unknown;
  consumedAmount: unknown;
  description: unknown;
  energyKilocalories: unknown;
  fatGrams: unknown;
  fiberGrams: unknown;
  kind: unknown;
  localCalendarDate: unknown;
  occurredAtEpochMilliseconds: unknown;
  proteinGrams: unknown;
  quantityKind: unknown;
  referenceAmount: unknown;
  sodiumMilligrams: unknown;
  sugarGrams: unknown;
  utcOffsetMinutes: unknown;
}>;

export type SaveConsumptionEntryResult = Result<
  ConsumptionEntry,
  readonly DomainError[]
>;

export function buildConsumptionEntry(
  idValue: unknown,
  input: SaveConsumptionEntryInput,
  latestAllowedEpochMilliseconds: number,
): SaveConsumptionEntryResult {
  const id = DomainId.create(idValue);
  if (isErr(id)) return err([id.error]);

  const reference = createReference(input.quantityKind, input.referenceAmount);
  if (isErr(reference)) return err([reference.error]);
  const consumedQuantity = createReference(
    input.quantityKind,
    input.consumedAmount,
  );
  if (isErr(consumedQuantity)) return err([consumedQuantity.error]);

  const energy = Energy.create(
    parseRequiredNumber(input.energyKilocalories),
    'kilocalorie',
  );
  if (isErr(energy))
    return err([withField(energy.error, 'energyKilocalories')]);

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
    provenance: 'provided',
    reference: reference.value,
  });
  if (isErr(facts)) return err([facts.error]);

  if (
    typeof input.occurredAtEpochMilliseconds === 'number' &&
    input.occurredAtEpochMilliseconds > latestAllowedEpochMilliseconds
  ) {
    return err([
      DomainError.create(
        'invalid-date',
        'Consumption time cannot be in the future.',
        'occurredAtEpochMilliseconds',
      ),
    ]);
  }

  const entry = ConsumptionEntry.create({
    consumedQuantity: consumedQuantity.value,
    facts: facts.value,
    id: id.value,
    kind: input.kind,
    localCalendarDate: input.localCalendarDate,
    occurredAtEpochMilliseconds: input.occurredAtEpochMilliseconds,
    utcOffsetMinutes: input.utcOffsetMinutes,
  });
  return isErr(entry) ? err([entry.error]) : entry;
}

function createReference(
  kind: unknown,
  amountInput: unknown,
): Result<NutritionReference, DomainError> {
  const amount = parseRequiredNumber(amountInput);
  if (kind === 'mass') {
    const mass = Mass.create(amount, 'gram');
    return isErr(mass)
      ? err(withField(mass.error, 'quantity'))
      : { isSuccess: true, value: Object.freeze({ amount: mass.value, kind }) };
  }
  if (kind === 'volume') {
    const volume = Volume.create(amount, 'milliliter');
    return isErr(volume)
      ? err(withField(volume.error, 'quantity'))
      : {
          isSuccess: true,
          value: Object.freeze({ amount: volume.value, kind }),
        };
  }
  return err(
    DomainError.create(
      'unsupported-option',
      'Choose grams or milliliters.',
      'quantityKind',
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
