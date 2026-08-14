import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {
  createPlannedPrescription,
  DomainId,
  Mass,
  ResistanceRepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  type Result,
} from '@fitness/domain';
import { CompletedWorkoutSetCorrectionScreen } from './CompletedWorkoutSetCorrectionScreen';

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

const sessionId = '550e8400-e29b-41d4-a716-446655440000';
const exerciseId = '550e8400-e29b-41d4-a716-446655440001';
const setId = '550e8400-e29b-41d4-a716-446655440002';
const definitionId = '550e8400-e29b-41d4-a716-446655440003';

function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function id(value: string) {
  return unwrap(DomainId.create(value));
}

function completedSession() {
  const set = unwrap(
    WorkoutSet.create({
      id: id(setId),
      position: 0,
      result: ResistanceRepetitionResult.valid(
        unwrap(Mass.create(600, 'kilogram')),
        8,
      ),
    }),
  );
  const exercise = unwrap(
    WorkoutSessionExercise.create({
      exerciseNameSnapshot: 'Bench press',
      id: id(exerciseId),
      loggingModeSnapshot: 'external-load-and-repetitions',
      plannedPrescriptionSnapshot: unwrap(
        createPlannedPrescription({
          loggingMode: 'external-load-and-repetitions',
          repetitions: 8,
          resistance: unwrap(Mass.create(60, 'kilogram')),
          sets: 3,
        }),
      ),
      position: 0,
      sets: [set],
      sourceExerciseDefinitionId: id(definitionId),
      sourcePlannedExerciseId: null,
    }),
  );
  const started = Date.UTC(2026, 7, 8, 4);
  return unwrap(
    WorkoutSession.create({
      completedAtEpochMilliseconds: started + 600_000,
      exercises: [exercise],
      id: id(sessionId),
      name: 'Push day',
      sourcePlannedWorkoutId: null,
      sourceWeekday: null,
      startedAtEpochMilliseconds: started,
      startedLocalCalendarDate: '2026-08-08',
      startedUtcOffsetMinutes: 0,
      status: 'completed',
    }),
  );
}

function loader(correctSet: Record<string, unknown> = {}) {
  const useCases = {
    correctSet: {
      addSet: jest.fn().mockResolvedValue({
        session: completedSession(),
        status: 'corrected',
      }),
      deleteSet: jest.fn(),
      editSet: jest.fn().mockResolvedValue({
        session: completedSession(),
        status: 'corrected',
      }),
      ...correctSet,
    },
    getCompleted: { execute: () => Promise.resolve(completedSession()) },
    getProfile: { execute: () => Promise.resolve(null) },
  } as never;
  return () => Promise.resolve(useCases);
}

function missingLoader() {
  const useCases = {
    correctSet: { addSet: jest.fn(), deleteSet: jest.fn(), editSet: jest.fn() },
    getCompleted: { execute: () => Promise.resolve(null) },
    getProfile: { execute: () => Promise.resolve(null) },
  } as never;
  return () => Promise.resolve(useCases);
}

async function enterRepetitions(value: string) {
  await fireEvent.changeText(
    screen.getByTestId('workout-set-repetitions-input'),
    value,
  );
}

