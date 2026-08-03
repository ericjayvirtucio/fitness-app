import { useState } from 'react';
import { View } from 'react-native';
import {
  AppButton,
  AppText,
  Card,
  Screen,
  SectionHeader,
  SelectionField,
  TextField,
  spacing,
} from '../../../design-system';
import type { SaveConsumptionEntryInput } from '../application/build-consumption-entry';

export type ConsumptionEntryFormValues = Readonly<{
  carbohydrateGrams: string;
  consumedAmount: string;
  date: string;
  description: string;
  energyKilocalories: string;
  fatGrams: string;
  fiberGrams: string;
  kind: 'beverage' | 'food';
  proteinGrams: string;
  quantityKind: 'mass' | 'volume';
  referenceAmount: string;
  sodiumMilligrams: string;
  sugarGrams: string;
  time: string;
}>;

type Props = Readonly<{
  errors: Readonly<Record<string, string>>;
  initialValues: ConsumptionEntryFormValues;
  isSaving: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (values: ConsumptionEntryFormValues) => void;
  onSaveReusable?: () => void;
}>;

export function ConsumptionEntryForm({
  errors,
  initialValues,
  isSaving,
  onCancel,
  onDelete,
  onSave,
  onSaveReusable,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const set = <TKey extends keyof ConsumptionEntryFormValues>(
    key: TKey,
    value: ConsumptionEntryFormValues[TKey],
  ) => setValues((current) => ({ ...current, [key]: value }));
  const unit = values.quantityKind === 'mass' ? 'grams' : 'milliliters';

  return (
    <Screen
      accessibilityLabel="Food or beverage entry"
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          {onDelete ? 'Edit entry' : 'Add food or beverage'}
        </AppText>
        <AppText color="secondary">
          Enter physical quantities in grams or milliliters. Blank nutrient
          fields mean unknown; enter 0 only when the value is known to be zero.
        </AppText>
      </View>

      <SelectionField
        error={errors.kind}
        label="Entry type"
        onChange={(kind) => set('kind', kind)}
        options={[
          { label: 'Food', value: 'food' },
          { label: 'Beverage', value: 'beverage' },
        ]}
        value={values.kind}
      />
      <TextField
        error={errors.description}
        label="Description"
        onChangeText={(value) => set('description', value)}
        value={values.description}
      />

      <SectionHeader title="Nutrition reference" />
      <SelectionField
        error={errors.quantityKind}
        label="Physical quantity"
        onChange={(kind) => set('quantityKind', kind)}
        options={[
          { label: 'Grams', value: 'mass' },
          { label: 'Milliliters', value: 'volume' },
        ]}
        value={values.quantityKind}
      />
      <TextField
        error={errors.quantity}
        helperText={`Nutrition values below apply to this amount in ${unit}.`}
        keyboardType="decimal-pad"
        label={`Reference amount (${unit})`}
        onChangeText={(value) => set('referenceAmount', value)}
        value={values.referenceAmount}
      />
      <TextField
        error={errors.energyKilocalories}
        keyboardType="decimal-pad"
        label="Energy per reference (kcal)"
        onChangeText={(value) => set('energyKilocalories', value)}
        value={values.energyKilocalories}
      />

      <Card variant="outlined">
        <AppText variant="heading">Optional nutrients per reference</AppText>
        <TextField
          error={errors.proteinGrams}
          keyboardType="decimal-pad"
          label="Protein (g)"
          onChangeText={(value) => set('proteinGrams', value)}
          value={values.proteinGrams}
        />
        <TextField
          error={errors.carbohydrateGrams}
          keyboardType="decimal-pad"
          label="Carbohydrate (g)"
          onChangeText={(value) => set('carbohydrateGrams', value)}
          value={values.carbohydrateGrams}
        />
        <TextField
          error={errors.fatGrams}
          keyboardType="decimal-pad"
          label="Fat (g)"
          onChangeText={(value) => set('fatGrams', value)}
          value={values.fatGrams}
        />
        <TextField
          error={errors.fiberGrams}
          keyboardType="decimal-pad"
          label="Fiber (g)"
          onChangeText={(value) => set('fiberGrams', value)}
          value={values.fiberGrams}
        />
        <TextField
          error={errors.sugarGrams}
          keyboardType="decimal-pad"
          label="Sugar (g)"
          onChangeText={(value) => set('sugarGrams', value)}
          value={values.sugarGrams}
        />
        <TextField
          error={errors.sodiumMilligrams}
          keyboardType="decimal-pad"
          label="Sodium (mg)"
          onChangeText={(value) => set('sodiumMilligrams', value)}
          value={values.sodiumMilligrams}
        />
      </Card>

      <SectionHeader title="Consumed" />
      <TextField
        error={errors.quantity}
        keyboardType="decimal-pad"
        label={`Consumed amount (${unit})`}
        onChangeText={(value) => set('consumedAmount', value)}
        value={values.consumedAmount}
      />
      <TextField
        error={errors.localCalendarDate}
        helperText="YYYY-MM-DD"
        label="Date"
        onChangeText={(value) => set('date', value)}
        value={values.date}
      />
      <TextField
        error={errors.occurredAtEpochMilliseconds}
        helperText="24-hour HH:MM"
        label="Time"
        onChangeText={(value) => set('time', value)}
        value={values.time}
      />

      {errors.form ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {errors.form}
        </AppText>
      ) : null}
      <AppButton
        isLoading={isSaving}
        label="Save entry"
        onPress={() => onSave(values)}
      />
      <AppButton label="Cancel" onPress={onCancel} variant="ghost" />
      {onDelete ? (
        <>
          {onSaveReusable ? (
            <AppButton
              label="Save as reusable item"
              onPress={onSaveReusable}
              variant="outline"
            />
          ) : null}
          <AppButton label="Delete entry" onPress={onDelete} variant="danger" />
        </>
      ) : null}
    </Screen>
  );
}

export function toSaveInput(
  values: ConsumptionEntryFormValues,
): SaveConsumptionEntryInput | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(values.date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(values.time);
  if (!match || !timeMatch) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }
  return {
    ...values,
    localCalendarDate: values.date,
    occurredAtEpochMilliseconds: date.getTime(),
    utcOffsetMinutes: -date.getTimezoneOffset(),
  };
}
