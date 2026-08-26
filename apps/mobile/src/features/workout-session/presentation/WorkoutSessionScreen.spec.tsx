import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {
  DomainId,
  Mass,
  RepetitionResult,
  ResistanceRepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  createPlannedPrescription,
  type ExerciseLoggingMode,
  type Result,
  type WorkoutResult,
} from '@fitness/domain';
import { WorkoutSessionScreen } from './WorkoutSessionScreen';

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
];

function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function id(index: number) {
  return unwrap(DomainId.create(uuids[index] ?? ''));
}

function recordedSet(index: number, position: number, result: WorkoutResult) {
  return unwrap(WorkoutSet.create({ id: id(index), position, result }));
}

const twentyKilograms = () => unwrap(Mass.create(20, 'kilogram'));

function activeExercise(
  index: number,
  position: number,
  name: string,
  loggingMode: ExerciseLoggingMode,
  sets: readonly WorkoutSet[],
  plannedResistance: Mass | null = null,
) {
  return unwrap(
    WorkoutSessionExercise.create({
      exerciseNameSnapshot: name,
      id: id(index),
      loggingModeSnapshot: loggingMode,
      plannedPrescriptionSnapshot:
        plannedResistance === null
          ? null
          : unwrap(
              createPlannedPrescription({
                loggingMode,
                repetitions: 8,
                resistance: plannedResistance,
                sets: 3,
              }),
            ),
      position,
      sets,
      sourceExerciseDefinitionId: id(5),
      sourcePlannedExerciseId: null,
    }),
  );
}

function activeSession(exercises: readonly WorkoutSessionExercise[]) {
  const started = Date.UTC(2026, 7, 8, 4);
  return unwrap(
    WorkoutSession.create({
      completedAtEpochMilliseconds: null,
      exercises,
      id: id(0),
      name: 'Morning workout',
      sourcePlannedWorkoutId: null,
      sourceWeekday: null,
      startedAtEpochMilliseconds: started,
      startedLocalCalendarDate: '2026-08-08',
      startedUtcOffsetMinutes: 0,
      status: 'active',
    }),
  );
}

const assistedPullUp = (sets: readonly WorkoutSet[], planned?: Mass) =>
  activeExercise(
    1,
    0,
    'Assisted pull-up',
    'assistance-and-repetitions',
    sets,
    planned ?? null,
  );

/**
 * Reloads are queued rather than recomputed, so a test can prove the screen
 * shows what a mutation produced instead of what it started with.
 */
function loader(
  session: WorkoutSession | null,
  options: Readonly<{
    addSet?: jest.Mock;
    reloads?: readonly (WorkoutSession | null)[];
    updateSet?: jest.Mock;
  }> = {},
) {
  const reloads = [...(options.reloads ?? [])];
  const useCases = {
    browseExercises: { execute: () => Promise.resolve([]) },
    discard: { execute: jest.fn() },
    finish: { execute: jest.fn() },
    getActive: {
      execute: () =>
        Promise.resolve(reloads.length > 0 ? reloads.shift() : session),
    },
    getProfile: { execute: () => Promise.resolve(null) },
    mutations: {
      addExercise: jest.fn(),
      addSet: options.addSet ?? jest.fn(),
      deleteSet: jest.fn(),
      removeExercise: jest.fn(),
      updateSet: options.updateSet ?? jest.fn(),
    },
    start: { execute: jest.fn() },
  } as never;
  return () => Promise.resolve(useCases);
}

async function renderScreen(
  loadUseCases: () => Promise<never>,
  onClose = jest.fn(),
) {
  await render(
    <WorkoutSessionScreen loadUseCases={loadUseCases} onClose={onClose} />,
  );
  return onClose;
}

