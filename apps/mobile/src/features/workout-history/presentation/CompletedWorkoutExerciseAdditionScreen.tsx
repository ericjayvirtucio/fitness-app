import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type {
  UnitSystem,
  WorkoutResult,
  WorkoutSession,
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
import type { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import { ExercisePicker } from '../../workout-planner/presentation/ExercisePicker';
import { WorkoutSetForm } from '../../workout-session/presentation/WorkoutSetForm';
import { completedWorkoutLifecycle } from '../application/delete-completed-workout-use-case';
import {
  additionFailureMessage,
  additionFirstSetExplanation,
  additionSaveExplanation,
  completedExerciseAdditionRefusalMessage,
} from './completed-exercise-addition-messages';

type UseCases = Awaited<ReturnType<typeof createWorkoutHistoryUseCases>>;

type Loaded = Readonly<{
  session: WorkoutSession;
  unitSystem: UnitSystem;
  useCases: UseCases;
}>;

/**
 * Adds one session exercise, with the first set it performed, to a completed
 * workout.
 *
 * Selection and the first recorded set live on one screen because the exercise
 * and its set are written in a single action: an exercise created first and
 * given a set afterwards would be two writes, and the workout would hold an
 * exercise that recorded nothing in between. Nothing here is destructive, so it
 * saves explicitly instead of asking for a destructive confirmation, exactly as
 * adding a missing set already does.
 */
export function CompletedWorkoutExerciseAdditionScreen({
  id,
  loadUseCases = createWorkoutHistoryUseCases,
  onAdded,
  onDone,
}: Readonly<{
  id: string;
  loadUseCases?: () => Promise<UseCases>;
  onAdded?: () => void;
  onDone: () => void;
}>) {
  const [loaded, setLoaded] = useState<Loaded | null>();
  const [selected, setSelected] = useState<ExerciseCatalogItem>();
  const [error, setError] = useState<string>();
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(() => {
    let isCurrent = true;
    void loadUseCases()
      .then(async (useCases) => {
        const [session, profile] = await Promise.all([
          useCases.getCompleted.execute(id),
          useCases.getProfile.execute(),
        ]);
        if (!isCurrent) return;
        if (!session) {
          setLoaded(null);
          return;
        }
        setLoaded({
          session,
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
  }, [id, loadUseCases]);
  useFocusEffect(load);

  if (loaded === undefined)
    return (
      <Screen accessibilityLabel="Loading completed workout" isCentered>
        <LoadingIndicator label="Loading completed workout" />
      </Screen>
    );

  if (loaded === null)
    return (
      <Screen accessibilityLabel="Completed workout unavailable" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Completed workout unavailable
        </AppText>
        <AppText color="secondary">
          This completed workout could not be found.
        </AppText>
        <AppButton label="Back to Completed Workout" onPress={onDone} />
      </Screen>
    );

  const { session, unitSystem, useCases } = loaded;

  const save = async (result: WorkoutResult, repsInReserve: number | null) => {
    const lifecycle = completedWorkoutLifecycle(session);
    // A second submission would append a second exercise rather than fail, so
    // the guard is a correctness control here rather than a courtesy.
    if (!selected || lifecycle === null || isAdding) {
      setError(additionFailureMessage);
      throw new Error('The addition could not start.');
    }
    setIsAdding(true);
    const outcome = await useCases.addCompletedExercise
      .execute({
        definitionId: selected.definition.id.value,
        expected: lifecycle,
        repsInReserve,
        result,
        sessionId: id,
      })
      .catch(() => {
        setIsAdding(false);
        setError(additionFailureMessage);
        throw new Error('The addition could not be saved.');
      });
    if (outcome.status === 'refused') {
      setIsAdding(false);
      setError(completedExerciseAdditionRefusalMessage(outcome.reason));
      throw new Error('The addition was refused.');
    }
    setError(undefined);
    // The detail announces the addition, because this screen is gone by the
    // time the new exercise is on screen.
    if (onAdded) onAdded();
    else onDone();
  };

  return (
    <Screen contentContainerStyle={{ gap: spacing.lg }} isKeyboardAware>
      <AppText accessibilityRole="header" variant="display">
        Add exercise to this workout
      </AppText>
      <AppText color="secondary">
        {session.name} · Completed workout · {session.startedLocalCalendarDate}
      </AppText>

      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : null}

      {selected ? (
        <>
          <Card
            accessibilityLabel={describeCardContents(
              'What this addition changes',
              [additionSaveExplanation],
            )}
            variant="outlined"
          >
            <AppText>{additionSaveExplanation}</AppText>
          </Card>
          <AppText accessibilityRole="header" variant="heading">
            {selected.definition.name}
          </AppText>
          <AppText color="secondary">{additionFirstSetExplanation}</AppText>
          <WorkoutSetForm
            cancelLabel="Choose A Different Exercise"
            heading="Record what you performed"
            loggingMode={selected.definition.loggingMode}
            onCancel={() => {
              setSelected(undefined);
              setError(undefined);
            }}
            onSave={save}
            saveLabel="Add Exercise And Set"
            unitSystem={unitSystem}
          />
        </>
      ) : (
        <ExercisePicker
          browse={useCases.browseExercises}
          emptyDescription="Create exercises in the Exercise Library before adding them to a completed workout."
          heading="Choose the exercise you performed"
          itemDescription="Record what you performed after choosing it."
          onCancel={onDone}
          onSelect={setSelected}
        />
      )}
    </Screen>
  );
}
