import type { DomainError, HydrationTarget } from '@fitness/domain';
import { useEffect, useState } from 'react';
import { createHydrationTrackingUseCases } from '../../../composition/hydration-tracking';
import {
  AppButton,
  AppText,
  LoadingIndicator,
  Screen,
  SelectionField,
  TextField,
  spacing,
} from '../../../design-system';
import type { SaveHydrationTargetInput } from '../application/save-hydration-target-use-case';

type UseCases = Readonly<{
  getTarget: Readonly<{ execute: () => Promise<HydrationTarget | null> }>;
  saveTarget: Readonly<{
    execute: (input: SaveHydrationTargetInput) => Promise<
      | Readonly<{ isSuccess: true; value: HydrationTarget }>
      | Readonly<{
          error: readonly DomainError[];
          isSuccess: false;
        }>
    >;
  }>;
}>;

type Props = Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onDone: () => void;
}>;

export function HydrationTargetScreen({
  loadUseCases = createHydrationTrackingUseCases,
  onDone,
}: Props) {
  const [useCases, setUseCases] = useState<UseCases>();
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'liter' | 'milliliter'>('milliliter');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    void loadUseCases()
      .then(async (loaded) => {
        setUseCases(loaded);
        const target = await loaded.getTarget.execute();
        if (target) setAmount(String(target.volume.milliliters));
      })
      .catch(() => setErrors({ form: 'Daily target could not be loaded.' }));
  }, [loadUseCases]);

  if (!useCases && !errors.form) {
    return (
      <Screen accessibilityLabel="Loading hydration target" isCentered>
        <LoadingIndicator label="Loading hydration target" />
      </Screen>
    );
  }

  const save = async () => {
    if (!useCases) return;
    setErrors({});
    setIsSaving(true);
    try {
      const result = await useCases.saveTarget.execute({ amount, unit });
      if (!result.isSuccess) {
        setErrors(
          Object.fromEntries(
            result.error.map((error) => [
              error.field === 'targetVolume'
                ? 'amount'
                : (error.field ?? 'form'),
              error.message,
            ]),
          ),
        );
        return;
      }
      onDone();
    } catch {
      setErrors({ form: 'Daily target could not be saved. Nothing changed.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen
      accessibilityLabel="Daily fluid target"
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <AppText accessibilityRole="header" variant="display">
        Daily fluid target
      </AppText>
      <AppText color="secondary">
        Choose your own tracking target. The app does not calculate or recommend
        a medical intake amount.
      </AppText>
      <SelectionField
        label="Target unit"
        onChange={setUnit}
        options={[
          { label: 'Milliliters (mL)', value: 'milliliter' },
          { label: 'Liters (L)', value: 'liter' },
        ]}
        value={unit}
      />
      <TextField
        error={errors.amount}
        helperText={
          unit === 'liter'
            ? 'For example, 3 L becomes 3,000 mL.'
            : 'Maximum 20,000 mL.'
        }
        keyboardType="decimal-pad"
        label={`Target (${unit === 'liter' ? 'L' : 'mL'})`}
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
        label="Save daily target"
        onPress={() => void save()}
      />
      <AppButton label="Cancel" onPress={onDone} variant="ghost" />
    </Screen>
  );
}
