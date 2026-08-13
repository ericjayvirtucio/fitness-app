import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  DomainId,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
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
];

function requiredId(index: number) {
  const result = DomainId.create(uuids[index]);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function recordedSet(index: number, position: number, result: WorkoutResult) {
  const set = WorkoutSet.create({ id: requiredId(index), position, result });
  if (!set.isSuccess) throw new Error('Invalid fixture');
  return set.value;
}

function completedSession(sets: readonly WorkoutSet[]) {
  const exercise = WorkoutSessionExercise.create({
    exerciseNameSnapshot: 'Push-up',
    id: requiredId(1),
    loggingModeSnapshot: 'repetitions',
    plannedPrescriptionSnapshot: null,
    position: 0,
    sets,
    sourceExerciseDefinitionId: requiredId(3),
    sourcePlannedExerciseId: null,
  });
  if (!exercise.isSuccess) throw new Error('Invalid fixture');
  const started = Date.UTC(2026, 7, 8, 4);
  const session = WorkoutSession.create({
    completedAtEpochMilliseconds: started + 600_000,
    exercises: [exercise.value],
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

/**
 * The screen reloads whenever its loader identity changes, so each test holds
 * one stable loader instead of building a new one on every render.
 */
function loader(
  session: WorkoutSession,
  correctSet: Record<string, unknown> = {},
  refreshedWith: readonly WorkoutSession[] = [],
) {
  const reloads = [...refreshedWith];
  const useCases = {
    correctSet: {
      addSet: jest.fn(),
      deleteSet: jest.fn(),
      editSet: jest.fn(),
      ...correctSet,
    },
    getCompleted: {
      execute: () => Promise.resolve(reloads.shift() ?? session),
    },
    getProfile: { execute: () => Promise.resolve(null) },
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
});