describe('WorkoutSessionScreen', () => {
  it('shows the active workout, its planned target, and its recorded sets', async () => {
    const loadUseCases = loader(
      activeSession([
        assistedPullUp(
          [
            recordedSet(
              2,
              0,
              ResistanceRepetitionResult.valid(twentyKilograms(), 8),
            ),
          ],
          twentyKilograms(),
        ),
      ]),
    );
    await renderScreen(loadUseCases);

    await waitFor(() =>
      expect(screen.getByText('Morning workout')).toBeOnTheScreen(),
    );
    expect(
      screen.getByText('Planned: 3 sets · 8 reps · Assistance 20 kg'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Set 1: Assistance 20 kg × 8')).toBeOnTheScreen();
  });

  it('tells an assisted set apart from an added-load set of the same mass', async () => {
    const sameMass = () =>
      recordedSet(2, 0, ResistanceRepetitionResult.valid(twentyKilograms(), 8));
    const loadUseCases = loader(
      activeSession([
        assistedPullUp([sameMass()]),
        activeExercise(
          3,
          1,
          'Weighted dip',
          'bodyweight-plus-load-and-repetitions',
          [
            recordedSet(
              4,
              0,
              ResistanceRepetitionResult.valid(twentyKilograms(), 8),
            ),
          ],
        ),
      ]),
    );
    await renderScreen(loadUseCases);

    await waitFor(() =>
      expect(screen.getByText('Set 1: Assistance 20 kg × 8')).toBeOnTheScreen(),
    );
    expect(screen.getByText('Set 1: Added 20 kg × 8')).toBeOnTheScreen();
    expect(screen.queryByText('Set 1: 20 kg × 8')).not.toBeOnTheScreen();
  });

  it('leaves an external load set unmarked, because a lifted mass is the unmarked case', async () => {
    const loadUseCases = loader(
      activeSession([
        activeExercise(1, 0, 'Bench press', 'external-load-and-repetitions', [
          recordedSet(
            2,
            0,
            ResistanceRepetitionResult.valid(twentyKilograms(), 8),
          ),
        ]),
      ]),
    );
    await renderScreen(loadUseCases);

    await waitFor(() =>
      expect(screen.getByText('Set 1: 20 kg × 8')).toBeOnTheScreen(),
    );
  });

  it('names each set control by its set number and its exercise', async () => {
    const loadUseCases = loader(
      activeSession([
        assistedPullUp([
          recordedSet(
            2,
            0,
            ResistanceRepetitionResult.valid(twentyKilograms(), 8),
          ),
        ]),
      ]),
    );
    await renderScreen(loadUseCases);

    await waitFor(() =>
      expect(
        screen.getByLabelText('Edit set 1 for Assisted pull-up'),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.getByLabelText('Delete set 1 for Assisted pull-up'),
    ).toBeOnTheScreen();
  });

  it('says an exercise has no recorded sets rather than showing nothing', async () => {
    const loadUseCases = loader(activeSession([assistedPullUp([])]));
    await renderScreen(loadUseCases);

    await waitFor(() =>
      expect(screen.getByText('No actual sets recorded')).toBeOnTheScreen(),
    );
    expect(
      screen.getByRole('button', { name: 'Add Set for Assisted pull-up' }),
    ).toBeOnTheScreen();
  });

  it('records a new set through the entry form and shows what it recorded', async () => {
    const recorded = recordedSet(
      2,
      0,
      ResistanceRepetitionResult.valid(twentyKilograms(), 8),
    );
    const addSet = jest.fn(() => Promise.resolve({ isSuccess: true }));
    const loadUseCases = loader(activeSession([assistedPullUp([])]), {
      addSet,
      reloads: [
        activeSession([assistedPullUp([])]),
        activeSession([assistedPullUp([recorded])]),
      ],
    });
    await renderScreen(loadUseCases);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Set for Assisted pull-up' }),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Add Set for Assisted pull-up' }),
    );

    // Filled in the order the person reaches them; the entry surface names the
    // field "Assistance (kg)" while this screen displays "Assistance 20 kg".
    await fireEvent.changeText(
      screen.getByTestId('workout-set-repetitions-input'),
      '8',
    );
    await fireEvent.changeText(
      screen.getByTestId('workout-set-resistance-input'),
      '20',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save Set' }));

    await waitFor(() => expect(addSet).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText('Set 1: Assistance 20 kg × 8')).toBeOnTheScreen(),
    );
  });

  it('offers rest timing only after a set saves successfully', async () => {
    const recorded = recordedSet(
      2,
      0,
      ResistanceRepetitionResult.valid(twentyKilograms(), 8),
    );
    const addSet = jest.fn(() => Promise.resolve({ isSuccess: true }));
    const loadUseCases = loader(activeSession([assistedPullUp([])]), {
      addSet,
      reloads: [
        activeSession([assistedPullUp([])]),
        activeSession([assistedPullUp([recorded])]),
      ],
    });
    await renderScreen(loadUseCases);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Set for Assisted pull-up' }),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.queryByLabelText('Start rest timer, 90 seconds'),
    ).not.toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Add Set for Assisted pull-up' }),
    );
    await fireEvent.changeText(
      screen.getByTestId('workout-set-repetitions-input'),
      '8',
    );
    await fireEvent.changeText(
      screen.getByTestId('workout-set-resistance-input'),
      '20',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save Set' }));

    await waitFor(() =>
      expect(
        screen.getByLabelText('Start rest timer, 90 seconds'),
      ).toBeOnTheScreen(),
    );
  });

  it('never offers rest timing after a rejected set save', async () => {
    const addSet = jest.fn(() => Promise.resolve({ isSuccess: false }));
    const loadUseCases = loader(activeSession([assistedPullUp([])]), {
      addSet,
    });
    await renderScreen(loadUseCases);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Set for Assisted pull-up' }),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Add Set for Assisted pull-up' }),
    );
    await fireEvent.changeText(
      screen.getByTestId('workout-set-repetitions-input'),
      '8',
    );
    await fireEvent.changeText(
      screen.getByTestId('workout-set-resistance-input'),
      '20',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save Set' }));

    await waitFor(() => expect(addSet).toHaveBeenCalledTimes(1));
    expect(
      screen.getByText('Set could not be saved. Your values are still here.'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByLabelText('Start rest timer, 90 seconds'),
    ).not.toBeOnTheScreen();
  });

  it('opens the entry form on the recorded value when a set is edited', async () => {
    const loadUseCases = loader(
      activeSession([
        assistedPullUp([
          recordedSet(
            2,
            0,
            ResistanceRepetitionResult.valid(twentyKilograms(), 8),
          ),
        ]),
      ]),
    );
    await renderScreen(loadUseCases);

    await waitFor(() =>
      expect(
        screen.getByLabelText('Edit set 1 for Assisted pull-up'),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Edit set 1 for Assisted pull-up' }),
    );

    expect(screen.getByTestId('workout-set-resistance-input').props.value).toBe(
      '20',
    );
    expect(
      screen.getByTestId('workout-set-repetitions-input').props.value,
    ).toBe('8');
  });

  it('offers a way back when no workout is active', async () => {
    const onClose = await renderScreen(loader(null));

    await waitFor(() =>
      expect(screen.getByText('No active workout')).toBeOnTheScreen(),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Back to Workout' }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('states a load failure without exposing why it failed', async () => {
    const loadUseCases = () => Promise.reject(new Error('database is locked'));
    await render(
      <WorkoutSessionScreen
        loadUseCases={loadUseCases as never}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Workout unavailable')).toBeOnTheScreen(),
    );
    expect(
      screen.getByText('Active workout could not be loaded.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/database/i)).not.toBeOnTheScreen();
  });

  it('records repetitions without a mass when the mode carries no resistance', async () => {
    const loadUseCases = loader(
      activeSession([
        activeExercise(1, 0, 'Push-up', 'repetitions', [
          recordedSet(2, 0, RepetitionResult.valid(12)),
        ]),
      ]),
    );
    await renderScreen(loadUseCases);

    await waitFor(() =>
      expect(screen.getByText('Set 1: 12 reps')).toBeOnTheScreen(),
    );
  });

  it('offers naming the active workout by the name it currently has', async () => {
    const onRename = jest.fn();
    const loadUseCases = loader(
      activeSession([
        activeExercise(1, 0, 'Push-up', 'repetitions', [
          recordedSet(2, 0, RepetitionResult.valid(12)),
        ]),
      ]),
    );
    await render(
      <WorkoutSessionScreen
        loadUseCases={loadUseCases}
        onClose={jest.fn()}
        onRename={onRename}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Rename this workout, Morning workout'),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByTestId('rename-active-workout'));
    expect(onRename).toHaveBeenCalledWith(uuids[0]);
  });

  it('hides the naming control where no route offers one', async () => {
    const loadUseCases = loader(
      activeSession([
        activeExercise(1, 0, 'Push-up', 'repetitions', [
          recordedSet(2, 0, RepetitionResult.valid(12)),
        ]),
      ]),
    );
    await renderScreen(loadUseCases);

    await waitFor(() => screen.getByText('Morning workout'));
    expect(screen.queryByTestId('rename-active-workout')).toBeNull();
  });
});
