import {
  GoalConfiguration,
  calculateDailyCalorieTarget,
  goalTypes,
  isOk,
  type Energy,
  type GoalConfiguration as GoalConfigurationValue,
  type GoalType,
} from '@fitness/domain';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  AppButton,
  AppText,
  Card,
  SelectionField,
  TextField,
  spacing,
} from '../../../design-system';
import type { SaveGoalInput } from '../application/save-goal-use-case';
import { formatDailyEnergy } from './energy-formatting';

type GoalConfigurationFormProps = Readonly<{
  errors: Readonly<Record<string, string>>;
  initialGoal: GoalConfigurationValue | null;
  isSaving: boolean;
  maintenanceEnergy: Energy;
  onSave: (input: SaveGoalInput) => void;
  successMessage?: string | undefined;
}>;

const goalLabels: Readonly<Record<GoalType, string>> = {
  'gain-weight': 'Gain weight',
  'lose-weight': 'Lose weight',
  'maintain-weight': 'Maintain weight',
};

export function GoalConfigurationForm({
  errors,
  initialGoal,
  isSaving,
  maintenanceEnergy,
  onSave,
  successMessage,
}: GoalConfigurationFormProps) {
  const [goalType, setGoalType] = useState<GoalType | undefined>(
    initialGoal?.type,
  );
  const [adjustment, setAdjustment] = useState(
    initialGoal && initialGoal.type !== 'maintain-weight'
      ? String(initialGoal.adjustmentKilocalories)
      : '',
  );

  useEffect(() => {
    setGoalType(initialGoal?.type);
    setAdjustment(
      initialGoal && initialGoal.type !== 'maintain-weight'
        ? String(initialGoal.adjustmentKilocalories)
        : '',
    );
  }, [initialGoal]);

  const parsedAdjustment =
    goalType === 'maintain-weight' ? 0 : Number(adjustment);
  const previewGoal = GoalConfiguration.create(goalType, parsedAdjustment);
  const previewTarget = isOk(previewGoal)
    ? calculateDailyCalorieTarget(maintenanceEnergy, previewGoal.value)
    : previewGoal;

  return (
    <View style={{ gap: spacing.lg }}>
      <SelectionField
        error={errors.goalType}
        label="Weight goal"
        onChange={(value) => {
          setGoalType(value);
          if (value === 'maintain-weight') setAdjustment('');
        }}
        options={goalTypes.map((value) => ({
          label: goalLabels[value],
          value,
        }))}
        value={goalType}
      />
      {goalType && goalType !== 'maintain-weight' ? (
        <TextField
          error={errors.adjustmentKilocalories}
          helperText="Enter 100–500 kcal/day. Suggested increments are 50 kcal."
          keyboardType="number-pad"
          label={
            goalType === 'lose-weight'
              ? 'Daily calorie deficit'
              : 'Daily calorie surplus'
          }
          onChangeText={setAdjustment}
          value={adjustment}
        />
      ) : null}
      {isOk(previewTarget) ? (
        <Card
          accessibilityLabel="Calculated daily calorie target"
          variant="outlined"
        >
          <AppText color="secondary" variant="label">
            Calculated target
          </AppText>
          <AppText
            accessibilityLabel={`Daily calorie target ${formatDailyEnergy(previewTarget.value)}`}
            variant="heading"
          >
            {formatDailyEnergy(previewTarget.value)}
          </AppText>
          <AppText color="secondary">
            Based on estimated maintenance and your selected adjustment. Results
            are not guaranteed.
          </AppText>
        </Card>
      ) : goalType ? (
        <AppText accessibilityLiveRegion="polite" color="secondary">
          {previewTarget.error.message}
        </AppText>
      ) : null}
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
        label={isSaving ? 'Saving goal' : 'Save goal'}
        onPress={() => onSave({ adjustmentKilocalories: adjustment, goalType })}
      />
    </View>
  );
}
