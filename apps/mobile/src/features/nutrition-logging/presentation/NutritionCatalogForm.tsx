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
import type { SaveNutritionCatalogItemInput } from '../application/build-nutrition-catalog-item';

export type NutritionCatalogFormValues = Readonly<{
  carbohydrateGrams: string;
  description: string;
  energyKilocalories: string;
  fatGrams: string;
  fiberGrams: string;
  isFavorite: boolean;
  kind: 'beverage' | 'food';
  proteinGrams: string;
  referenceAmount: string;
  sodiumMilligrams: string;
  sugarGrams: string;
}>;

type Props = Readonly<{
  errors: Readonly<Record<string, string>>;
  initialValues: NutritionCatalogFormValues;
  isSaving: boolean;
  isEditing: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  onSave: (values: NutritionCatalogFormValues) => void;
}>;

export function NutritionCatalogForm({
  errors,
  initialValues,
  isEditing,
  isSaving,
  onCancel,
  onDelete,
  onSave,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const set = <TKey extends keyof NutritionCatalogFormValues>(
    key: TKey,
    value: NutritionCatalogFormValues[TKey],
  ) => setValues((current) => ({ ...current, [key]: value }));
  const unit = values.kind === 'food' ? 'grams' : 'milliliters';

  return (
    <Screen
      accessibilityLabel={
        isEditing ? 'Edit saved nutrition item' : 'Create saved nutrition item'
      }
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          {isEditing ? 'Edit saved item' : 'Create saved item'}
        </AppText>
        <AppText color="secondary">
          Save reference nutrition once, then enter only the amount consumed.
          Blank nutrients mean unknown; 0 means known zero.
        </AppText>
      </View>

      <SelectionField
        error={errors.kind}
        label="Item type"
        onChange={(kind) =>
          setValues((current) => ({
            ...current,
            kind,
            referenceAmount:
              current.kind === kind ? current.referenceAmount : '',
          }))
        }
        options={[
          { label: 'Food (grams)', value: 'food' },
          { label: 'Beverage (milliliters)', value: 'beverage' },
        ]}
        value={values.kind}
      />
      <TextField
        error={errors.description}
        label="Name"
        onChangeText={(value) => set('description', value)}
        value={values.description}
      />
      <TextField
        error={errors.referenceAmount}
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
        {nutrientFields.map(({ key, label }) => (
          <TextField
            error={errors[key]}
            key={key}
            keyboardType="decimal-pad"
            label={label}
            onChangeText={(value) => set(key, value)}
            value={values[key]}
          />
        ))}
      </Card>

      <AppButton
        accessibilityLabel={`${values.isFavorite ? 'Remove' : 'Add'} ${values.description.trim() || 'this item'} ${values.isFavorite ? 'from' : 'to'} favorites`}
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
        label="Save reusable item"
        onPress={() => onSave(values)}
      />
      <AppButton label="Cancel" onPress={onCancel} variant="ghost" />
      {onDelete ? (
        <AppButton
          label="Delete saved item"
          onPress={onDelete}
          variant="danger"
        />
      ) : null}
    </Screen>
  );
}

export function toCatalogSaveInput(
  values: NutritionCatalogFormValues,
): SaveNutritionCatalogItemInput {
  return values;
}

const nutrientFields = [
  { key: 'proteinGrams', label: 'Protein (g)' },
  { key: 'carbohydrateGrams', label: 'Carbohydrate (g)' },
  { key: 'fatGrams', label: 'Fat (g)' },
  { key: 'fiberGrams', label: 'Fiber (g)' },
  { key: 'sugarGrams', label: 'Sugar (g)' },
  { key: 'sodiumMilligrams', label: 'Sodium (mg)' },
] as const satisfies readonly {
  key: keyof NutritionCatalogFormValues;
  label: string;
}[];
