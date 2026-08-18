import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  DomainId,
  Mass,
  RepetitionResult,
  ResistanceRepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  type ExerciseLoggingMode,
  type WorkoutResult,
} from '@fitness/domain';
import { CompletedWorkoutScreen } from './CompletedWorkoutScreen';

jest.mock('expo-router', () => ({
  useFocusEffect: (() => {
    const invoked = new WeakSet<() => void>();
    return (callback: () => void) => {
      if (!invoked.has(callback)) {
        invoked.add(callback);
        queueMicrotask(callback);
      }
    };
  })(),
}));

const uuids = [
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440005',
  '550e8400-e29b-41d4-a716-446655440006',
  '550e8400-e29b-41d4-a716-446655440007',
];

function requiredId(index: number) {
  const result = DomainId.create(uuids[index]);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function generatedId(suffix: string) {
  const result = DomainId.create(`550e8400-e29b-41d4-a716-44665544f${suffix}`);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function recordedSet(index: number, position: number, result: WorkoutResult) {
  const set = WorkoutSet.create({ id: requiredId(index), position, result });
  if (!set.isSuccess) throw new Error('Invalid fixture');
  return set.value;
}

function performedExercise(
  index: number,
  position: number,
  name: string,
  sets: readonly WorkoutSet[],
  definitionIndex: number,
) {
  const exercise = WorkoutSessionExercise.create({
    exerciseNameSnapshot: name,
    id: requiredId(index),
    loggingModeSnapshot: 'repetitions',
    plannedPrescriptionSnapshot: null,
    position,
    sets,
    sourceExerciseDefinitionId: requiredId(definitionIndex),
    sourcePlannedExerciseId: null,
  });
  if (!exercise.isSuccess) throw new Error('Invalid fixture');
  return exercise.value;
}

function completedSession(sets: readonly WorkoutSet[]) {
  return sessionOf([performedExercise(1, 0, 'Push-up', sets, 3)]);
}

function sessionOf(exercises: readonly WorkoutSessionExercise[]) {
  const started = Date.UTC(2026, 7, 8, 4);
  const session = WorkoutSession.create({
    completedAtEpochMilliseconds: started + 600_000,
    exercises,
    id: requiredId(0),
    name: 'Workout',
    sourcePlannedWorkoutId: null,
    sourceWeekday: null,
    startedAtEpochMilliseconds: started,
    startedLocalCalendarDate: '2026-08-08',
    startedUtcOffsetMinutes: 0,
    status: 'completed',
  });
  if (!session.isSuccess) throw new Error('Invalid fixture');
  return session.value;
}

const oneSet = () => [recordedSet(2, 0, RepetitionResult.valid(12))];
const twoSets = () => [
  recordedSet(2, 0, RepetitionResult.valid(12)),
  recordedSet(4, 1, RepetitionResult.valid(10)),
];

const squat = (sets: readonly WorkoutSet[]) =>
  performedExercise(5, 1, 'Squat', sets, 7);

/** Two performed exercises, so either one can be removed. */
const twoExerciseSession = () =>
  sessionOf([
    performedExercise(1, 0, 'Push-up', oneSet(), 3),
    squat([recordedSet(6, 0, RepetitionResult.valid(20))]),
  ]);

/**
 * A resistance result carries no clue about what its mass means, so the exercise
 * that holds it has to be built with the logging mode under test.
 */
function resistanceExercise(
  index: number,
  position: number,
  name: string,
  loggingMode: ExerciseLoggingMode,
  setIndex: number,
) {
  const mass = Mass.create(20, 'kilogram');
  if (!mass.isSuccess) throw new Error('Invalid fixture');
  const exercise = WorkoutSessionExercise.create({
    exerciseNameSnapshot: name,
    id: requiredId(index),
    loggingModeSnapshot: loggingMode,
    plannedPrescriptionSnapshot: null,
    position,
    sets: [
      recordedSet(setIndex, 0, ResistanceRepetitionResult.valid(mass.value, 8)),
    ],
    sourceExerciseDefinitionId: requiredId(3),
    sourcePlannedExerciseId: null,
  });
  if (!exercise.isSuccess) throw new Error('Invalid fixture');
  return exercise.value;
}

/** A workout already holding the most exercises one may hold. */
function fullWorkoutExercises() {
  return Array.from({ length: 100 }, (_, position) => {
    const exercise = WorkoutSessionExercise.create({
      exerciseNameSnapshot: `Exercise ${position + 1}`,
      id: generatedId(String(position).padStart(3, '0')),
      loggingModeSnapshot: 'repetitions',
      plannedPrescriptionSnapshot: null,
      position,
      sets: position === 0 ? oneSet() : [],
      sourceExerciseDefinitionId: requiredId(3),
      sourcePlannedExerciseId: null,
    });
    if (!exercise.isSuccess) throw new Error('Invalid fixture');
    return exercise.value;
  });
}

/** A performed exercise beside one whose sets were all corrected away. */
const sessionWithEmptyExercise = () =>
  sessionOf([performedExercise(1, 0, 'Push-up', oneSet(), 3), squat([])]);

/**
 * The screen reloads whenever its loader identity changes, so each test holds
 * one stable loader instead of building a new one on every render.
 */
function loader(
  session: WorkoutSession,
  correctSet: Record<string, unknown> = {},
  refreshedWith: readonly (WorkoutSession | null)[] = [],
  deleteCompleted: jest.Mock = jest.fn(),
  removeCompletedExercise: jest.Mock = jest.fn(),
) {
  const reloads = [...refreshedWith];
  const useCases = {
    correctSet: {
      addSet: jest.fn(),
      deleteSet: jest.fn(),
      editSet: jest.fn(),
      ...correctSet,
    },
    deleteCompleted: { execute: deleteCompleted },
    getCompleted: {
      execute: () =>
        Promise.resolve(reloads.length > 0 ? reloads.shift() : session),
    },
    getProfile: { execute: () => Promise.resolve(null) },
    removeCompletedExercise: { execute: removeCompletedExercise },
  } as never;
  return () => Promise.resolve(useCases);
}

function confirmDestructiveAlert() {
  return jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });
}

