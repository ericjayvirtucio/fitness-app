import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { workoutSessionPolicy, type WorkoutSession } from '@fitness/domain';
import { createWorkoutNameUseCases } from '../../../composition/workout-name';
import {
  AppButton,
  AppText,
  LoadingIndicator,
  Screen,
  spacing,
  TextField,
} from '../../../design-system';
import type { RenameWorkoutSessionUseCase } from '../application/rename-workout-session-use-case';
import { workoutSessionLifecycle } from '../application/rename-workout-session-use-case';
import type { GetWorkoutSessionUseCase } from '../application/workout-session-use-cases';
import {
  renameExplanation,
  renameFailureMessage,
  workoutRenameRefusalMessage,
} from './workout-rename-messages';

/**
 * What this screen needs, rather than what its composition root builds. Stated
 * structurally so a test can stand in for either use case without reaching for
 * a construction it never exercises.
 */
type UseCases = Readonly<{
  getSession: Pick<GetWorkoutSessionUseCase, 'execute'>;
  rename: Pick<RenameWorkoutSessionUseCase, 'execute'>;
}>;

/**
 * The one place a workout is named, reached from an active workout and from
 * completed history alike.
 *
 * The lifecycle the rename is guarded against is taken from the workout this
 * screen actually loaded, never from a route parameter, so a workout finished
 * or deleted between opening history and saving a name is refused rather than
 * renamed.
 */
export function WorkoutNameScreen({
  id,
  loadUseCases = createWorkoutNameUseCases,
  onCancel,
  onRenamed,
}: Readonly<{
  id: string;
  loadUseCases?: () => Promise<UseCases>;
  onCancel: () => void;
  onRenamed: () => void;
}>) {
  const [useCases, setUseCases] = useState<UseCases>();
  const [session, setSession] = useState<WorkoutSession | null>();
  const [name, setName] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const load = useCallback(() => {
    void loadUseCases()
      .then(async (loaded) => {
        setUseCases(loaded);
        const loadedSession = await loaded.getSession.execute(id);
        setSession(loadedSession);
        setName((entered) => entered ?? loadedSession?.name ?? '');
      })
      .catch(() => setSession(null));
  }, [id, loadUseCases]);
  useFocusEffect(load);

  if (session === undefined || !useCases)
    return (
      <Screen accessibilityLabel="Loading workout name" isCentered>
        <LoadingIndicator label="Loading workout name" />
      </Screen>
    );
  if (session === null)
    return (
      <Screen accessibilityLabel="Workout name unavailable" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Workout unavailable
        </AppText>
        <AppText color="secondary">
          This workout is no longer available.
        </AppText>
        <AppButton label="Go Back" onPress={onCancel} />
      </Screen>
    );

  const save = () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(undefined);
    useCases.rename
      .execute({
        expected: workoutSessionLifecycle(session),
        name: name ?? '',
        sessionId: session.id.value,
      })
      .then((outcome) => {
        if (outcome.status === 'renamed') {
          onRenamed();
          return;
        }
        setIsSaving(false);
        setError(workoutRenameRefusalMessage(outcome.reason));
      })
      .catch(() => {
        setIsSaving(false);
        setError(renameFailureMessage);
      });
  };

  return (
    <Screen
      accessibilityLabel="Rename workout"
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Rename workout
        </AppText>
        <AppText color="secondary">{renameExplanation}</AppText>
      </View>
      <TextField
        autoCapitalize="words"
        label="Workout name"
        maxLength={workoutSessionPolicy.maximumNameLength}
        onChangeText={setName}
        testID="workout-name"
        value={name ?? ''}
      />
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : null}
      <AppButton
        accessibilityLabel="Save Name"
        isLoading={isSaving}
        label="Save Name"
        onPress={save}
      />
      <AppButton
        accessibilityLabel="Cancel"
        disabled={isSaving}
        label="Cancel"
        onPress={onCancel}
        variant="outline"
      />
    </Screen>
  );
}
