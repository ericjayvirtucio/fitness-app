import { useState } from 'react';
import { View } from 'react-native';
import {
  AppButton,
  AppText,
  Screen,
  SelectionField,
  TextField,
  spacing,
} from '../../../design-system';
import type { SaveBodyWeightEntryInput } from '../application/build-body-weight-entry';
import type { BodyWeightDisplayUnit } from './body-weight-formatting';

export type BodyWeightEntryFormValues = Readonly<{
  date: string;
  note: string;
  shouldUpdateProfileWeight: 'no' | 'yes';
  time: string;
  weight: string;
}>;

type Props = Readonly<{
  canUpdateProfileWeight: boolean;
  errors: Readonly<Record<string, string>>;
  initialValues: BodyWeightEntryFormValues;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (values: BodyWeightEntryFormValues) => void;
  unit: BodyWeightDisplayUnit;
}>;

export function BodyWeightEntryForm({
  canUpdateProfileWeight,
  errors,
  initialValues,
  isEditing,
  isSaving,
  onCancel,
  onDelete,
  onSave,
  unit,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const set = <TKey extends keyof BodyWeightEntryFormValues>(
    key: TKey,
    value: BodyWeightEntryFormValues[TKey],
  ) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <Screen
      accessibilityLabel="Weight check-in"
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
      testID="body-weight-entry-screen"
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          {isEditing ? 'Edit weight check-in' : 'Add weight check-in'}
        </AppText>
        <AppText color="secondary">
          Recorded check-ins keep the date and time you enter, even if this
          device later changes time zone.
        </AppText>
      </View>
      <TextField
        error={errors.mass}
        helperText="Between 2 and 500 kilograms"
        keyboardType="decimal-pad"
        label={unit === 'pound' ? 'Weight (lb)' : 'Weight (kg)'}
        onChangeText={(value) => set('weight', value)}
        testID="body-weight-value"
        value={values.weight}
      />
      <TextField
        error={errors.localCalendarDate}
        helperText="YYYY-MM-DD"
        label="Date"
        onChangeText={(value) => set('date', value)}
        testID="body-weight-date"
        value={values.date}
      />
      <TextField
        error={errors.occurredAtEpochMilliseconds}
        helperText="24-hour HH:MM"
        label="Time"
        onChangeText={(value) => set('time', value)}
        testID="body-weight-time"
        value={values.time}
      />
      <TextField
        error={errors.note}
        helperText="Optional, up to 200 characters"
        label="Note"
        onChangeText={(value) => set('note', value)}
        testID="body-weight-note"
        value={values.note}
      />
      {canUpdateProfileWeight ? (
        <SelectionField
          label="Also update my profile weight"
          onChange={(value) => set('shouldUpdateProfileWeight', value)}
          options={[
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ]}
          testID="body-weight-update-profile"
          value={values.shouldUpdateProfileWeight}
        />
      ) : null}
      {canUpdateProfileWeight ? (
        <AppText color="secondary" variant="bodySmall">
          Your profile weight is what goals and energy estimates use today. This
          history keeps what you recorded on each date.
        </AppText>
      ) : null}
      {errors.form ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {errors.form}
        </AppText>
      ) : null}
      <AppButton
        isLoading={isSaving}
        label="Save check-in"
        onPress={() => onSave(values)}
        testID="save-body-weight"
      />
      <AppButton label="Cancel" onPress={onCancel} variant="ghost" />
      {onDelete ? (
        <AppButton
          label="Delete check-in"
          onPress={onDelete}
          testID="delete-body-weight"
          variant="danger"
        />
      ) : null}
    </Screen>
  );
}

export function toBodyWeightSaveInput(
  values: BodyWeightEntryFormValues,
  unit: BodyWeightDisplayUnit,
): SaveBodyWeightEntryInput | null {
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
    localCalendarDate: values.date,
    massUnit: unit,
    massValue: values.weight,
    note: values.note,
    occurredAtEpochMilliseconds: date.getTime(),
    utcOffsetMinutes: -date.getTimezoneOffset(),
  };
}
