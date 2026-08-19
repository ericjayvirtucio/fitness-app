import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {
  DomainId,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  type Result,
} from '@fitness/domain';
import type { WorkoutSessionRenameOutcome } from '../application/rename-workout-session-use-case';
import { WorkoutNameScreen } from './WorkoutNameScreen';

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
const startedAt = 1_700_000_000_000;

function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function id(value: string) {
  return unwrap(DomainId.create(value));
}

function session(name = 'Workout') {
  const exercise = unwrap(
    WorkoutSessionExercise.create({
      exerciseNameSnapshot: 'Bench press',
      id: id('550e8400-e29b-41d4-a716-446655440001'),
      loggingModeSnapshot: 'repetitions',
      plannedPrescriptionSnapshot: null,
      position: 0,
      sets: [
        unwrap(
          WorkoutSet.create({
            id: id('550e8400-e29b-41d4-a716-446655440002'),
            position: 0,
            result: RepetitionResult.valid(8),
          }),
        ),
      ],
      sourceExerciseDefinitionId: id('550e8400-e29b-41d4-a716-446655440004'),
      sourcePlannedExerciseId: null,
    }),
  );
  return unwrap(
    WorkoutSession.create({
      completedAtEpochMilliseconds: startedAt + 3_600_000,
      exercises: [exercise],
      id: id(sessionId),
      name,
      sourcePlannedWorkoutId: null,
      sourceWeekday: null,
      startedAtEpochMilliseconds: startedAt,
      startedLocalCalendarDate: '2023-11-14',
      startedUtcOffsetMinutes: -480,
      status: 'completed',
    }),
  );
}

function useCases(
  rename: (input: unknown) => Promise<WorkoutSessionRenameOutcome>,
  stored: WorkoutSession | null = session(),
) {
  return () =>
    Promise.resolve({
      getSession: { execute: () => Promise.resolve(stored) },
      rename: { execute: rename },
    });
}

const renamed = (value: WorkoutSession) =>
  Promise.resolve({ session: value, status: 'renamed' as const });

describe('WorkoutNameScreen', () => {
  it('opens with the name the workout already has', async () => {
    await render(
      <WorkoutNameScreen
        id={sessionId}
        loadUseCases={useCases(() => renamed(session()))}
        onCancel={jest.fn()}
        onRenamed={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Workout name').props.value).toBe('Workout'),
    );
  });

  it('renames the workout it loaded and guards it with that lifecycle', async () => {
    const onRenamed = jest.fn();
    const calls: unknown[] = [];
    await render(
      <WorkoutNameScreen
        id={sessionId}
        loadUseCases={useCases((input) => {
          calls.push(input);
          return renamed(session('Leg Day'));
        })}
        onCancel={jest.fn()}
        onRenamed={onRenamed}
      />,
    );
    await waitFor(() => screen.getByLabelText('Workout name'));

    await fireEvent.changeText(
      screen.getByLabelText('Workout name'),
      'Leg Day',
    );
    await fireEvent.press(screen.getByLabelText('Save Name'));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledTimes(1));
    expect(calls).toEqual([
      {
        expected: {
          completedAtEpochMilliseconds: startedAt + 3_600_000,
          startedAtEpochMilliseconds: startedAt,
          status: 'completed',
        },
        name: 'Leg Day',
        sessionId,
      },
    ]);
  });

  it('states a refusal in its fixed sentence and keeps the entered name', async () => {
    await render(
      <WorkoutNameScreen
        id={sessionId}
        loadUseCases={useCases(() =>
          Promise.resolve({
            reason: 'invalid-name' as const,
            status: 'refused' as const,
          }),
        )}
        onCancel={jest.fn()}
        onRenamed={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByLabelText('Workout name'));

    await fireEvent.changeText(screen.getByLabelText('Workout name'), '   ');
    await fireEvent.press(screen.getByLabelText('Save Name'));

    await waitFor(() =>
      expect(
        screen.getByText('Enter a workout name of 1 to 80 characters.'),
      ).toBeTruthy(),
    );
    expect(screen.getByLabelText('Workout name').props.value).toBe('   ');
  });

  it('states a stale workout without naming it', async () => {
    await render(
      <WorkoutNameScreen
        id={sessionId}
        loadUseCases={useCases(() =>
          Promise.resolve({
            reason: 'changed' as const,
            status: 'refused' as const,
          }),
        )}
        onCancel={jest.fn()}
        onRenamed={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByLabelText('Workout name'));

    await fireEvent.press(screen.getByLabelText('Save Name'));

    await waitFor(() =>
      expect(
        screen.getByText(
          'This workout changed since this screen opened. Open it again before renaming it.',
        ),
      ).toBeTruthy(),
    );
  });

  it('states a failed write in one fixed sentence', async () => {
    await render(
      <WorkoutNameScreen
        id={sessionId}
        loadUseCases={useCases(() => Promise.reject(new Error('write failed')))}
        onCancel={jest.fn()}
        onRenamed={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByLabelText('Workout name'));

    await fireEvent.press(screen.getByLabelText('Save Name'));

    await waitFor(() =>
      expect(
        screen.getByText(
          'This workout could not be renamed. Nothing was changed.',
        ),
      ).toBeTruthy(),
    );
  });

  it('ignores a repeated submission while a write is in flight', async () => {
    let calls = 0;
    await render(
      <WorkoutNameScreen
        id={sessionId}
        loadUseCases={useCases(() => {
          calls += 1;
          return new Promise(() => undefined);
        })}
        onCancel={jest.fn()}
        onRenamed={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByLabelText('Workout name'));

    await fireEvent.press(screen.getByLabelText('Save Name'));
    await fireEvent.press(screen.getByLabelText('Save Name'));
    await fireEvent.press(screen.getByLabelText('Save Name'));

    await waitFor(() => expect(calls).toBe(1));
  });

  it('offers only a way back when the workout is gone', async () => {
    const onCancel = jest.fn();
    await render(
      <WorkoutNameScreen
        id={sessionId}
        loadUseCases={useCases(() => renamed(session()), null)}
        onCancel={onCancel}
        onRenamed={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText('This workout is no longer available.'),
      ).toBeTruthy(),
    );
    expect(screen.queryByLabelText('Workout name')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Go Back'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('holds the entered name to the length the schema and the domain share', async () => {
    await render(
      <WorkoutNameScreen
        id={sessionId}
        loadUseCases={useCases(() => renamed(session()))}
        onCancel={jest.fn()}
        onRenamed={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Workout name').props.maxLength).toBe(80),
    );
  });
});
