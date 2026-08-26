import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {
  DomainId,
  ExerciseDefinition,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  type ExerciseLoggingMode,
  type Result,
} from '@fitness/domain';
import { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import { additionSaveExplanation } from './completed-exercise-addition-messages';
import { CompletedWorkoutExerciseAdditionScreen } from './CompletedWorkoutExerciseAdditionScreen';

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

function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function requiredId(index: number) {
  return unwrap(DomainId.create(uuids[index] ?? ''));
}

function completedSession() {
  const started = Date.UTC(2026, 7, 8, 4);
  const set = unwrap(
    WorkoutSet.create({
      id: requiredId(2),
      position: 0,
      repsInReserve: null,
      result: RepetitionResult.valid(12),
    }),
  );
  const exercise = unwrap(
    WorkoutSessionExercise.create({
      exerciseNameSnapshot: 'Push-up',
      id: requiredId(1),
      loggingModeSnapshot: 'repetitions',
      plannedPrescriptionSnapshot: null,
      position: 0,
      sets: [set],
      sourceExerciseDefinitionId: requiredId(3),
      sourcePlannedExerciseId: null,
    }),
  );
  return unwrap(
    WorkoutSession.create({
      completedAtEpochMilliseconds: started + 600_000,
      exercises: [exercise],
      id: requiredId(0),
      name: 'Workout',
      sourcePlannedWorkoutId: null,
      sourceWeekday: null,
      startedAtEpochMilliseconds: started,
      startedLocalCalendarDate: '2026-08-08',
      startedUtcOffsetMinutes: 0,
      status: 'completed',
    }),
  );
}

function catalogItem(
  index: number,
  name: string,
  loggingMode: ExerciseLoggingMode = 'repetitions',
) {
  return unwrap(
    ExerciseCatalogItem.create({
      definition: unwrap(
        ExerciseDefinition.create({
          equipment: 'none',
          id: requiredId(index),
          loggingMode,
          name,
          primaryMuscleGroup: 'chest',
        }),
      ),
      isFavorite: false,
    }),
  );
}

function loader(
  addCompletedExercise: jest.Mock = jest.fn(),
  session: WorkoutSession | null = completedSession(),
  items: readonly ExerciseCatalogItem[] = [catalogItem(4, 'Squat')],
) {
  const useCases = {
    addCompletedExercise: { execute: addCompletedExercise },
    browseExercises: {
      listAll: () => Promise.resolve(items),
      listRecentlyPerformed: () => Promise.resolve(items),
      search: () => Promise.resolve(items),
    },
    getCompleted: { execute: () => Promise.resolve(session) },
    getProfile: { execute: () => Promise.resolve(null) },
  } as never;
  return () => Promise.resolve(useCases);
}

async function selectSquat() {
  await waitFor(() =>
    expect(screen.getByLabelText('Add Squat')).toBeOnTheScreen(),
  );
  await fireEvent.press(screen.getByLabelText('Add Squat'));
}

async function recordTwelveRepetitions() {
  await fireEvent.changeText(
    screen.getByTestId('workout-set-repetitions-input'),
    '12',
  );
  await fireEvent.press(screen.getByLabelText('Add Exercise And Set'));
}

describe('CompletedWorkoutExerciseAdditionScreen', () => {
  it('offers the catalog the way the active workout does', async () => {
    await render(
      <CompletedWorkoutExerciseAdditionScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader()}
        onDone={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Add Squat')).toBeOnTheScreen(),
    );
    expect(
      screen.getByText('Choose the exercise you performed'),
    ).toBeOnTheScreen();
    // The picker composes its own filtering, so this screen offers the same
    // narrowing as the Planner, the active Session, and the Exercise Library
    // without wiring anything for it.
    expect(
      screen.getByTestId('exercise-picker-filters-toggle'),
    ).toBeOnTheScreen();
  });

  it('requires the first recorded set before anything can be added', async () => {
    const addCompletedExercise = jest.fn();
    await render(
      <CompletedWorkoutExerciseAdditionScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader(addCompletedExercise)}
        onDone={jest.fn()}
      />,
    );

    await selectSquat();

    expect(screen.getByText('Record what you performed')).toBeOnTheScreen();
    expect(
      screen.getByTestId('workout-set-repetitions-input'),
    ).toBeOnTheScreen();
    expect(addCompletedExercise).not.toHaveBeenCalled();
  });

  it('states what the addition changes before it is saved', async () => {
    await render(
      <CompletedWorkoutExerciseAdditionScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader()}
        onDone={jest.fn()}
      />,
    );

    await selectSquat();

    expect(
      screen.getByText(/Personal records and progress may change/),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/never gains an exercise that recorded nothing/),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        `What this addition changes, ${additionSaveExplanation}`,
      ),
    ).toBeOnTheScreen();
  });

  it('adds the selected exercise with its first recorded set', async () => {
    const addCompletedExercise = jest
      .fn()
      .mockResolvedValue({ session: completedSession(), status: 'added' });
    const onDone = jest.fn();
    await render(
      <CompletedWorkoutExerciseAdditionScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader(addCompletedExercise)}
        onDone={onDone}
      />,
    );

    await selectSquat();
    await recordTwelveRepetitions();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(addCompletedExercise).toHaveBeenCalledWith({
      definitionId: uuids[4],
      expected: {
        completedAtEpochMilliseconds: Date.UTC(2026, 7, 8, 4) + 600_000,
        startedAtEpochMilliseconds: Date.UTC(2026, 7, 8, 4),
      },
      repsInReserve: null,
      result: RepetitionResult.valid(12),
      sessionId: uuids[0],
    });
  });

  it('hands a successful addition to the detail so it can announce it', async () => {
    const addCompletedExercise = jest
      .fn()
      .mockResolvedValue({ session: completedSession(), status: 'added' });
    const onAdded = jest.fn();
    const onDone = jest.fn();
    await render(
      <CompletedWorkoutExerciseAdditionScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader(addCompletedExercise)}
        onAdded={onAdded}
        onDone={onDone}
      />,
    );

    await selectSquat();
    await recordTwelveRepetitions();

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
  });

  it('keeps the entered values and stays put when the addition is refused', async () => {
    const addCompletedExercise = jest
      .fn()
      .mockResolvedValue({ reason: 'workout-full', status: 'refused' });
    const onDone = jest.fn();
    await render(
      <CompletedWorkoutExerciseAdditionScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader(addCompletedExercise)}
        onDone={onDone}
      />,
    );

    await selectSquat();
    await recordTwelveRepetitions();

    await waitFor(() =>
      expect(
        screen.getByText(/most exercises a workout can keep/),
      ).toBeOnTheScreen(),
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('workout-set-repetitions-input').props.value,
    ).toBe('12');
  });

  it('reports a failed write without claiming anything changed', async () => {
    const addCompletedExercise = jest
      .fn()
      .mockRejectedValue(new Error('storage is unavailable'));
    await render(
      <CompletedWorkoutExerciseAdditionScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader(addCompletedExercise)}
        onDone={jest.fn()}
      />,
    );

    await selectSquat();
    await recordTwelveRepetitions();

    await waitFor(() =>
      expect(
        screen.getByText(
          'This exercise could not be added. Nothing was changed.',
        ),
      ).toBeOnTheScreen(),
    );
  });

  it('submits once while a write is in flight', async () => {
    const addCompletedExercise = jest
      .fn()
      .mockImplementation(() => new Promise(() => undefined));
    await render(
      <CompletedWorkoutExerciseAdditionScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader(addCompletedExercise)}
        onDone={jest.fn()}
      />,
    );

    await selectSquat();
    await recordTwelveRepetitions();
    await fireEvent.press(screen.getByLabelText('Add Exercise And Set'));

    expect(addCompletedExercise).toHaveBeenCalledTimes(1);
  });

  it('lets the selection be changed without adding anything', async () => {
    const addCompletedExercise = jest.fn();
    await render(
      <CompletedWorkoutExerciseAdditionScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader(addCompletedExercise)}
        onDone={jest.fn()}
      />,
    );

    await selectSquat();
    await fireEvent.press(screen.getByLabelText('Choose A Different Exercise'));

    await waitFor(() =>
      expect(screen.getByLabelText('Add Squat')).toBeOnTheScreen(),
    );
    expect(addCompletedExercise).not.toHaveBeenCalled();
  });

  it('reports a workout that is no longer available', async () => {
    await render(
      <CompletedWorkoutExerciseAdditionScreen
        id={uuids[0] ?? ''}
        loadUseCases={loader(jest.fn(), null)}
        onDone={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText('Completed workout unavailable'),
      ).toBeOnTheScreen(),
    );
  });
});
