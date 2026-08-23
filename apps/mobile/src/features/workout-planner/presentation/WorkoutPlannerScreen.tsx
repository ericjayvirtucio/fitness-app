import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { createWorkoutPlannerUseCases } from '../../../composition/workout-planner';
import { createWorkoutSessionUseCases } from '../../../composition/workout-session';
import type { WorkoutSession } from '@fitness/domain';
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
type SessionUseCases = Awaited<ReturnType<typeof createWorkoutSessionUseCases>>;
type State =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      active: WorkoutSession | null;
      days: readonly WeeklyPlanDetailsDay[];
      sessions: SessionUseCases;
      status: 'ready';
    };

export function WorkoutPlannerScreen({
  loadUseCases = createWorkoutPlannerUseCases,
  loadSessionUseCases = createWorkoutSessionUseCases,
  onOpenActive,
  onEditDay,
  onOpenLibrary,
  onOpenHistory,
}: Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  loadSessionUseCases?: () => Promise<SessionUseCases>;
  onEditDay: (weekday: number) => void;
  onOpenActive: () => void;
  onOpenLibrary: () => void;
  onOpenHistory: () => void;
}>) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const load = useCallback(() => {
    setState({ status: 'loading' });
    void Promise.all([loadUseCases(), loadSessionUseCases()])
      .then(async ([planner, sessions]) => ({
        active: await sessions.getActive.execute(),
        days: await planner.getWeekly.execute(),
        sessions,
      }))
      .then((result) => setState({ ...result, status: 'ready' }))
      .catch(() => setState({ status: 'error' }));
  }, [loadSessionUseCases, loadUseCases]);
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

  const today = state.days[new Date().getDay()];

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
        {state.active ? (
          <Card variant="outlined">
            <AppText variant="heading">Active workout</AppText>
            <AppText>{state.active.name}</AppText>
            <AppText color="secondary">
              Your confirmed sets are saved offline.
            </AppText>
            <AppButton label="Resume Workout" onPress={onOpenActive} />
          </Card>
        ) : (
          <Card variant="outlined">
            <AppText variant="heading">Start workout</AppText>
            <AppText color="secondary">
              Use today's plan or begin an empty workout.
            </AppText>
            {today?.kind === 'workout' ? (
              <AppButton
                label={`Start ${today.details.workout.name}`}
                onPress={() => {
                  void state.sessions.start
                    .executePlanned(new Date().getDay())
                    .then((outcome) => {
                      if (outcome.status !== 'invalid') onOpenActive();
                    })
                    .catch(() => setState({ status: 'error' }));
                }}
              />
            ) : null}
            <AppButton
              label="Start Empty Workout"
              onPress={() => {
                void state.sessions.start
                  .executeEmpty()
                  .then(() => onOpenActive())
                  .catch(() => setState({ status: 'error' }));
              }}
              variant="outline"
            />
          </Card>
        )}
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
        <AppText variant="heading">Workout History</AppText>
        <AppText color="secondary">
          Review completed workouts and performed progress.
        </AppText>
        <AppButton label="Open Workout History" onPress={onOpenHistory} />
      </Card>
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
