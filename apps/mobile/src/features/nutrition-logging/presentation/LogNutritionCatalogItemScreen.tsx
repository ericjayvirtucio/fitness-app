import type { DomainError } from '@fitness/domain';
import { useEffect, useState } from 'react';
import { createNutritionLoggingUseCases } from '../../../composition/nutrition-logging';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  TextField,
  spacing,
} from '../../../design-system';
import type { NutritionCatalogItem } from '../application/nutrition-catalog-item';
import { formatNutritionEnergy } from './nutrition-formatting';

type UseCases = Awaited<ReturnType<typeof createNutritionLoggingUseCases>>;
type Props = Readonly<{
  catalogItemId: string;
  loadUseCases?: () => Promise<UseCases>;
  onDone: () => void;
}>;

export function LogNutritionCatalogItemScreen({
  catalogItemId,
  loadUseCases = createNutritionLoggingUseCases,
  onDone,
}: Props) {
  const [useCases, setUseCases] = useState<UseCases>();
  const [item, setItem] = useState<NutritionCatalogItem | null>();
  const [amount, setAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    void loadUseCases()
      .then(async (loaded) => {
        setUseCases(loaded);
        setItem(await loaded.getCatalogItem.execute(catalogItemId));
      })
      .catch(() => setErrors({ form: 'Saved item could not be loaded.' }));
  }, [catalogItemId, loadUseCases]);

  if (!useCases || item === undefined) {
    return (
      <Screen accessibilityLabel="Loading saved nutrition item" isCentered>
        <LoadingIndicator label="Loading saved nutrition item" />
      </Screen>
    );
  }
  if (item === null) {
    return (
      <Screen accessibilityLabel="Saved nutrition item not found" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Saved item not found
        </AppText>
        <AppButton label="Back" onPress={onDone} />
      </Screen>
    );
  }
  const unit = item.kind === 'food' ? 'grams' : 'milliliters';
  const save = async () => {
    setErrors({});
    setIsSaving(true);
    try {
      const result = await useCases.logFromCatalog.execute(
        catalogItemId,
        amount,
      );
      if (!result.isSuccess) {
        setErrors(toErrorRecord(result.error));
        return;
      }
      onDone();
    } catch {
      setErrors({
        form: 'Nutrition could not be logged. Nothing was changed.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen
      accessibilityLabel={`Log ${item.facts.description}`}
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <AppText accessibilityRole="header" variant="display">
        {item.facts.description}
      </AppText>
      <Card variant="outlined">
        <AppText>{item.kind === 'food' ? 'Food' : 'Beverage'}</AppText>
        <AppText color="secondary">{referenceSummary(item)}</AppText>
      </Card>
      <TextField
        autoFocus
        error={errors.consumedAmount}
        helperText={`Enter the physical amount consumed in ${unit}.`}
        keyboardType="decimal-pad"
        label={`Consumed amount (${unit})`}
        onChangeText={setAmount}
        value={amount}
      />
      {errors.form ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {errors.form}
        </AppText>
      ) : null}
      <AppButton
        isLoading={isSaving}
        label="Log to today"
        onPress={() => void save()}
      />
      <AppButton label="Cancel" onPress={onDone} variant="ghost" />
    </Screen>
  );
}

function referenceSummary(item: NutritionCatalogItem): string {
  const reference =
    item.facts.reference.kind === 'mass'
      ? `${item.facts.reference.amount.grams} g`
      : `${item.facts.reference.amount.milliliters} mL`;
  return `Per ${reference} · ${formatNutritionEnergy(item.facts.energy)}`;
}

function toErrorRecord(errors: readonly DomainError[]) {
  return Object.fromEntries(
    errors.map((error) => [error.field ?? 'form', error.message]),
  );
}
