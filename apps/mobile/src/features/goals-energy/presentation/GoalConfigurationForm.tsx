import {
  GoalConfiguration,
  calculateDailyCalorieTarget,
  calculateDailyMacronutrientTargets,
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
  describeCardContents,
  Divider,
  SelectionField,
  StatTile,
  TextField,
  spacing,
} from '../../../design-system';
import type { SaveGoalInput } from '../application/save-goal-use-case';
import {
  formatDailyEnergy,
  formatMacronutrientGrams,
} from './energy-formatting';

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

const targetCaveat =
  'Based on estimated maintenance and your selected adjustment. Results are not guaranteed.';
const macroTargetCaveat =
  'A general target based on a fixed macronutrient split within published dietary reference ranges, not personalized nutrition or medical advice.';

/**
 * A labelled card is one accessibility element, so this card announced its title
 * and not the target it exists to show. The rendered lines and the announced
 * ones are the same strings, in the same order. Macro targets are arithmetic
 * over this same calorie target, so they render here rather than requiring a
 * second calculation or a second card.
 */
function CalculatedTargetCard({ target }: Readonly<{ target: Energy }>) {
  const macroTargets = calculateDailyMacronutrientTargets(target);
  const macroLines = [
    {
      label: 'Protein target',
      value: formatMacronutrientGrams(macroTargets.proteinGrams),
    },
    {
      label: 'Carbohydrate target',
      value: formatMacronutrientGrams(macroTargets.carbohydrateGrams),
    },
    {
      label: 'Fat target',
      value: formatMacronutrientGrams(macroTargets.fatGrams),
    },
  ];
  const lines = [
    'Calculated target',
    formatDailyEnergy(target),
    targetCaveat,
    ...macroLines.flatMap((line) => [line.label, line.value]),
    macroTargetCaveat,
  ];
  return (
    <Card
      accessibilityLabel={describeCardContents(
        'Calculated daily calorie target',
        lines,
      )}
      variant="outlined"
    >
      <AppText color="secondary" variant="label">
        {lines[0]}
      </AppText>
      <AppText variant="heading">{lines[1]}</AppText>
      <AppText color="secondary">{lines[2]}</AppText>
      <Divider />
      <View style={{ gap: spacing.sm }}>
        {macroLines.map((line) => (
          <StatTile key={line.label} variant="row" {...line} />
        ))}
      </View>
      <AppText color="secondary">{macroTargetCaveat}</AppText>
    </Card>
  );
}

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
        <CalculatedTargetCard target={previewTarget.value} />
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
