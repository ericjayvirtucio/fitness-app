import { isErr, type GoalConfiguration } from '@fitness/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { createGoalsEnergyUseCases } from '../../../composition/goals-energy';
import {
  AppButton,
  AppText,
  Card,
  Divider,
  LoadingIndicator,
  Screen,
  SectionHeader,
  spacing,
} from '../../../design-system';
import type { EnergySummaryOutcome } from '../application/energy-summary';
import type { SaveGoalInput } from '../application/save-goal-use-case';
import { GoalConfigurationForm } from './GoalConfigurationForm';
import {
  formatBmi,
  formatBmiCategory,
  formatDailyEnergy,
} from './energy-formatting';

type GoalsEnergyUseCases = Readonly<{
  getEnergySummary: Readonly<{ execute: () => Promise<EnergySummaryOutcome> }>;
  saveGoal: Readonly<{
    execute: (input: SaveGoalInput) => Promise<
      | Readonly<{ isSuccess: true; value: GoalConfiguration }>
      | Readonly<{
          error: readonly Readonly<{ field?: string; message: string }>[];
          isSuccess: false;
        }>
    >;
  }>;
}>;

type ScreenState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ outcome: EnergySummaryOutcome; status: 'ready' }>;

type GoalsEnergyScreenProps = Readonly<{
  loadUseCases?: () => Promise<GoalsEnergyUseCases>;
  onBack: () => void;
  onEditProfile: () => void;
}>;

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={{ gap: spacing.xs }}
    >
      <AppText color="secondary" variant="label">
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

export function GoalsEnergyScreen({
  loadUseCases = createGoalsEnergyUseCases,
  onBack,
  onEditProfile,
}: GoalsEnergyScreenProps) {
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [useCases, setUseCases] = useState<GoalsEnergyUseCases>();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [successMessage, setSuccessMessage] = useState<string>();

  const load = useCallback(() => {
    setState({ status: 'loading' });
    void loadUseCases()
      .then(async (loadedUseCases) => {
        setUseCases(loadedUseCases);
        setState({
          outcome: await loadedUseCases.getEnergySummary.execute(),
          status: 'ready',
        });
      })
      .catch(() => setState({ status: 'error' }));
  }, [loadUseCases]);

  useFocusEffect(load);

  const save = async (input: SaveGoalInput) => {
    if (!useCases) return;
    setErrors({});
    setSuccessMessage(undefined);
    setIsSaving(true);
    try {
      const result = await useCases.saveGoal.execute(input);
      if (isErr(result)) {
        setErrors(
          Object.fromEntries(
            result.error.map((error) => [error.field ?? 'form', error.message]),
          ),
        );
        return;
      }
      setSuccessMessage('Goal saved successfully.');
      setState({
        outcome: await useCases.getEnergySummary.execute(),
        status: 'ready',
      });
    } catch {
      setErrors({ form: 'Goal could not be saved. Try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (state.status === 'loading') {
    return (
      <Screen accessibilityLabel="Loading goals and energy" isCentered>
        <LoadingIndicator label="Loading goals and energy" />
      </Screen>
    );
  }
  if (state.status === 'error') {
    return (
      <Screen accessibilityLabel="Goals and energy error" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Goals & energy unavailable
        </AppText>
        <AppText color="secondary" style={{ marginVertical: spacing.md }}>
          Your information could not be loaded. Nothing was changed.
        </AppText>
        <AppButton label="Try again" onPress={load} />
        <AppButton label="Back to profile" onPress={onBack} variant="ghost" />
      </Screen>
    );
  }
  if (state.outcome.status === 'profile-required') {
    return (
      <Screen
        accessibilityLabel="Profile required for goals and energy"
        isCentered
      >
        <AppText accessibilityRole="header" variant="heading">
          Complete your profile
        </AppText>
        <AppText color="secondary" style={{ marginVertical: spacing.md }}>
          Height, weight, date of birth, biological sex, and activity level are
          required. No defaults will be assumed.
        </AppText>
        <AppButton label="Set up profile" onPress={onEditProfile} />
        <AppButton label="Back to profile" onPress={onBack} variant="ghost" />
      </Screen>
    );
  }
  if (state.outcome.status === 'calculation-unavailable') {
    return (
      <Screen
        accessibilityLabel="Goals and energy calculation unavailable"
        contentContainerStyle={{ gap: spacing.lg }}
      >
        <AppText accessibilityRole="header" variant="display">
          Goals & energy
        </AppText>
        {state.outcome.bmi ? (
          <Card accessibilityLabel="BMI screening result" variant="outlined">
            <Metric label="BMI" value={formatBmi(state.outcome.bmi.value)} />
            <Metric
              label="Screening category"
              value={formatBmiCategory(state.outcome.bmi.category)}
            />
          </Card>
        ) : null}
        <Card variant="filled">
          <AppText variant="heading">Energy estimate unavailable</AppText>
          <AppText color="secondary">{state.outcome.reason.message}</AppText>
          <AppText color="secondary">
            The selected formula is limited to supported adults and does not
            guess missing coefficients.
          </AppText>
        </Card>
        <AppButton
          label="Review profile"
          onPress={onEditProfile}
          variant="outline"
        />
        <AppButton label="Back to profile" onPress={onBack} variant="ghost" />
      </Screen>
    );
  }

  const { summary } = state.outcome;
  return (
    <Screen
      accessibilityLabel="Goals and energy"
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <AppButton label="Back to profile" onPress={onBack} variant="ghost" />
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Goals & energy
        </AppText>
        <AppText color="secondary">
          Calculated from your stored profile. These are estimates, not medical
          advice.
        </AppText>
      </View>
      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Your estimates" />
        <Card
          accessibilityLabel="Profile-derived energy estimates"
          variant="outlined"
        >
          <Metric label="BMI" value={formatBmi(summary.bmi.value)} />
          <Metric
            label="Screening category"
            value={formatBmiCategory(summary.bmi.category)}
          />
          <Divider />
          <Metric
            label="Estimated BMR"
            value={formatDailyEnergy(summary.restingEnergy)}
          />
          <Metric
            label="Estimated maintenance"
            value={formatDailyEnergy(summary.maintenanceEnergy)}
          />
        </Card>
        <AppText color="secondary">
          BMI is a screening classification, not a diagnosis. It does not
          distinguish body fat from muscle or bone.
        </AppText>
      </View>
      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Weight goal" />
        <GoalConfigurationForm
          errors={errors}
          initialGoal={summary.goal}
          isSaving={isSaving}
          maintenanceEnergy={summary.maintenanceEnergy}
          onSave={(input) => void save(input)}
          successMessage={successMessage}
        />
      </View>
      <Card variant="filled">
        <AppText variant="heading">About these estimates</AppText>
        <AppText color="secondary">
          Mifflin–St Jeor predicts resting energy from age, height, weight, and
          a female or male coefficient. Activity factors estimate maintenance
          and can differ from actual needs.
        </AppText>
      </Card>
    </Screen>
  );
}