describe('CompletedWorkoutSetCorrectionScreen', () => {
  it('shows the captured target, the recorded result, and what correction changes', async () => {
    const loadUseCases = loader();
    await render(
      <CompletedWorkoutSetCorrectionScreen
        exerciseId={exerciseId}
        loadUseCases={loadUseCases}
        onDone={jest.fn()}
        sessionId={sessionId}
        setId={setId}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Correct recorded set')).toBeOnTheScreen(),
    );
    expect(screen.getByText(/Planned target/)).toBeOnTheScreen();
    expect(
      screen.getByText('Currently recorded set 1: 600 kg × 8'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/Personal records and progress may change/),
    ).toBeOnTheScreen();
    expect(screen.getByText('Edit recorded result')).toBeOnTheScreen();
    expect(screen.getByLabelText('Save Correction')).toBeOnTheScreen();
    expect(screen.getByLabelText('Cancel Correction')).toBeOnTheScreen();
  });

  it('saves a corrected result with the values it loaded', async () => {
    const editSet = jest.fn().mockResolvedValue({
      session: completedSession(),
      status: 'corrected',
    });
    const onDone = jest.fn();
    const loadUseCases = loader({ editSet });
    await render(
      <CompletedWorkoutSetCorrectionScreen
        exerciseId={exerciseId}
        loadUseCases={loadUseCases}
        onDone={onDone}
        sessionId={sessionId}
        setId={setId}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Save Correction')).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByLabelText('Save Correction'));

    await waitFor(() => expect(editSet).toHaveBeenCalledTimes(1));
    expect(editSet).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId,
        expected: {
          distanceMillimeters: null,
          durationSeconds: null,
          kind: 'resistance-and-repetitions',
          repetitions: 8,
          resistanceGrams: 600_000,
        },
        sessionId,
        setId,
      }),
    );
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps the entered values and explains a refused correction', async () => {
    const editSet = jest
      .fn()
      .mockResolvedValue({ reason: 'changed', status: 'refused' });
    const onDone = jest.fn();
    const loadUseCases = loader({ editSet });
    await render(
      <CompletedWorkoutSetCorrectionScreen
        exerciseId={exerciseId}
        loadUseCases={loadUseCases}
        onDone={onDone}
        sessionId={sessionId}
        setId={setId}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Save Correction')).toBeOnTheScreen(),
    );
    await enterRepetitions('5');
    await fireEvent.press(screen.getByLabelText('Save Correction'));

    await waitFor(() =>
      expect(
        screen.getByText(/changed since this screen opened/),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByDisplayValue('5')).toBeOnTheScreen();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('rejects values the captured logging mode cannot hold', async () => {
    const editSet = jest.fn();
    const loadUseCases = loader({ editSet });
    await render(
      <CompletedWorkoutSetCorrectionScreen
        exerciseId={exerciseId}
        loadUseCases={loadUseCases}
        onDone={jest.fn()}
        sessionId={sessionId}
        setId={setId}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Save Correction')).toBeOnTheScreen(),
    );
    await enterRepetitions('0');
    await fireEvent.press(screen.getByLabelText('Save Correction'));

    await waitFor(() =>
      expect(
        screen.getByText('Enter valid values for this set.'),
      ).toBeOnTheScreen(),
    );
    expect(editSet).not.toHaveBeenCalled();
  });

  it('adds a missing set without showing a recorded result', async () => {
    const addSet = jest.fn().mockResolvedValue({
      session: completedSession(),
      status: 'corrected',
    });
    const loadUseCases = loader({ addSet });
    await render(
      <CompletedWorkoutSetCorrectionScreen
        exerciseId={exerciseId}
        loadUseCases={loadUseCases}
        onDone={jest.fn()}
        sessionId={sessionId}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Add missing set')).toBeOnTheScreen(),
    );
    expect(screen.queryByText(/Currently recorded set/)).not.toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '60');
    await enterRepetitions('6');
    await fireEvent.press(screen.getByLabelText('Save Missing Set'));

    await waitFor(() => expect(addSet).toHaveBeenCalledTimes(1));
    expect(addSet).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId, sessionId }),
    );
  });

  it('states plainly when the recorded set is no longer part of the workout', async () => {
    const loadUseCases = missingLoader();
    await render(
      <CompletedWorkoutSetCorrectionScreen
        exerciseId={exerciseId}
        loadUseCases={loadUseCases}
        onDone={jest.fn()}
        sessionId={sessionId}
        setId={setId}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Recorded set unavailable')).toBeOnTheScreen(),
    );
    expect(
      screen.getByLabelText('Back to Completed Workout'),
    ).toBeOnTheScreen();
  });
});
