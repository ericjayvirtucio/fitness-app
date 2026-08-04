import { useState } from 'react';
import { View } from 'react-native';
import {
  AppButton,
  AppText,
  Card,
  Screen,
  SelectionField,
  TextField,
  spacing,
} from '../../../design-system';
import type { SaveHydrationEntryInput } from '../application/build-hydration-entry';

export type HydrationEntryFormValues = Readonly<{
  date: string;
  description: string;
  fluidType: 'other-fluid' | 'plain-water';
  time: string;
  volumeMilliliters: string;
}>;

type Props = Readonly<{
  errors: Readonly<Record<string, string>>;
  initialValues: HydrationEntryFormValues;
  isSaving: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (values: HydrationEntryFormValues) => void;
}>;

const presets = [250, 350, 500, 750, 1_000] as const;

export function HydrationEntryForm({
  errors,
  initialValues,
  isSaving,
  onCancel,
  onDelete,
  onSave,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const set = <TKey extends keyof HydrationEntryFormValues>(
    key: TKey,
    value: HydrationEntryFormValues[TKey],
  ) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <Screen
      accessibilityLabel="Hydration entry"
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          {onDelete ? 'Edit fluid' : 'Add fluid'}
        </AppText>
        <AppText color="secondary">
          Enter an explicit volume in milliliters. Container sizes are never
          guessed.
        </AppText>
      </View>
      <SelectionField
        error={errors.fluidType}
        label="Fluid type"
        onChange={(fluidType) => set('fluidType', fluidType)}
        options={[
          { label: 'Water', value: 'plain-water' },
          { label: 'Other fluid', value: 'other-fluid' },
        ]}
        value={values.fluidType}
      />
      {values.fluidType === 'other-fluid' ? (
        <TextField
          error={errors.description}
          helperText="Optional, up to 80 characters"
          label="Description"
          onChangeText={(value) => set('description', value)}
          value={values.description}
        />
      ) : null}
      <Card variant="outlined">
        <AppText variant="heading">Quick amounts</AppText>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
        >
          {presets.map((amount) => (
            <AppButton
              key={amount}
              label={`${amount} mL`}
              onPress={() => set('volumeMilliliters', String(amount))}
              variant="outline"
            />
          ))}
        </View>
      </Card>
      <TextField
        error={errors.volume}
        helperText="Maximum 10,000 mL per entry"
        keyboardType="decimal-pad"
        label="Volume (mL)"
        onChangeText={(value) => set('volumeMilliliters', value)}
        value={values.volumeMilliliters}
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
        label="Save fluid"
        onPress={() => onSave(values)}
      />
      <AppButton label="Cancel" onPress={onCancel} variant="ghost" />
      {onDelete ? (
        <AppButton label="Delete fluid" onPress={onDelete} variant="danger" />
      ) : null}
    </Screen>
  );
}

export function toHydrationSaveInput(
  values: HydrationEntryFormValues,
): SaveHydrationEntryInput | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(values.date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(values.time);
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
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
    description:
      values.fluidType === 'plain-water' ? undefined : values.description,
    fluidType: values.fluidType,
    localCalendarDate: values.date,
    occurredAtEpochMilliseconds: date.getTime(),
    utcOffsetMinutes: -date.getTimezoneOffset(),
    volumeMilliliters: values.volumeMilliliters,
  };
}
