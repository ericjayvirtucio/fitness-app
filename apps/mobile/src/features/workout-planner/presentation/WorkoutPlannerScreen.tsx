import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { createWorkoutPlannerUseCases } from '../../../composition/workout-planner';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  SectionHeader,
  spacing,
} from '../../../design-system';
import type { WeeklyPlanDetailsDay } from '../application/workout-planner-use-cases';
import { weekdayLabels } from './workout-formatting';

type UseCases = Awaited<ReturnType<typeof createWorkoutPlannerUseCases>>;
type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { days: readonly WeeklyPlanDetailsDay[]; status: 'ready' };

export function WorkoutPlannerScreen({
  loadUseCases = createWorkoutPlannerUseCases,
  onEditDay,
  onOpenLibrary,
}: Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onEditDay: (weekday: number) => void;
  onOpenLibrary: () => void;
}>) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const load = useCallback(() => {
    setState({ status: 'loading' });
    void loadUseCases()
      .then((useCases) => useCases.getWeekly.execute())
      .then((days) => setState({ days, status: 'ready' }))
      .catch(() => setState({ status: 'error' }));
  }, [loadUseCases]);
  useFocusEffect(load);

  if (state.status === 'loading')
    return (
      <Screen accessibilityLabel="Loading weekly workout plan" isCentered>
        <LoadingIndicator label="Loading weekly plan" />
      </Screen>
    );
  if (state.status === 'error')
    return (
      <Screen accessibilityLabel="Weekly workout plan error" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Workout plan unavailable
        </AppText>
        <AppText color="secondary" style={{ marginVertical: spacing.md }}>
          Your weekly plan could not be loaded. Nothing was changed.
        </AppText>
        <AppButton label="Try again" onPress={load} />
      </Screen>
    );

  return (
    <Screen
      accessibilityLabel="Workout"
      contentContainerStyle={{ gap: spacing.xl }}
      testID="weekly-plan-screen"
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Workout
        </AppText>
        <AppText color="secondary">
          Plan your private recurring week. Everything works offline.
        </AppText>
      </View>
      <View>
        <SectionHeader title="Weekly plan" />
        {state.days.map((day) => {
          const label = weekdayLabels[day.weekday.value];
          const isWorkout = day.kind === 'workout';
          const status = isWorkout ? day.details.workout.name : 'Rest';
          return (
            <View
              key={day.weekday.value}
              style={styles.dayCardSpacing}
              testID={`weekday-card-${day.weekday.value}-spacing`}
            >
              <Card
                accessibilityLabel={`${isWorkout ? 'Edit' : 'Configure'} ${label}, ${status}`}
                onPress={() => onEditDay(day.weekday.value)}
                testID={`weekday-card-${day.weekday.value}`}
                variant="outlined"
              >
                <AppText variant="heading">{label}</AppText>
                <AppText>{status}</AppText>
                {isWorkout ? (
                  <AppText color="secondary">
                    {day.details.exercises.length} exercise
                    {day.details.exercises.length === 1 ? '' : 's'}
                  </AppText>
                ) : (
                  <AppText color="secondary">No workout planned</AppText>
                )}
              </Card>
            </View>
          );
        })}
      </View>
      <Card variant="outlined">
        <AppText variant="heading">Exercise Library</AppText>
        <AppText color="secondary">
          Create and maintain the reusable exercises used by your plan.
        </AppText>
        <AppButton label="Open Exercise Library" onPress={onOpenLibrary} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayCardSpacing: {
    marginTop: spacing.md,
  },
});
