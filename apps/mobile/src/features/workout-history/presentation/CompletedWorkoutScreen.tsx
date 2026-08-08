import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { UnitSystem, WorkoutSession } from '@fitness/domain';
import { createWorkoutHistoryUseCases } from '../../../composition/workout-history';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  spacing,
} from '../../../design-system';
import {
  formatDuration,
  formatPlannedWorkoutResult,
  formatWorkoutResult,
} from '../../workout-session/presentation/workout-result-formatting';

type UseCases = Awaited<ReturnType<typeof createWorkoutHistoryUseCases>>;

export function CompletedWorkoutScreen({
  id,
  loadUseCases = createWorkoutHistoryUseCases,
  onClose,
}: Readonly<{
  id: string;
  loadUseCases?: () => Promise<UseCases>;
  onClose: () => void;
}>) {
  const [session, setSession] = useState<WorkoutSession | null>();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    void loadUseCases()
      .then(async (useCases) => {
        const [completed, profile] = await Promise.all([
          useCases.getCompleted.execute(id),
          useCases.getProfile.execute(),
        ]);
        setSession(completed);
        setUnitSystem(profile?.preferredUnitSystem ?? 'metric');
      })
      .catch(() => setError('Completed workout could not be loaded.'));
  }, [id, loadUseCases]);
  useFocusEffect(load);

  if (session === undefined && !error)
    return (
      <Screen accessibilityLabel="Loading completed workout" isCentered>
        <LoadingIndicator label="Loading completed workout" />
      </Screen>
    );
  if (!session)
    return (
      <Screen accessibilityLabel="Completed workout unavailable" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Completed workout unavailable
        </AppText>
        <AppText color="secondary">
          {error ?? 'This completed workout could not be found.'}
        </AppText>
        <AppButton label="Back to History" onPress={onClose} />
      </Screen>
    );

  const completedAt = session.completedAtEpochMilliseconds;
  if (completedAt === null) return null;
  const actualSetCount = session.exercises.reduce(
    (count, exercise) => count + exercise.sets.length,
    0,
  );
  return (
    <Screen
      contentContainerStyle={{ gap: spacing.xl }}
      testID="completed-workout-screen"
    >
      <AppText accessibilityRole="header" variant="display">
        {session.name}
      </AppText>
      <AppText color="secondary">
        Completed workout · {session.startedLocalCalendarDate}
      </AppText>
      <Card accessibilityLabel="Completed workout summary" variant="elevated">
        <AppText>{actualSetCount} actual sets</AppText>
        <AppText>
          {formatDuration(
            (completedAt - session.startedAtEpochMilliseconds) / 1_000,
          )}{' '}
          workout time
        </AppText>
      </Card>
      {session.exercises.map((exercise) => (
        <Card key={exercise.id.value} variant="outlined">
          <AppText accessibilityRole="header" variant="heading">
            {exercise.exerciseNameSnapshot}
          </AppText>
          {exercise.plannedPrescriptionSnapshot ? (
            <AppText color="secondary">
              Planned:{' '}
              {formatPlannedWorkoutResult(
                exercise.plannedPrescriptionSnapshot,
                unitSystem,
              )}
            </AppText>
          ) : null}
          {exercise.sets.length === 0 ? (
            <AppText color="secondary">No actual sets recorded</AppText>
          ) : (
            exercise.sets.map((set) => (
              <AppText key={set.id.value}>
                Performed set {set.position + 1}:{' '}
                {formatWorkoutResult(set.result, unitSystem)}
              </AppText>
            ))
          )}
        </Card>
      ))}
      <AppButton label="Back to History" onPress={onClose} variant="outline" />
    </Screen>
  );
}
