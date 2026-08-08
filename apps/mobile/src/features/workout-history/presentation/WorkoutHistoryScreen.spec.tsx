import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { DomainId } from '@fitness/domain';
import { WorkoutHistoryScreen } from './WorkoutHistoryScreen';

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

function id(value: string) {
  const result = DomainId.create(value);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('WorkoutHistoryScreen', () => {
  it('shows derived progress and opens immutable completed history', async () => {
    const onOpenSession = jest.fn();
    await render(
      <WorkoutHistoryScreen
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(null) },
            getSummary: {
              execute: () =>
                Promise.resolve({
                  actualSetCount: 3,
                  completedWorkoutCount: 1,
                  distanceMillimeters: null,
                  durationSeconds: null,
                  elapsedWorkoutSeconds: 1_800,
                  performedExerciseCount: 1,
                  recordedLoadVolumeGramRepetitions: 240_000,
                  repetitions: 24,
                }),
            },
            list: {
              execute: () =>
                Promise.resolve({
                  items: [
                    {
                      actualSetCount: 3,
                      completedAtEpochMilliseconds: 1_800_000,
                      elapsedSeconds: 1_800,
                      exerciseCount: 1,
                      nameSnapshot: 'Push Day',
                      performedExerciseCount: 1,
                      sessionId: id('550e8400-e29b-41d4-a716-446655440000'),
                      startedAtEpochMilliseconds: 0,
                      startedLocalCalendarDate: '2026-08-08',
                      startedUtcOffsetMinutes: 0,
                    },
                  ],
                  nextCursor: null,
                }),
            },
          } as never)
        }
        onOpenSession={onOpenSession}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Workout History')).toBeOnTheScreen(),
    );
    expect(screen.getByText('1 completed workouts')).toBeOnTheScreen();
    expect(
      screen.getByText('240 kg-reps recorded load volume'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('completed-workout-card'));
    expect(onOpenSession).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('shows an actionable empty state', async () => {
    await render(
      <WorkoutHistoryScreen
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(null) },
            getSummary: {
              execute: () =>
                Promise.resolve({
                  actualSetCount: 0,
                  completedWorkoutCount: 0,
                  distanceMillimeters: null,
                  durationSeconds: null,
                  elapsedWorkoutSeconds: 0,
                  performedExerciseCount: 0,
                  recordedLoadVolumeGramRepetitions: null,
                  repetitions: null,
                }),
            },
            list: {
              execute: () => Promise.resolve({ items: [], nextCursor: null }),
            },
          } as never)
        }
        onOpenSession={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('No completed workouts yet')).toBeOnTheScreen(),
    );
  });
});
