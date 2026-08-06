import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import type {
  WorkoutResult,
  WorkoutSession,
  WorkoutSet,
} from '@fitness/domain';
import { createWorkoutSessionUseCases } from '../../../composition/workout-session';
import {
  AppButton,
  AppText,
  Card,
  LoadingIndicator,
  Screen,
  spacing,
} from '../../../design-system';
import { ExercisePicker } from '../../workout-planner/presentation/ExercisePicker';
import { WorkoutSetForm } from './WorkoutSetForm';

type UseCases = Awaited<ReturnType<typeof createWorkoutSessionUseCases>>;
type Editor = Readonly<{ exerciseId: string; set?: WorkoutSet }>;

export function WorkoutSessionScreen({
  loadUseCases = createWorkoutSessionUseCases,
  onClose,
}: Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onClose: () => void;
}>) {
  const [useCases, setUseCases] = useState<UseCases>();
  const [session, setSession] = useState<WorkoutSession | null>();
  const [editor, setEditor] = useState<Editor>();
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    void loadUseCases()
      .then(async (loaded) => {
        setUseCases(loaded);
        setSession(await loaded.getActive.execute());
      })
      .catch(() => setError('Active workout could not be loaded.'));
  }, [loadUseCases]);
  useFocusEffect(load);

  if (error && session === undefined)
    return (
      <Screen accessibilityLabel="Active workout error" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Workout unavailable
        </AppText>
        <AppText color="secondary">{error}</AppText>
        <AppButton label="Try Again" onPress={load} />
      </Screen>
    );
  if (session === undefined || !useCases)
    return (
      <Screen accessibilityLabel="Loading active workout" isCentered>
        <LoadingIndicator label="Loading active workout" />
      </Screen>
    );
  if (session === null)
    return (
      <Screen accessibilityLabel="No active workout" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          No active workout
        </AppText>
        <AppButton label="Back to Workout" onPress={onClose} />
      </Screen>
    );

  const refresh = async () => setSession(await useCases.getActive.execute());
  const saveSet = async (result: WorkoutResult) => {
    if (!editor) return;
    const outcome = editor.set
      ? await useCases.mutations.updateSet(
          session.id.value,
          editor.exerciseId,
          editor.set.id.value,
          result,
        )
      : await useCases.mutations.addSet(
          session.id.value,
          editor.exerciseId,
          result,
        );
    if (!outcome.isSuccess) throw new Error('Set was rejected');
    setEditor(undefined);
    await refresh();
  };

  return (
    <Screen contentContainerStyle={{ gap: spacing.xl }} isKeyboardAware>
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          {session.name}
        </AppText>
        <AppText color="secondary">
          Started{' '}
          {new Date(session.startedAtEpochMilliseconds).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </AppText>
        <AppText color="secondary">
          Confirmed sets save immediately on this device.
        </AppText>
      </View>
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : null}

      {isAddingExercise ? (
        <ExercisePicker
          browse={useCases.browseExercises}
          onCancel={() => setIsAddingExercise(false)}
          onSelect={(item) => {
            void useCases.mutations
              .addExercise(session.id.value, item.definition.id.value)
              .then(async (outcome) => {
                if (!outcome.isSuccess) throw new Error('Exercise rejected');
                setIsAddingExercise(false);
                await refresh();
              })
              .catch(() => setError('Exercise could not be added.'));
          }}
        />
      ) : null}

      {session.exercises.map((exercise) => (
        <View key={exercise.id.value} style={styles.exerciseSpacing}>
          <Card variant="outlined">
            <AppText accessibilityRole="header" variant="heading">
              {exercise.exerciseNameSnapshot}
            </AppText>
            {exercise.plannedPrescriptionSnapshot ? (
              <AppText color="secondary">
                Planned: {formatPlanned(exercise.plannedPrescriptionSnapshot)}
              </AppText>
            ) : null}
            {exercise.sets.length === 0 ? (
              <AppText color="secondary">No actual sets recorded</AppText>
            ) : null}
            {exercise.sets.map((set) => (
              <View key={set.id.value} style={styles.setRow}>
                <AppText>
                  Set {set.position + 1}: {formatResult(set.result)}
                </AppText>
                <AppButton
                  accessibilityLabel={`Edit set ${set.position + 1} for ${exercise.exerciseNameSnapshot}`}
                  label="Edit"
                  onPress={() =>
                    setEditor({ exerciseId: exercise.id.value, set })
                  }
                  variant="ghost"
                />
                <AppButton
                  accessibilityLabel={`Delete set ${set.position + 1} for ${exercise.exerciseNameSnapshot}`}
                  label="Delete"
                  onPress={() =>
                    Alert.alert(
                      'Delete set?',
                      'This removes the recorded set.',
                      [
                        { style: 'cancel', text: 'Cancel' },
                        {
                          onPress: () => {
                            void useCases.mutations
                              .deleteSet(
                                session.id.value,
                                exercise.id.value,
                                set.id.value,
                              )
                              .then(refresh)
                              .catch(() =>
                                setError('Set could not be deleted.'),
                              );
                          },
                          style: 'destructive',
                          text: 'Delete Set',
                        },
                      ],
                    )
                  }
                  variant="ghost"
                />
              </View>
            ))}
            {editor?.exerciseId === exercise.id.value ? (
              <WorkoutSetForm
                {...(editor.set ? { initial: editor.set.result } : {})}
                loggingMode={exercise.loggingModeSnapshot}
                onCancel={() => setEditor(undefined)}
                onSave={saveSet}
              />
            ) : (
              <AppButton
                label={`Add Set for ${exercise.exerciseNameSnapshot}`}
                onPress={() => setEditor({ exerciseId: exercise.id.value })}
                variant="outline"
              />
            )}
            <AppButton
              accessibilityLabel={`Remove ${exercise.exerciseNameSnapshot} from workout`}
              label="Remove Exercise"
              onPress={() => {
                const remove = () => {
                  void useCases.mutations
                    .removeExercise(session.id.value, exercise.id.value)
                    .then(refresh)
                    .catch(() => setError('Exercise could not be removed.'));
                };
                if (exercise.sets.length > 0) {
                  Alert.alert(
                    'Remove exercise?',
                    'Its recorded sets will also be deleted.',
                    [
                      { style: 'cancel', text: 'Cancel' },
                      {
                        onPress: remove,
                        style: 'destructive',
                        text: 'Remove Exercise',
                      },
                    ],
                  );
                } else remove();
              }}
              variant="ghost"
            />
          </Card>
        </View>
      ))}

      {!isAddingExercise ? (
        <AppButton
          label="Add Exercise"
          onPress={() => setIsAddingExercise(true)}
          variant="outline"
        />
      ) : null}
      <AppButton
        label="Finish Workout"
        onPress={() =>
          Alert.alert(
            'Finish workout?',
            'Completed workouts become read-only history.',
            [
              { style: 'cancel', text: 'Keep Working Out' },
              {
                onPress: () => {
                  void useCases.finish
                    .execute(session.id.value)
                    .then((outcome) => {
                      if (!outcome.isSuccess) {
                        setError(
                          'Record at least one valid set before finishing.',
                        );
                        return;
                      }
                      onClose();
                    })
                    .catch(() => setError('Workout could not be finished.'));
                },
                text: 'Finish Workout',
              },
            ],
          )
        }
      />
      <AppButton
        label="Discard Workout"
        onPress={() =>
          Alert.alert(
            'Discard workout?',
            'All recorded sets in this workout will be permanently removed.',
            [
              { style: 'cancel', text: 'Cancel' },
              {
                onPress: () => {
                  void useCases.discard
                    .execute(session.id.value)
                    .then(onClose)
                    .catch(() => setError('Workout could not be discarded.'));
                },
                style: 'destructive',
                text: 'Discard Workout',
              },
            ],
          )
        }
        variant="danger"
      />
    </Screen>
  );
}

function formatResult(result: WorkoutResult): string {
  if (result.kind === 'repetitions') return `${result.repetitions} reps`;
  if (result.kind === 'resistance-and-repetitions')
    return `${result.resistance.in('kilogram')} kg × ${result.repetitions}`;
  if (result.kind === 'duration') return `${result.duration.seconds} sec`;
  if (result.kind === 'distance')
    return `${result.distance.in('kilometer')} km`;
  return `${result.distance.in('kilometer')} km in ${result.duration.seconds} sec`;
}

function formatPlanned(
  planned: WorkoutSession['exercises'][number]['plannedPrescriptionSnapshot'],
): string {
  if (!planned) return '';
  const parts = [`${planned.sets} sets`];
  if ('repetitions' in planned) parts.push(`${planned.repetitions} reps`);
  if ('resistance' in planned && planned.resistance)
    parts.push(`${planned.resistance.in('kilogram')} kg`);
  if ('duration' in planned) parts.push(`${planned.duration.seconds} sec`);
  if ('distance' in planned)
    parts.push(`${planned.distance.in('kilometer')} km`);
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  exerciseSpacing: { marginTop: spacing.md },
  setRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