describe('CompletedWorkoutScreen', () => {
  it('shows captured snapshot names and performed actual sets', async () => {
    const loadUseCases = loader(completedSession(oneSet()));
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Push-up')).toBeOnTheScreen());
    expect(screen.getByText('Performed set 1: 12 reps')).toBeOnTheScreen();
  });

  it('announces the summary card contents it displays', async () => {
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader(completedSession(twoSets()))}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('2 actual sets')).toBeOnTheScreen(),
    );
    expect(screen.getByText('10 min 0 sec workout time')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Completed workout summary, 2 actual sets, 10 min 0 sec workout time',
      ),
    ).toBeOnTheScreen();
  });

  it('offers correction entry points for each recorded set and exercise', async () => {
    const loadUseCases = loader(completedSession(twoSets()));
    const onAddSet = jest.fn();
    const onCorrectSet = jest.fn();
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onAddSet={onAddSet}
        onClose={jest.fn()}
        onCorrectSet={onCorrectSet}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Correct recorded set 1 for Push-up'),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.getByLabelText('Delete recorded set 2 for Push-up'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Add missing set for Push-up'),
    ).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByLabelText('Correct recorded set 1 for Push-up'),
    );
    await waitFor(() =>
      expect(onCorrectSet).toHaveBeenCalledWith(uuids[1], uuids[2]),
    );

    await fireEvent.press(screen.getByLabelText('Add missing set for Push-up'));
    await waitFor(() => expect(onAddSet).toHaveBeenCalledWith(uuids[1]));
  });

  it('explains in words why the only recorded set cannot be deleted', async () => {
    const loadUseCases = loader(completedSession(oneSet()));
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
        onCorrectSet={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/only recorded set in this workout/),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.queryByLabelText('Delete recorded set 1 for Push-up'),
    ).not.toBeOnTheScreen();
  });

  it('deletes a recorded set after the destructive confirmation', async () => {
    const alert = confirmDestructiveAlert();
    const deleteSet = jest.fn().mockResolvedValue({
      session: completedSession(oneSet()),
      status: 'corrected',
    });
    const loadUseCases = loader(completedSession(twoSets()), { deleteSet }, [
      completedSession(twoSets()),
      completedSession(oneSet()),
    ]);
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Delete recorded set 1 for Push-up'),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByLabelText('Delete recorded set 1 for Push-up'),
    );

    await waitFor(() => expect(deleteSet).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText('1 actual sets')).toBeOnTheScreen(),
    );
    expect(deleteSet).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId: uuids[1],
        expected: {
          distanceMillimeters: null,
          durationSeconds: null,
          kind: 'repetitions',
          repetitions: 12,
          resistanceGrams: null,
        },
        sessionId: uuids[0],
        setId: uuids[2],
      }),
    );
    alert.mockRestore();
  });

  it('states a refused deletion without exposing anything recorded', async () => {
    const alert = confirmDestructiveAlert();
    const deleteSet = jest
      .fn()
      .mockResolvedValue({ reason: 'changed', status: 'refused' });
    const loadUseCases = loader(completedSession(twoSets()), { deleteSet });
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Delete recorded set 1 for Push-up'),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByLabelText('Delete recorded set 1 for Push-up'),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/changed since this screen opened/),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByText('Performed set 1: 12 reps')).toBeOnTheScreen();
    alert.mockRestore();
  });

  it('offers whole-workout deletion only when the route supports it', async () => {
    const loadUseCases = loader(completedSession(oneSet()));
    const { rerender } = await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Push-up')).toBeOnTheScreen());
    expect(
      screen.queryByTestId('delete-completed-workout'),
    ).not.toBeOnTheScreen();

    await rerender(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('delete-completed-workout')).toBeOnTheScreen(),
    );
    expect(
      screen.getByLabelText('Delete this workout, Workout, August 8, 2026'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/cannot be undone/)).toBeOnTheScreen();
  });

  it('names the workout in the confirmation and keeps it when cancelled', async () => {
    const deleteCompleted = jest.fn();
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.[0]?.onPress?.();
      });
    const loadUseCases = loader(
      completedSession(oneSet()),
      {},
      [],
      deleteCompleted,
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('delete-completed-workout')).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByTestId('delete-completed-workout'));

    expect(alert).toHaveBeenCalledWith(
      'Delete Workout?',
      expect.stringContaining('cannot be recovered'),
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel', text: 'Cancel' }),
        expect.objectContaining({
          style: 'destructive',
          text: 'Delete Workout',
        }),
      ]),
    );
    expect(deleteCompleted).not.toHaveBeenCalled();
    expect(screen.getByText('Performed set 1: 12 reps')).toBeOnTheScreen();
    alert.mockRestore();
  });

  it('leaves the deleted detail once the workout is gone', async () => {
    const alert = confirmDestructiveAlert();
    const deleteCompleted = jest.fn().mockResolvedValue({ status: 'deleted' });
    const onDeleted = jest.fn();
    const loadUseCases = loader(
      completedSession(oneSet()),
      {},
      [],
      deleteCompleted,
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
        onDeleted={onDeleted}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('delete-completed-workout')).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByTestId('delete-completed-workout'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteCompleted).toHaveBeenCalledWith({
      expected: {
        completedAtEpochMilliseconds: Date.UTC(2026, 7, 8, 4) + 600_000,
        startedAtEpochMilliseconds: Date.UTC(2026, 7, 8, 4),
      },
      sessionId: uuids[0],
    });
    alert.mockRestore();
  });

  it('states a refused workout deletion without exposing anything recorded', async () => {
    const alert = confirmDestructiveAlert();
    const deleteCompleted = jest
      .fn()
      .mockResolvedValue({ reason: 'not-found', status: 'refused' });
    const onDeleted = jest.fn();
    const loadUseCases = loader(
      completedSession(oneSet()),
      {},
      [completedSession(oneSet()), null],
      deleteCompleted,
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
        onDeleted={onDeleted}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('delete-completed-workout')).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByTestId('delete-completed-workout'));

    await waitFor(() =>
      expect(
        screen.getByText('Completed workout unavailable'),
      ).toBeOnTheScreen(),
    );
    expect(onDeleted).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('keeps the workout visible and disables retry while a deletion fails', async () => {
    const alert = confirmDestructiveAlert();
    const deleteCompleted = jest
      .fn()
      .mockRejectedValue(new Error('storage unavailable'));
    const loadUseCases = loader(
      completedSession(oneSet()),
      {},
      [],
      deleteCompleted,
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('delete-completed-workout')).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByTestId('delete-completed-workout'));

    await waitFor(() =>
      expect(screen.getByText(/could not be deleted/)).toBeOnTheScreen(),
    );
    expect(screen.getByText('Performed set 1: 12 reps')).toBeOnTheScreen();
    expect(deleteCompleted).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('ignores a repeated request while the first deletion is in flight', async () => {
    const alert = confirmDestructiveAlert();
    const deleteCompleted = jest.fn().mockReturnValue(new Promise(() => {}));
    const loadUseCases = loader(
      completedSession(oneSet()),
      {},
      [],
      deleteCompleted,
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('delete-completed-workout')).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByTestId('delete-completed-workout'));
    await fireEvent.press(screen.getByTestId('delete-completed-workout'));

    expect(deleteCompleted).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('offers removal on each exercise while another one holds recorded work', async () => {
    const loadUseCases = loader(twoExerciseSession());
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Remove exercise 1, Push-up, from this workout'),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
    ).toBeOnTheScreen();
  });

  it('explains in words why the only performing exercise cannot be removed', async () => {
    const loadUseCases = loader(completedSession(twoSets()));
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/only recorded sets in this workout/),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.queryByLabelText('Remove exercise 1, Push-up, from this workout'),
    ).not.toBeOnTheScreen();
  });

  it('says an exercise recorded nothing and still offers to remove it', async () => {
    const loadUseCases = loader(sessionWithEmptyExercise());
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/This exercise recorded nothing/),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
    ).toBeOnTheScreen();
  });

  it('names the exercise and its recorded sets in the confirmation and keeps it when cancelled', async () => {
    const removeCompletedExercise = jest.fn();
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.[0]?.onPress?.();
      });
    const loadUseCases = loader(
      twoExerciseSession(),
      {},
      [],
      jest.fn(),
      removeCompletedExercise,
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
    );

    expect(alert).toHaveBeenCalledWith(
      'Remove Squat?',
      expect.stringContaining('Its 1 recorded set is removed'),
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel', text: 'Cancel' }),
        expect.objectContaining({
          style: 'destructive',
          text: 'Remove Exercise',
        }),
      ]),
    );
    expect(removeCompletedExercise).not.toHaveBeenCalled();
    expect(screen.getByText('Squat')).toBeOnTheScreen();
    alert.mockRestore();
  });

  it('removes one exercise and refreshes the detail in place', async () => {
    const alert = confirmDestructiveAlert();
    const removeCompletedExercise = jest.fn().mockResolvedValue({
      session: completedSession(oneSet()),
      status: 'removed',
    });
    const loadUseCases = loader(
      twoExerciseSession(),
      {},
      [twoExerciseSession(), completedSession(oneSet())],
      jest.fn(),
      removeCompletedExercise,
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
    );

    await waitFor(() =>
      expect(screen.getByText(/Exercise removed/)).toBeOnTheScreen(),
    );
    expect(removeCompletedExercise).toHaveBeenCalledWith({
      exerciseId: uuids[5],
      expected: {
        completedAtEpochMilliseconds: Date.UTC(2026, 7, 8, 4) + 600_000,
        startedAtEpochMilliseconds: Date.UTC(2026, 7, 8, 4),
      },
      sessionId: uuids[0],
    });
    expect(screen.queryByText('Squat')).not.toBeOnTheScreen();
    expect(screen.getByText('Push-up')).toBeOnTheScreen();
    alert.mockRestore();
  });

  it('states a refused removal without exposing anything recorded', async () => {
    const alert = confirmDestructiveAlert();
    const removeCompletedExercise = jest
      .fn()
      .mockResolvedValue({ reason: 'changed', status: 'refused' });
    const loadUseCases = loader(
      twoExerciseSession(),
      {},
      [],
      jest.fn(),
      removeCompletedExercise,
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/changed since this screen opened/),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByText('Squat')).toBeOnTheScreen();
    alert.mockRestore();
  });

  it('keeps the detail visible when a removal fails', async () => {
    const alert = confirmDestructiveAlert();
    const removeCompletedExercise = jest
      .fn()
      .mockRejectedValue(new Error('storage unavailable'));
    const loadUseCases = loader(
      twoExerciseSession(),
      {},
      [],
      jest.fn(),
      removeCompletedExercise,
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
    );

    await waitFor(() =>
      expect(screen.getByText(/could not be removed/)).toBeOnTheScreen(),
    );
    expect(screen.getByText('Squat')).toBeOnTheScreen();
    expect(removeCompletedExercise).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('ignores a repeated request while the first removal is in flight', async () => {
    const alert = confirmDestructiveAlert();
    const removeCompletedExercise = jest
      .fn()
      .mockReturnValue(new Promise(() => {}));
    const loadUseCases = loader(
      twoExerciseSession(),
      {},
      [],
      jest.fn(),
      removeCompletedExercise,
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
    );
    await fireEvent.press(
      screen.getByLabelText('Remove exercise 2, Squat, from this workout'),
    );

    expect(removeCompletedExercise).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('offers exercise addition only when completed history asks for it', async () => {
    const onAddExercise = jest.fn();
    const loadUseCases = loader(completedSession(oneSet()));
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onAddExercise={onAddExercise}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('add-completed-workout-exercise'),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.getByText(/Add work you performed in this workout/),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('add-completed-workout-exercise'));
    await waitFor(() => expect(onAddExercise).toHaveBeenCalled());
  });

  it('hides exercise addition when completed history does not offer it', async () => {
    const loadUseCases = loader(completedSession(oneSet()));
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Push-up')).toBeOnTheScreen());
    expect(
      screen.queryByTestId('add-completed-workout-exercise'),
    ).not.toBeOnTheScreen();
  });

  it('announces an addition once the detail is showing it', async () => {
    const loadUseCases = loader(completedSession(oneSet()));
    await render(
      <CompletedWorkoutScreen
        hasAddedExercise
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onAddExercise={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText('Exercise added to this completed workout.'),
      ).toBeOnTheScreen(),
    );
  });

  it('says what a recorded mass means for each resistance logging mode', async () => {
    const loadUseCases = loader(
      sessionOf([
        resistanceExercise(
          1,
          0,
          'Assisted pull-up',
          'assistance-and-repetitions',
          2,
        ),
        resistanceExercise(
          5,
          1,
          'Weighted dip',
          'bodyweight-plus-load-and-repetitions',
          6,
        ),
        resistanceExercise(
          4,
          2,
          'Bench press',
          'external-load-and-repetitions',
          7,
        ),
      ]),
    );
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText('Performed set 1: Assistance 20 kg × 8'),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.getByText('Performed set 1: Added 20 kg × 8'),
    ).toBeOnTheScreen();
    // The unmarked sentence stays unmarked, because a mass beside repetitions
    // already means the mass that was lifted.
    expect(screen.getByText('Performed set 1: 20 kg × 8')).toBeOnTheScreen();
  });

  it('explains in words why a full workout cannot take another exercise', async () => {
    const loadUseCases = loader(sessionOf(fullWorkoutExercises()));
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={loadUseCases}
        onAddExercise={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/most exercises a workout can keep/),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.queryByTestId('add-completed-workout-exercise'),
    ).not.toBeOnTheScreen();
  });
});
