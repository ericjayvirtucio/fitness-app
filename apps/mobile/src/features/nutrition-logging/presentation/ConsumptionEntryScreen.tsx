import type { ConsumptionEntry, DomainError } from '@fitness/domain';
import { Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { createNutritionLoggingUseCases } from '../../../composition/nutrition-logging';
import {
  AppButton,
  AppText,
  LoadingIndicator,
  Screen,
  spacing,
} from '../../../design-system';
import type {
  SaveConsumptionEntryInput,
  SaveConsumptionEntryResult,
} from '../application/build-consumption-entry';
import {
  ConsumptionEntryForm,
  toSaveInput,
  type ConsumptionEntryFormValues,
} from './ConsumptionEntryForm';

type UseCases = Readonly<{
  createEntry: Readonly<{
    execute: (
      input: SaveConsumptionEntryInput,
    ) => Promise<SaveConsumptionEntryResult>;
  }>;
  deleteEntry: Readonly<{ execute: (id: unknown) => Promise<boolean> }>;
  getEntry: Readonly<{
    execute: (id: unknown) => Promise<ConsumptionEntry | null>;
  }>;
  updateEntry: Readonly<{
    execute: (
      id: unknown,
      input: SaveConsumptionEntryInput,
    ) => Promise<SaveConsumptionEntryResult>;
  }>;
}>;

type Props = Readonly<{
  entryId?: string;
  loadUseCases?: () => Promise<UseCases>;
  onDone: () => void;
}>;

export function ConsumptionEntryScreen({
  entryId,
  loadUseCases = createNutritionLoggingUseCases,
  onDone,
}: Props) {
  const [useCases, setUseCases] = useState<UseCases>();
  const [entry, setEntry] = useState<ConsumptionEntry | null>();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    void loadUseCases()
      .then(async (loaded) => {
        setUseCases(loaded);
        setEntry(entryId ? await loaded.getEntry.execute(entryId) : null);
      })
      .catch(() =>
        setErrors({ form: 'Entry could not be loaded. Try again.' }),
      );
  }, [entryId, loadUseCases]);

  if (!useCases || entry === undefined) {
    if (errors.form) {
      return (
        <Screen accessibilityLabel="Nutrition entry error" isCentered>
          <AppText accessibilityRole="header" variant="heading">
            Entry unavailable
          </AppText>
          <AppText color="secondary" style={{ marginVertical: spacing.md }}>
            {errors.form}
          </AppText>
          <AppButton label="Back to nutrition" onPress={onDone} />
        </Screen>
      );
    }
    return (
      <Screen accessibilityLabel="Loading nutrition entry" isCentered>
        <LoadingIndicator label="Loading nutrition entry" />
      </Screen>
    );
  }

  if (entryId && entry === null) {
    return (
      <Screen accessibilityLabel="Nutrition entry not found" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Entry not found
        </AppText>
        <AppButton label="Back to nutrition" onPress={onDone} />
      </Screen>
    );
  }

  const save = async (values: ConsumptionEntryFormValues) => {
    const input = toSaveInput(values);
    if (!input) {
      setErrors({
        occurredAtEpochMilliseconds: 'Enter a valid local date and time.',
      });
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      const result = entryId
        ? await useCases.updateEntry.execute(entryId, input)
        : await useCases.createEntry.execute(input);
      if (!result.isSuccess) {
        setErrors(toErrorRecord(result.error));
        return;
      }
      onDone();
    } catch {
      setErrors({ form: 'Entry could not be saved. Nothing was changed.' });
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = () => {
    if (!entryId) return;
    Alert.alert(
      'Delete entry?',
      'This removes the entry and cannot be undone.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void useCases.deleteEntry
              .execute(entryId)
              .then((deleted) =>
                deleted
                  ? onDone()
                  : setErrors({ form: 'Entry no longer exists.' }),
              )
              .catch(() => setErrors({ form: 'Entry could not be deleted.' }));
          },
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  };

  return (
    <ConsumptionEntryForm
      errors={errors}
      initialValues={entry ? formValues(entry) : emptyFormValues()}
      isSaving={isSaving}
      onCancel={onDone}
      onSave={(values) => void save(values)}
      {...(entryId ? { onDelete: requestDelete } : {})}
    />
  );
}

function emptyFormValues(): ConsumptionEntryFormValues {
  const now = new Date();
  return {
    carbohydrateGrams: '',
    consumedAmount: '',
    date: localDate(now),
    description: '',
    energyKilocalories: '',
    fatGrams: '',
    fiberGrams: '',
    kind: 'food',
    proteinGrams: '',
    quantityKind: 'mass',
    referenceAmount: '',
    sodiumMilligrams: '',
    sugarGrams: '',
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  };
}

function formValues(entry: ConsumptionEntry): ConsumptionEntryFormValues {
  const shifted = new Date(
    entry.occurredAtEpochMilliseconds + entry.utcOffsetMinutes * 60_000,
  );
  const nutrients = entry.facts.nutrients;
  return {
    carbohydrateGrams: optionalString(nutrients.carbohydrateGrams),
    consumedAmount: String(
      entry.consumedQuantity.kind === 'mass'
        ? entry.consumedQuantity.amount.grams
        : entry.consumedQuantity.amount.milliliters,
    ),
    date: entry.localCalendarDate,
    description: entry.facts.description,
    energyKilocalories: String(entry.facts.energy.in('kilocalorie')),
    fatGrams: optionalString(nutrients.fatGrams),
    fiberGrams: optionalString(nutrients.fiberGrams),
    kind: entry.kind,
    proteinGrams: optionalString(nutrients.proteinGrams),
    quantityKind: entry.facts.reference.kind,
    referenceAmount: String(
      entry.facts.reference.kind === 'mass'
        ? entry.facts.reference.amount.grams
        : entry.facts.reference.amount.milliliters,
    ),
    sodiumMilligrams: optionalString(nutrients.sodiumMilligrams),
    sugarGrams: optionalString(nutrients.sugarGrams),
    time: `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`,
  };
}

function optionalString(value: number | null): string {
  return value === null ? '' : String(value);
}

function localDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toErrorRecord(errors: readonly DomainError[]) {
  return Object.fromEntries(
    errors.map((error) => [error.field ?? 'form', error.message]),
  );
}
