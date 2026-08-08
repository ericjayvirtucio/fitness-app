import type {
  ExerciseEquipment,
  ExerciseLoggingMode,
  ExerciseMuscleGroup,
} from '@fitness/domain';
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
import type { SaveExerciseInput } from '../application/build-exercise-catalog-item';
import {
  equipmentOptions,
  loggingModeOptions,
  muscleOptions,
} from './exercise-options';

export type ExerciseFormValues = Readonly<{
  equipment: ExerciseEquipment;
  isFavorite: boolean;
  loggingMode: ExerciseLoggingMode;
  name: string;
  notes: string;
  primaryMuscleGroup: ExerciseMuscleGroup;
}>;

export function ExerciseForm({
  errors,
  initialValues,
  isEditing,
  isSaving,
  onCancel,
  onDelete,
  onSave,
}: Readonly<{
  errors: Readonly<Record<string, string>>;
  initialValues: ExerciseFormValues;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (values: ExerciseFormValues) => void;
}>) {
  const [values, setValues] = useState(initialValues);
  const set = <TKey extends keyof ExerciseFormValues>(
    key: TKey,
    value: ExerciseFormValues[TKey],
  ) => setValues((current) => ({ ...current, [key]: value }));
  return (
    <Screen
      accessibilityLabel={isEditing ? 'Edit exercise' : 'Create exercise'}
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          {isEditing ? 'Edit exercise' : 'Create exercise'}
        </AppText>
        <AppText color="secondary">
          Choose how this exercise will eventually be logged. No workout set is
          recorded yet.
        </AppText>
      </View>
      <TextField
        error={errors.name}
        label="Exercise name"
        onChangeText={(value) => set('name', value)}
        testID="exercise-name-input"
        value={values.name}
      />
      <SelectionField
        error={errors.equipment}
        label="Equipment"
        onChange={(value) => set('equipment', value)}
        options={equipmentOptions}
        value={values.equipment}
      />
      <SelectionField
        error={errors.primaryMuscleGroup}
        label="Primary muscle group"
        onChange={(value) => set('primaryMuscleGroup', value)}
        options={muscleOptions}
        value={values.primaryMuscleGroup}
      />
      <SelectionField
        error={errors.loggingMode}
        label="How this exercise is logged"
        onChange={(value) => set('loggingMode', value)}
        options={loggingModeOptions}
        value={values.loggingMode}
      />
      <TextField
        error={errors.notes}
        label="Notes (optional)"
        multiline
        onChangeText={(value) => set('notes', value)}
        value={values.notes}
      />
      <AppButton
        accessibilityLabel={`${values.isFavorite ? 'Remove' : 'Add'} ${values.name.trim() || 'this exercise'} ${values.isFavorite ? 'from' : 'to'} favorites`}
        label={values.isFavorite ? 'Favorite: Yes' : 'Favorite: No'}
        onPress={() => set('isFavorite', !values.isFavorite)}
        variant="outline"
      />
      {errors.form ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {errors.form}
        </AppText>
      ) : null}
      <AppButton
        isLoading={isSaving}
        label="Save exercise"
        onPress={() => onSave(values)}
      />
      <AppButton label="Cancel" onPress={onCancel} variant="ghost" />
      {onDelete ? (
        <AppButton
          label="Delete exercise"
          onPress={onDelete}
          variant="danger"
        />
      ) : null}
    </Screen>
  );
}

export function toSaveExerciseInput(
  values: ExerciseFormValues,
): SaveExerciseInput {
  return values;
}
