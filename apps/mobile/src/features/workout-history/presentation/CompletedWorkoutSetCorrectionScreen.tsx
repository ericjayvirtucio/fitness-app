import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type {
  UnitSystem,
  WorkoutResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '@fitness/domain';
import { createWorkoutHistoryUseCases } from '../../../composition/workout-history';
import {
  AppButton,
  AppText,
  Card,
  describeCardContents,
  LoadingIndicator,
  Screen,
  spacing,
} from '../../../design-system';
import { WorkoutSetForm } from '../../workout-session/presentation/WorkoutSetForm';
import {
  formatPlannedWorkoutResult,
  formatWorkoutResult,
} from '../../workout-session/presentation/workout-result-formatting';
import {
  fingerprintRecordedSet,
  type CompletedSetCorrectionOutcome,
} from '../application/correct-completed-workout-set-use-case';
import { correctionRefusalMessage } from './completed-workout-correction-messages';

type UseCases = Awaited<ReturnType<typeof createWorkoutHistoryUseCases>>;

type Loaded = Readonly<{
  exercise: WorkoutSessionExercise;
  session: WorkoutSession;
  set: WorkoutSet | null;
  unitSystem: UnitSystem;
  useCases: UseCases;
}>;

/**
 * Edits one recorded result, or adds a set that was never recorded, inside a
 * completed workout. Everything it shows and validates comes from the captured
 * snapshots, so a deleted Exercise Catalog definition or planned workout never
 * blocks a correction.
 */
export function CompletedWorkoutSetCorrectionScreen({
  exerciseId,
  loadUseCases = createWorkoutHistoryUseCases,
  onDone,
  sessionId,
  setId,
}: Readonly<{
  exerciseId: string;
  loadUseCases?: () => Promise<UseCases>;
  onDone: () => void;
  sessionId: string;
  setId?: string;
}>) {
  const [loaded, setLoaded] = useState<Loaded | null>();
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    let isCurrent = true;
    void loadUseCases()
      .then(async (useCases) => {
        const [session, profile] = await Promise.all([
          useCases.getCompleted.execute(sessionId),
          useCases.getProfile.execute(),
        ]);
        if (!isCurrent) return;
        const exercise = session?.exercises.find(
          (candidate) => candidate.id.value === exerciseId,
        );
        const set =
          setId === undefined
            ? null
            : exercise?.sets.find((candidate) => candidate.id.value === setId);
        if (!session || !exercise || (setId !== undefined && !set)) {
          setLoaded(null);
          return;
        }
        setLoaded({
          exercise,
          session,
          set: set ?? null,
          unitSystem: profile?.preferredUnitSystem ?? 'metric',
          useCases,
        });
      })
      .catch(() => {
        if (isCurrent) setLoaded(null);
      });
    return () => {
      isCurrent = false;
    };
  }, [exerciseId, loadUseCases, sessionId, setId]);
  useFocusEffect(load);

  if (loaded === undefined)
    return (
      <Screen accessibilityLabel="Loading recorded set" isCentered>
        <LoadingIndicator label="Loading recorded set" />
      </Screen>
    );

  if (loaded === null)
    return (
      <Screen accessibilityLabel="Recorded set unavailable" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Recorded set unavailable
        </AppText>
        <AppText color="secondary">
          This recorded set is no longer part of the completed workout.
        </AppText>
        <AppButton label="Back to Completed Workout" onPress={onDone} />
      </Screen>
    );

  const { exercise, set, unitSystem, useCases } = loaded;
  const isEditing = set !== null;
  /**
   * A labelled card is one accessibility element, so the sentence stating what
   * this screen changes reached nobody while the card announced only its title.
   * The rendered paragraph and the announced one are now the same string.
   */
  const consequence = `${
    isEditing
      ? 'Correcting changes what this workout recorded.'
      : 'Adding records a set this workout did not record.'
  } Personal records and progress may change. The workout stays completed, and its exercise and plan details are unchanged.`;

  const save = async (result: WorkoutResult, repsInReserve: number | null) => {
    const outcome: CompletedSetCorrectionOutcome = isEditing
      ? await useCases.correctSet.editSet({
          exerciseId,
          expected: fingerprintRecordedSet(set),
          repsInReserve,
          result,
          sessionId,
          setId: set.id.value,
        })
      : await useCases.correctSet.addSet({
          exerciseId,
          repsInReserve,
          result,
          sessionId,
        });
    if (outcome.status === 'refused') {
      setError(correctionRefusalMessage(outcome.reason));
      throw new Error('The correction was refused.');
    }
    setError(undefined);
    onDone();
  };

  return (
    <Screen contentContainerStyle={{ gap: spacing.lg }} isKeyboardAware>
      <AppText accessibilityRole="header" variant="display">
        {isEditing ? 'Correct recorded set' : 'Add missing set'}
      </AppText>
      <AppText color="secondary">
        {exercise.exerciseNameSnapshot} · Completed workout ·{' '}
        {loaded.session.startedLocalCalendarDate}
      </AppText>

      <Card
        accessibilityLabel={describeCardContents(
          'What this correction changes',
          [consequence],
        )}
        variant="outlined"
      >
        <AppText>{consequence}</AppText>
      </Card>

      {exercise.plannedPrescriptionSnapshot ? (
        <AppText color="secondary">
          Planned target:{' '}
          {formatPlannedWorkoutResult(
            exercise.plannedPrescriptionSnapshot,
            unitSystem,
            exercise.loggingModeSnapshot,
          )}
        </AppText>
      ) : null}

      {set ? (
        <AppText>
          Currently recorded set {set.position + 1}:{' '}
          {formatWorkoutResult(
            set.result,
            unitSystem,
            exercise.loggingModeSnapshot,
            set.repsInReserve,
          )}
        </AppText>
      ) : null}

      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : null}

      <WorkoutSetForm
        cancelLabel="Cancel Correction"
        heading={isEditing ? 'Edit recorded result' : 'Record the missing set'}
        {...(set
          ? { initial: set.result, initialRepsInReserve: set.repsInReserve }
          : {})}
        loggingMode={exercise.loggingModeSnapshot}
        onCancel={onDone}
        onSave={save}
        saveLabel={isEditing ? 'Save Correction' : 'Save Missing Set'}
        unitSystem={unitSystem}
      />
    </Screen>
  );
}
