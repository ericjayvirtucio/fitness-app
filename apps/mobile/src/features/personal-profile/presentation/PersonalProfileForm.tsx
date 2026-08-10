import {
  activityLevels,
  biologicalSexes,
  unitSystems,
  type ActivityLevel,
  type BiologicalSex,
  type UnitSystem,
} from '@fitness/domain';
import { useState } from 'react';
import { View } from 'react-native';
import {
  AppButton,
  AppText,
  SelectionField,
  TextField,
  spacing,
} from '../../../design-system';
import type { SaveProfileInput } from '../application/save-profile-use-case';

export type ProfileFormValues = Readonly<{
  activityLevel: ActivityLevel | undefined;
  biologicalSex: BiologicalSex | undefined;
  dateOfBirth: string;
  height: string;
  preferredUnitSystem: UnitSystem;
  weight: string;
}>;

type PersonalProfileFormProps = Readonly<{
  errors: Readonly<Record<string, string>>;
  initialValues: ProfileFormValues;
  isSaving: boolean;
  onSave: (input: SaveProfileInput) => void;
  successMessage?: string | undefined;
}>;

const sexLabels: Readonly<Record<BiologicalSex, string>> = {
  female: 'Female',
  intersex: 'Intersex',
  male: 'Male',
  'prefer-not-to-say': 'Prefer not to say',
};
const activityLabels: Readonly<Record<ActivityLevel, string>> = {
  'extremely-active': 'Extremely active',
  'lightly-active': 'Lightly active',
  'moderately-active': 'Moderately active',
  sedentary: 'Sedentary',
  'very-active': 'Very active',
};

function convertMeasurement(
  value: string,
  from: UnitSystem,
  to: UnitSystem,
  metricToImperial: number,
): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || from === to) return value;
  const converted =
    to === 'imperial' ? parsed * metricToImperial : parsed / metricToImperial;
  return String(Math.round(converted * 10) / 10);
}

export function PersonalProfileForm({
  errors,
  initialValues,
  isSaving,
  onSave,
  successMessage,
}: PersonalProfileFormProps) {
  const [values, setValues] = useState(initialValues);
  const isImperial = values.preferredUnitSystem === 'imperial';

  const changeUnits = (unitSystem: UnitSystem) => {
    setValues((current) => ({
      ...current,
      height: convertMeasurement(
        current.height,
        current.preferredUnitSystem,
        unitSystem,
        0.3937007874,
      ),
      preferredUnitSystem: unitSystem,
      weight: convertMeasurement(
        current.weight,
        current.preferredUnitSystem,
        unitSystem,
        2.2046226218,
      ),
    }));
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText accessibilityRole="header" variant="display">
        Personal profile
      </AppText>
      <AppText color="secondary">
        These details stay on this device and help personalize future fitness
        features.
      </AppText>
      <SelectionField
        error={errors.preferredUnitSystem}
        label="Preferred units"
        testID="profile-units"
        onChange={changeUnits}
        options={unitSystems.map((value) => ({
          label: value === 'metric' ? 'Metric' : 'Imperial',
          value,
        }))}
        value={values.preferredUnitSystem}
      />
      <TextField
        error={errors.height}
        keyboardType="decimal-pad"
        label={`Height (${isImperial ? 'in' : 'cm'})`}
        testID="profile-height"
        onChangeText={(height) =>
          setValues((current) => ({ ...current, height }))
        }
        returnKeyType="next"
        value={values.height}
      />
      <TextField
        error={errors.weight}
        keyboardType="decimal-pad"
        label={`Weight (${isImperial ? 'lb' : 'kg'})`}
        testID="profile-weight"
        onChangeText={(weight) =>
          setValues((current) => ({ ...current, weight }))
        }
        returnKeyType="next"
        value={values.weight}
      />
      <TextField
        autoCapitalize="none"
        error={errors.dateOfBirth}
        helperText="Use YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        label="Date of birth"
        onChangeText={(dateOfBirth) =>
          setValues((current) => ({ ...current, dateOfBirth }))
        }
        placeholder="1990-06-15"
        testID="profile-date-of-birth"
        textContentType="birthdate"
        value={values.dateOfBirth}
      />
      <SelectionField
        error={errors.biologicalSex}
        label="Biological sex"
        testID="profile-biological-sex"
        onChange={(biologicalSex) =>
          setValues((current) => ({ ...current, biologicalSex }))
        }
        options={biologicalSexes.map((value) => ({
          label: sexLabels[value],
          value,
        }))}
        value={values.biologicalSex}
      />
      <SelectionField
        error={errors.activityLevel}
        label="Activity level"
        testID="profile-activity-level"
        onChange={(activityLevel) =>
          setValues((current) => ({ ...current, activityLevel }))
        }
        options={activityLevels.map((value) => ({
          label: activityLabels[value],
          value,
        }))}
        value={values.activityLevel}
      />
      {successMessage ? (
        <AppText
          accessibilityLiveRegion="polite"
          color="accent"
          variant="label"
        >
          {successMessage}
        </AppText>
      ) : null}
      {errors.form ? (
        <AppText accessibilityLiveRegion="assertive" color="danger">
          {errors.form}
        </AppText>
      ) : null}
      <AppButton
        isLoading={isSaving}
        label={isSaving ? 'Saving profile' : 'Save profile'}
        onPress={() => onSave(values)}
        testID="save-profile"
      />
    </View>
  );
}
