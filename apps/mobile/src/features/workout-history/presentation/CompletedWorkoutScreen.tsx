import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import type {
  UnitSystem,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '@fitness/domain';
import { createWorkoutHistoryUseCases } from '../../../composition/workout-history';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  SectionHeader,
  spacing,
} from '../../../design-system';
import {
  formatDuration,
  formatPlannedWorkoutResult,
  formatWorkoutResult,
} from '../../workout-session/presentation/workout-result-formatting';
import { fingerprintRecordedSet } from '../application/correct-completed-workout-set-use-case';
import { completedWorkoutLifecycle } from '../application/delete-completed-workout-use-case';
import {
  blockedDeletionExplanation,
  correctionDeleteFailureMessage,
  correctionRefusalMessage,
} from './completed-workout-correction-messages';
import {
  completedWorkoutDeletionRefusalMessage,
  deletionConfirmationBody,
  deletionExplanation,
  deletionFailureMessage,
} from './completed-workout-deletion-messages';
import { formatCapturedDate } from './workout-history-formatting';

type UseCases = Awaited<ReturnType<typeof createWorkoutHistoryUseCases>>;

export function CompletedWorkoutScreen({
  id,
  loadUseCases = createWorkoutHistoryUseCases,
  onAddSet,
  onClose,
  onCorrectSet,
  onDeleted,
}: Readonly<{
  id: string;
  loadUseCases?: () => Promise<UseCases>;
  onAddSet?: (exerciseId: string) => void;
  onClose: () => void;
  onCorrectSet?: (exerciseId: string, setId: string) => void;
  onDeleted?: () => void;
}>) {
  const [useCases, setUseCases] = useState<UseCases>();
  const [session, setSession] = useState<WorkoutSession | null>();
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [error, setError] = useState<string>();
  const [isDeleting, setIsDeleting] = useState(false);
  const load = useCallback(() => {
    void loadUseCases()
      .then(async (loaded) => {
        setUseCases(loaded);
        const [completed, profile] = await Promise.all([
          loaded.getCompleted.execute(id),
          loaded.getProfile.execute(),
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
  const isLastRecordedSet = actualSetCount === 1;

  const refresh = async () => {
    if (!useCases) return;
    setSession(await useCases.getCompleted.execute(id));
  };

  const deleteSet = (exercise: WorkoutSessionExercise, set: WorkoutSet) => {
    if (!useCases) return;
    void useCases.correctSet
      .deleteSet({
        exerciseId: exercise.id.value,
        expected: fingerprintRecordedSet(set.result),
        sessionId: session.id.value,
        setId: set.id.value,
      })
      .then(async (outcome) => {
        // A refusal is reloaded too, because the usual reason one arrives is
        // that this screen is showing something history no longer holds.
        setError(
          outcome.status === 'refused'
            ? correctionRefusalMessage(outcome.reason)
            : undefined,
        );
        await refresh();
      })
      .catch(() => setError(correctionDeleteFailureMessage));
  };

  const deleteWorkout = () => {
    const lifecycle = completedWorkoutLifecycle(session);
    if (!useCases || lifecycle === null || isDeleting) return;
    setIsDeleting(true);
    void useCases.deleteCompleted
      .execute({ expected: lifecycle, sessionId: session.id.value })
      .then(async (outcome) => {
        if (outcome.status === 'deleted') {
          onDeleted?.();
          return;
        }
        // A refusal usually means this screen is showing something history no
        // longer holds, so the detail is reloaded rather than left stale.
        setIsDeleting(false);
        setError(completedWorkoutDeletionRefusalMessage(outcome.reason));
        await refresh();
      })
      .catch(() => {
        setIsDeleting(false);
        setError(deletionFailureMessage);
      });
  };

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
              <View key={set.id.value} style={styles.setRow}>
                <AppText>
                  Performed set {set.position + 1}:{' '}
                  {formatWorkoutResult(set.result, unitSystem)}
                </AppText>
                {onCorrectSet ? (
                  <AppButton
                    accessibilityLabel={`Correct recorded set ${set.position + 1} for ${exercise.exerciseNameSnapshot}`}
                    label="Correct"
                    onPress={() =>
                      onCorrectSet(exercise.id.value, set.id.value)
                    }
                    variant="ghost"
                  />
                ) : null}
                {isLastRecordedSet ? (
                  <AppText color="secondary">
                    {blockedDeletionExplanation}
                  </AppText>
                ) : (
                  <AppButton
                    accessibilityLabel={`Delete recorded set ${set.position + 1} for ${exercise.exerciseNameSnapshot}`}
                    label="Delete"
                    onPress={() =>
                      Alert.alert(
                        'Delete this recorded set?',
                        'The recorded set is removed from this completed workout and cannot be recovered. Personal records and progress may change.',
                        [
                          { style: 'cancel', text: 'Cancel' },
                          {
                            onPress: () => deleteSet(exercise, set),
                            style: 'destructive',
                            text: 'Delete Recorded Set',
                          },
                        ],
                      )
                    }
                    variant="ghost"
                  />
                )}
              </View>
            ))
          )}
          {onAddSet ? (
            <AppButton
              accessibilityLabel={`Add missing set for ${exercise.exerciseNameSnapshot}`}
              label="Add Missing Set"
              onPress={() => onAddSet(exercise.id.value)}
              variant="outline"
            />
          ) : null}
        </Card>
      ))}
      {onDeleted ? (
        <View style={styles.deletion}>
          <SectionHeader title="Delete this workout" />
          <AppText color="secondary">{deletionExplanation}</AppText>
          <AppButton
            accessibilityLabel={`Delete this workout, ${session.name}, ${formatCapturedDate(session.startedLocalCalendarDate)}`}
            disabled={isDeleting}
            label="Delete This Workout"
            onPress={() =>
              Alert.alert(`Delete ${session.name}?`, deletionConfirmationBody, [
                { style: 'cancel', text: 'Cancel' },
                {
                  onPress: deleteWorkout,
                  style: 'destructive',
                  text: 'Delete Workout',
                },
              ])
            }
            testID="delete-completed-workout"
            variant="danger"
          />
        </View>
      ) : null}
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : null}
      <AppButton label="Back to History" onPress={onClose} variant="outline" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  deletion: {
    gap: spacing.sm,
  },
  setRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
