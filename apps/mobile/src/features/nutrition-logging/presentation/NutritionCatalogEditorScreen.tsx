import type { ConsumptionEntry, DomainError } from '@fitness/domain';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { createNutritionLoggingUseCases } from '../../../composition/nutrition-logging';
import {
  AppButton,
  AppText,
  LoadingIndicator,
  Screen,
  spacing,
} from '../../../design-system';
import type { NutritionCatalogItem } from '../application/nutrition-catalog-item';
import type { CatalogSaveOutcome } from '../application/nutrition-catalog-use-cases';
import {
  NutritionCatalogForm,
  toCatalogSaveInput,
  type NutritionCatalogFormValues,
} from './NutritionCatalogForm';

type UseCases = Awaited<ReturnType<typeof createNutritionLoggingUseCases>>;

type Props = Readonly<{
  catalogItemId?: string;
  consumptionEntryId?: string;
  loadUseCases?: () => Promise<UseCases>;
  onDone: () => void;
}>;

export function NutritionCatalogEditorScreen({
  catalogItemId,
  consumptionEntryId,
  loadUseCases = createNutritionLoggingUseCases,
  onDone,
}: Props) {
  const [useCases, setUseCases] = useState<UseCases>();
  const [initialValues, setInitialValues] =
    useState<NutritionCatalogFormValues>();
  const [isMissing, setIsMissing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    void loadUseCases()
      .then(async (loaded) => {
        setUseCases(loaded);
        const source = catalogItemId
          ? await loaded.getCatalogItem.execute(catalogItemId)
          : consumptionEntryId
            ? await loaded.getEntry.execute(consumptionEntryId)
            : null;
        if ((catalogItemId || consumptionEntryId) && source === null) {
          setIsMissing(true);
          return;
        }
        setInitialValues(
          source instanceof Object && 'consumedQuantity' in source
            ? valuesFromEntry(source)
            : source
              ? valuesFromItem(source)
              : emptyValues(),
        );
      })
      .catch(() => setErrors({ form: 'Saved item could not be loaded.' }));
  }, [catalogItemId, consumptionEntryId, loadUseCases]);

  if (!useCases || !initialValues) {
    if (isMissing || errors.form) {
      return (
        <Screen
          accessibilityLabel="Saved nutrition item unavailable"
          isCentered
        >
          <AppText accessibilityRole="header" variant="heading">
            Saved item unavailable
          </AppText>
          <AppText color="secondary" style={{ marginVertical: spacing.md }}>
            {errors.form ?? 'The item no longer exists.'}
          </AppText>
          <AppButton label="Back" onPress={onDone} />
        </Screen>
      );
    }
    return (
      <Screen accessibilityLabel="Loading saved nutrition item" isCentered>
        <LoadingIndicator label="Loading saved nutrition item" />
      </Screen>
    );
  }

  const save = async (
    values: NutritionCatalogFormValues,
    allowDuplicate = false,
  ) => {
    setErrors({});
    setIsSaving(true);
    try {
      const outcome = catalogItemId
        ? await useCases.updateCatalogItem.execute(
            catalogItemId,
            toCatalogSaveInput(values),
            allowDuplicate,
          )
        : await useCases.createCatalogItem.execute(
            toCatalogSaveInput(values),
            allowDuplicate,
          );
      handleOutcome(outcome, values, save, onDone, setErrors);
    } catch {
      setErrors({
        form: 'Saved item could not be saved. Nothing was changed.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = () => {
    if (!catalogItemId) return;
    Alert.alert(
      'Delete saved item?',
      'Existing diary entries will remain unchanged. This cannot be undone.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void useCases.deleteCatalogItem
              .execute(catalogItemId)
              .then((deleted) =>
                deleted
                  ? onDone()
                  : setErrors({ form: 'Saved item no longer exists.' }),
              )
              .catch(() =>
                setErrors({ form: 'Saved item could not be deleted.' }),
              );
          },
          style: 'destructive',
          text: 'Delete saved item',
        },
      ],
    );
  };

  return (
    <NutritionCatalogForm
      errors={errors}
      initialValues={initialValues}
      isEditing={Boolean(catalogItemId)}
      isSaving={isSaving}
      onCancel={onDone}
      {...(catalogItemId ? { onDelete: requestDelete } : {})}
      onSave={(values) => void save(values)}
    />
  );
}

function handleOutcome(
  outcome: CatalogSaveOutcome,
  values: NutritionCatalogFormValues,
  save: (
    values: NutritionCatalogFormValues,
    allowDuplicate?: boolean,
  ) => Promise<void>,
  onDone: () => void,
  setErrors: (errors: Readonly<Record<string, string>>) => void,
) {
  if (outcome.status === 'saved') {
    onDone();
  } else if (outcome.status === 'invalid') {
    setErrors(toErrorRecord(outcome.errors));
  } else {
    Alert.alert(
      'Similar saved name',
      `${outcome.matches.length} saved item${outcome.matches.length === 1 ? '' : 's'} already use this name. Keep both?`,
      [
        { style: 'cancel', text: 'Review' },
        { onPress: () => void save(values, true), text: 'Keep both' },
      ],
    );
  }
}

function valuesFromItem(
  item: NutritionCatalogItem,
): NutritionCatalogFormValues {
  return valuesFromFacts(item, item.isFavorite);
}

function valuesFromEntry(entry: ConsumptionEntry): NutritionCatalogFormValues {
  return valuesFromFacts({ facts: entry.facts, kind: entry.kind }, false);
}

function valuesFromFacts(
  source: Pick<NutritionCatalogItem, 'facts' | 'kind'>,
  isFavorite: boolean,
): NutritionCatalogFormValues {
  const nutrients = source.facts.nutrients;
  return {
    carbohydrateGrams: optionalString(nutrients.carbohydrateGrams),
    description: source.facts.description,
    energyKilocalories: String(source.facts.energy.in('kilocalorie')),
    fatGrams: optionalString(nutrients.fatGrams),
    fiberGrams: optionalString(nutrients.fiberGrams),
    isFavorite,
    kind: source.kind,
    proteinGrams: optionalString(nutrients.proteinGrams),
    referenceAmount: String(
      source.facts.reference.kind === 'mass'
        ? source.facts.reference.amount.grams
        : source.facts.reference.amount.milliliters,
    ),
    sodiumMilligrams: optionalString(nutrients.sodiumMilligrams),
    sugarGrams: optionalString(nutrients.sugarGrams),
  };
}

function emptyValues(): NutritionCatalogFormValues {
  return {
    carbohydrateGrams: '',
    description: '',
    energyKilocalories: '',
    fatGrams: '',
    fiberGrams: '',
    isFavorite: false,
    kind: 'food',
    proteinGrams: '',
    referenceAmount: '',
    sodiumMilligrams: '',
    sugarGrams: '',
  };
}

function optionalString(value: number | null): string {
  return value === null ? '' : String(value);
}

function toErrorRecord(errors: readonly DomainError[]) {
  return Object.fromEntries(
    errors.map((error) => [error.field ?? 'form', error.message]),
  );
}
